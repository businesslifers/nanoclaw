/**
 * Host-side write handlers invoked by the dashboard's HTTP layer.
 *
 * Mutation never lives in the dashboard package itself. The package
 * validates the request shape, runs the foundation flow (bearer + CSRF
 * + actor resolution), and then delegates to one of these methods. Each
 * method runs the DB write + side effects + audit row, then asks the
 * pusher to push immediately so the UI refreshes within ~1s.
 */
import type { IncomingMessage } from 'http';
import Database from 'better-sqlite3';

import { CronExpressionParser } from 'cron-parser';

import { appendAudit } from './db/dashboard-audit.js';
import { getAgentGroup, updateAgentGroup } from './db/agent-groups.js';
import { ensureContainerConfig, getContainerConfig, updateContainerConfigScalars } from './db/container-configs.js';
import { getDb } from './db/connection.js';
import { getSession, getSessionsByAgentGroup } from './db/sessions.js';
import { killContainer } from './container-runner.js';
import { hasAdminPrivilege } from './modules/permissions/db/user-roles.js';
import { getOwners } from './modules/permissions/db/user-roles.js';
import { canAccessAgentGroup } from './modules/permissions/access.js';
import {
  cancelTask as cancelTaskPrim,
  pauseTask as pauseTaskPrim,
  resumeTask as resumeTaskPrim,
  updateTask as updateTaskPrim,
  type TaskUpdate,
} from './modules/scheduling/db.js';
import { inboundDbPath } from './session-manager.js';
import { nudgePusher } from './dashboard-pusher.js';
import {
  addWorkItemNote,
  cancelWorkItem,
  createWorkItem,
  reassignWorkItem,
  updateWorkItem,
} from './dashboard-work-items-mutators.js';

export class MutatorAuthError extends Error {
  readonly status = 403;
}
export class MutatorValidationError extends Error {
  readonly status = 400;
}
export class MutatorConflictError extends Error {
  readonly status = 409;
}
export class MutatorNotFoundError extends Error {
  readonly status = 404;
}

const NAME_MAX = 80;
// eslint-disable-next-line no-control-regex -- intentional: reject control chars in names
const CONTROL_CHAR_RE = /[\x00-\x1f\x7f]/;

function validateName(raw: unknown): string {
  if (typeof raw !== 'string') throw new MutatorValidationError('name must be a string');
  const trimmed = raw.trim();
  if (trimmed.length === 0) throw new MutatorValidationError('name must not be empty');
  if (trimmed.length > NAME_MAX) throw new MutatorValidationError(`name exceeds ${NAME_MAX} chars`);
  if (CONTROL_CHAR_RE.test(trimmed)) throw new MutatorValidationError('name contains control characters');
  return trimmed;
}

const MODEL_MAX = 120;

/**
 * Model strings are opaque overrides (SDK conventions like `sonnet[1m]`
 * pass through untouched) — we only trim and reject junk. `null` /
 * empty means "clear the override" (fall back down the resolver ladder).
 */
function validateModel(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'string') throw new MutatorValidationError('model must be a string or null');
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > MODEL_MAX) throw new MutatorValidationError(`model exceeds ${MODEL_MAX} chars`);
  if (CONTROL_CHAR_RE.test(trimmed)) throw new MutatorValidationError('model contains control characters');
  return trimmed;
}

const EFFORT_MAX = 40;

/**
 * Effort strings are provider vocab (claude: low…max, codex: none…xhigh) but
 * stored opaquely like model — presets are a convenience, not a gate. Only
 * normalization: lowercase, since every provider's vocab is lowercase.
 * `undefined` means "field absent — leave effort untouched"; null / empty
 * clears back to the provider default.
 */
function validateEffort(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (typeof raw !== 'string') throw new MutatorValidationError('effort must be a string or null');
  const trimmed = raw.trim().toLowerCase();
  if (trimmed.length === 0) return null;
  if (trimmed.length > EFFORT_MAX) throw new MutatorValidationError(`effort exceeds ${EFFORT_MAX} chars`);
  if (CONTROL_CHAR_RE.test(trimmed)) throw new MutatorValidationError('effort contains control characters');
  return trimmed;
}

export interface RenameAgentGroupArgs {
  id: string;
  name: string;
}

export interface SetAgentGroupHiddenArgs {
  id: string;
  hidden: boolean;
}

export interface UpdateAgentGroupModelArgs {
  id: string;
  /** New model override; null (or empty string) clears it. */
  model: string | null;
  /**
   * New effort level; null (or empty string) clears it back to the provider
   * default. Omit the field entirely to leave effort untouched (older
   * callers that only know about model keep working).
   */
  effort?: string | null;
  /** Also kill the group's running/idle containers so the next message respawns with the new model. */
  restart?: boolean;
}

export interface MutatorContext {
  /** Resolves an inbound HTTP request to a NanoClaw user_id, or undefined if no actor can be inferred. */
  resolveActor(req: IncomingMessage): string | undefined;
  mutators: {
    renameAgentGroup(args: RenameAgentGroupArgs, actorUserId: string): { id: string; name: string };
    setAgentGroupHidden(args: SetAgentGroupHiddenArgs, actorUserId: string): { id: string; hidden: boolean };
    updateAgentGroupModel(
      args: UpdateAgentGroupModelArgs,
      actorUserId: string,
    ): { id: string; model: string | null; effort: string | null; killed: number };
    cancelTask(args: TaskMutatorArgs, actorUserId: string): TaskMutatorResult;
    pauseTask(args: TaskMutatorArgs, actorUserId: string): TaskMutatorResult;
    resumeTask(args: TaskMutatorArgs, actorUserId: string): TaskMutatorResult;
    updateTask(args: UpdateTaskMutatorArgs, actorUserId: string): TaskMutatorResult;
    /** Work-item CRUD — see src/dashboard-work-items-mutators.ts. Loose arg
     *  types here on purpose: the dashboard package passes parsed JSON through
     *  and the mutators do their own validation. */
    createWorkItem(args: unknown, actorUserId: string): unknown;
    updateWorkItem(args: unknown, actorUserId: string): unknown;
    reassignWorkItem(args: unknown, actorUserId: string): unknown;
    cancelWorkItem(args: unknown, actorUserId: string): unknown;
    addWorkItemNote(args: unknown, actorUserId: string): unknown;
  };
}

/**
 * Phase-0 actor resolution: bearer == owner. Returns the install owner's
 * user_id regardless of which browser made the request, because the only
 * way to make the request was to possess `DASHBOARD_SECRET` — which is
 * an owner-equivalent capability today.
 *
 * The signature accepts `req` so a future identity source (Cf-Access JWT
 * header, per-user dashboard token) can be plugged in here without changing
 * any caller.
 */
export function resolveDashboardActor(_req: IncomingMessage): string | undefined {
  const owners = getOwners();
  return owners[0]?.user_id;
}

export function renameAgentGroup(args: RenameAgentGroupArgs, actorUserId: string): { id: string; name: string } {
  if (!args || typeof args.id !== 'string' || args.id.length === 0) {
    throw new MutatorValidationError('id is required');
  }
  const newName = validateName(args.name);

  const before = getAgentGroup(args.id);
  if (!before) throw new MutatorNotFoundError('agent group not found');

  if (!hasAdminPrivilege(actorUserId, args.id)) {
    throw new MutatorAuthError('actor lacks admin privilege over this agent group');
  }

  if (newName === before.name) {
    return { id: before.id, name: before.name };
  }

  const collision = getDb()
    .prepare('SELECT id FROM agent_groups WHERE name = ? AND id != ? LIMIT 1')
    .get(newName, args.id) as { id: string } | undefined;
  if (collision) throw new MutatorConflictError('another agent group already uses this name');

  const db = getDb();
  db.transaction(() => {
    updateAgentGroup(args.id, { name: newName });
    appendAudit(
      {
        actor_user_id: actorUserId,
        action: 'agent_group.rename',
        target_type: 'agent_group',
        target_id: args.id,
        before: { name: before.name },
        after: { name: newName },
      },
      db,
    );
  })();

  nudgePusher();
  return { id: args.id, name: newName };
}

export function setAgentGroupHidden(
  args: SetAgentGroupHiddenArgs,
  actorUserId: string,
): { id: string; hidden: boolean } {
  if (!args || typeof args.id !== 'string' || args.id.length === 0) {
    throw new MutatorValidationError('id is required');
  }
  if (typeof args.hidden !== 'boolean') {
    throw new MutatorValidationError('hidden must be a boolean');
  }

  const before = getAgentGroup(args.id);
  if (!before) throw new MutatorNotFoundError('agent group not found');

  if (!hasAdminPrivilege(actorUserId, args.id)) {
    throw new MutatorAuthError('actor lacks admin privilege over this agent group');
  }

  const beforeHidden = (before.hidden_in_dashboard ?? 0) === 1;
  if (beforeHidden === args.hidden) {
    return { id: before.id, hidden: beforeHidden };
  }

  const db = getDb();
  db.transaction(() => {
    updateAgentGroup(args.id, { hidden_in_dashboard: args.hidden ? 1 : 0 });
    appendAudit(
      {
        actor_user_id: actorUserId,
        action: 'agent_group.set_hidden_in_dashboard',
        target_type: 'agent_group',
        target_id: args.id,
        before: { hidden: beforeHidden },
        after: { hidden: args.hidden },
      },
      db,
    );
  })();

  nudgePusher();
  return { id: args.id, hidden: args.hidden };
}

export function updateAgentGroupModel(
  args: UpdateAgentGroupModelArgs,
  actorUserId: string,
): { id: string; model: string | null; effort: string | null; killed: number } {
  if (!args || typeof args.id !== 'string' || args.id.length === 0) {
    throw new MutatorValidationError('id is required');
  }
  const newModel = validateModel(args.model);
  const newEffort = validateEffort(args.effort);
  const restart = args.restart === true;

  const before = getAgentGroup(args.id);
  if (!before) throw new MutatorNotFoundError('agent group not found');

  if (!hasAdminPrivilege(actorUserId, args.id)) {
    throw new MutatorAuthError('actor lacks admin privilege over this agent group');
  }

  const beforeModel = before.model ?? null;
  const modelChanged = newModel !== beforeModel;

  // Effort has no resolution ladder — it lives only in container_configs
  // (materialized into container.json at spawn), unlike model which writes
  // agent_groups.model. `undefined` = field absent = leave untouched.
  const beforeEffort = getContainerConfig(args.id)?.effort ?? null;
  const effortChanged = newEffort !== undefined && newEffort !== beforeEffort;

  if (modelChanged || effortChanged) {
    const db = getDb();
    db.transaction(() => {
      if (modelChanged) {
        updateAgentGroup(args.id, { model: newModel });
        appendAudit(
          {
            actor_user_id: actorUserId,
            action: 'agent_group.set_model',
            target_type: 'agent_group',
            target_id: args.id,
            before: { model: beforeModel },
            after: { model: newModel },
          },
          db,
        );
      }
      if (effortChanged) {
        // Rows are backfilled at startup, but guard the never-seeded case.
        ensureContainerConfig(args.id, before.agent_provider);
        updateContainerConfigScalars(args.id, { effort: newEffort ?? null });
        appendAudit(
          {
            actor_user_id: actorUserId,
            action: 'agent_group.set_effort',
            target_type: 'agent_group',
            target_id: args.id,
            before: { effort: beforeEffort },
            after: { effort: newEffort ?? null },
          },
          db,
        );
      }
    })();
  }

  // update_agent precedent: kill running/idle containers with no respawn —
  // the next routed message spawns fresh with the new AGENT_MODEL env and a
  // freshly materialized container.json (which carries effort). Kills run
  // after the transaction commits so a fresh container can never read the
  // old values. Both are read at spawn only, so without restart the change
  // waits for the next natural spawn.
  let killed = 0;
  if (restart) {
    for (const sess of getSessionsByAgentGroup(args.id)) {
      if (sess.container_status === 'running' || sess.container_status === 'idle') {
        killContainer(sess.id, `dashboard model change by ${actorUserId}`);
        killed++;
      }
    }
  }

  if (modelChanged || effortChanged || killed > 0) nudgePusher();
  return {
    id: args.id,
    model: newModel,
    effort: newEffort === undefined ? beforeEffort : newEffort,
    killed,
  };
}

/** The mutator bundle the host hands to the dashboard server. */
export function buildDashboardMutatorContext(): MutatorContext {
  return {
    resolveActor: resolveDashboardActor,
    mutators: {
      renameAgentGroup,
      setAgentGroupHidden,
      updateAgentGroupModel,
      cancelTask,
      pauseTask,
      resumeTask,
      updateTask,
      createWorkItem: (args, actorUserId) => createWorkItem(args as never, actorUserId),
      updateWorkItem: (args, actorUserId) => updateWorkItem(args as never, actorUserId),
      reassignWorkItem: (args, actorUserId) => reassignWorkItem(args as never, actorUserId),
      cancelWorkItem: (args, actorUserId) => cancelWorkItem(args as never, actorUserId),
      addWorkItemNote: (args, actorUserId) => addWorkItemNote(args as never, actorUserId),
    },
  };
}

// ── Task mutators ──────────────────────────────────────────────────────
//
// Each task lives as a `kind='task'` row inside its session's per-session
// inbound.db (data/v2-sessions/<id>/inbound.db). The dashboard mutator
// resolves the session via the central DB, opens its inbound.db, and
// delegates to one of the primitives in `src/modules/scheduling/db.ts`.
//
// Authorization is `canAccessAgentGroup` (member or higher) — this is more
// permissive than the rename mutator's hasAdminPrivilege gate. Pause /
// resume / cancel are routine supervisory actions that group members
// reasonably perform on tasks they live with day to day.

export interface TaskMutatorArgs {
  taskId: string;
  sessionId: string;
}

export interface UpdateTaskMutatorArgs extends TaskMutatorArgs {
  prompt?: string;
  recurrence?: string | null;
  processAfter?: string;
}

export interface TaskRowSummary {
  id: string;
  status: string;
  content: string;
  process_after: string | null;
  recurrence: string | null;
  series_id: string;
  timestamp: string;
  tries: number;
}

export interface TaskMutatorResult {
  ok: true;
  task: TaskRowSummary | null;
}

function openSessionInboundDb(agentGroupId: string, sessionId: string): Database.Database {
  return new Database(inboundDbPath(agentGroupId, sessionId));
}

function readTaskRow(db: Database.Database, taskId: string): TaskRowSummary | undefined {
  return db
    .prepare(
      `SELECT id, status, content, process_after, recurrence, series_id, timestamp, tries
       FROM messages_in WHERE (id = ? OR series_id = ?) AND kind = 'task' ORDER BY seq DESC LIMIT 1`,
    )
    .get(taskId, taskId) as TaskRowSummary | undefined;
}

function authorizeTaskAccess(actorUserId: string, agentGroupId: string): void {
  const decision = canAccessAgentGroup(actorUserId, agentGroupId);
  if (!decision.allowed) {
    throw new MutatorAuthError(`actor cannot access agent group ${agentGroupId}: ${decision.reason}`);
  }
}

function validateTaskArgs(args: unknown): asserts args is TaskMutatorArgs {
  if (!args || typeof args !== 'object') throw new MutatorValidationError('args must be an object');
  const a = args as Record<string, unknown>;
  if (typeof a.taskId !== 'string' || a.taskId.length === 0) {
    throw new MutatorValidationError('taskId is required');
  }
  if (typeof a.sessionId !== 'string' || a.sessionId.length === 0) {
    throw new MutatorValidationError('sessionId is required');
  }
}

export function cancelTask(args: TaskMutatorArgs, actorUserId: string): TaskMutatorResult {
  validateTaskArgs(args);

  const session = getSession(args.sessionId);
  if (!session) throw new MutatorNotFoundError(`session ${args.sessionId} not found`);
  authorizeTaskAccess(actorUserId, session.agent_group_id);

  const inDb = openSessionInboundDb(session.agent_group_id, args.sessionId);
  try {
    const before = readTaskRow(inDb, args.taskId);
    if (!before) throw new MutatorNotFoundError(`task ${args.taskId} not found`);

    cancelTaskPrim(inDb, args.taskId);
    const after = readTaskRow(inDb, args.taskId);

    // cancelTaskPrim only acts on rows in ('pending','paused'); a 'processing'
    // row is left untouched. Detect the no-op so the caller sees a 404 rather
    // than a misleading "ok" response.
    if (after && after.id === before.id && after.status === before.status && after.recurrence === before.recurrence) {
      throw new MutatorNotFoundError(
        `task ${args.taskId} could not be cancelled (status=${before.status}; only pending/paused are cancellable)`,
      );
    }

    appendAudit({
      actor_user_id: actorUserId,
      action: 'task.cancel',
      target_type: 'task',
      target_id: `${args.sessionId}:${args.taskId}`,
      before,
      after: after ?? null,
    });

    nudgePusher();
    return { ok: true, task: after ?? null };
  } finally {
    inDb.close();
  }
}

export function pauseTask(args: TaskMutatorArgs, actorUserId: string): TaskMutatorResult {
  validateTaskArgs(args);

  const session = getSession(args.sessionId);
  if (!session) throw new MutatorNotFoundError(`session ${args.sessionId} not found`);
  authorizeTaskAccess(actorUserId, session.agent_group_id);

  const inDb = openSessionInboundDb(session.agent_group_id, args.sessionId);
  try {
    const before = readTaskRow(inDb, args.taskId);
    if (!before) throw new MutatorNotFoundError(`task ${args.taskId} not found`);

    pauseTaskPrim(inDb, args.taskId);
    const after = readTaskRow(inDb, args.taskId);

    // pauseTaskPrim only acts on pending rows; if the row was already paused
    // or is processing, the SQL update matches nothing and the row's status
    // is unchanged. Detect that to surface 404 rather than a misleading "ok".
    if (!after || after.status === before.status) {
      throw new MutatorNotFoundError(
        `task ${args.taskId} could not be paused (status=${before.status}; only pending tasks can be paused)`,
      );
    }

    appendAudit({
      actor_user_id: actorUserId,
      action: 'task.pause',
      target_type: 'task',
      target_id: `${args.sessionId}:${args.taskId}`,
      before,
      after,
    });

    nudgePusher();
    return { ok: true, task: after };
  } finally {
    inDb.close();
  }
}

export function resumeTask(args: TaskMutatorArgs, actorUserId: string): TaskMutatorResult {
  validateTaskArgs(args);

  const session = getSession(args.sessionId);
  if (!session) throw new MutatorNotFoundError(`session ${args.sessionId} not found`);
  authorizeTaskAccess(actorUserId, session.agent_group_id);

  const inDb = openSessionInboundDb(session.agent_group_id, args.sessionId);
  try {
    const before = readTaskRow(inDb, args.taskId);
    if (!before) throw new MutatorNotFoundError(`task ${args.taskId} not found`);

    resumeTaskPrim(inDb, args.taskId);
    const after = readTaskRow(inDb, args.taskId);

    // Same no-op detection as pauseTask: resumeTaskPrim only matches paused
    // rows, so an unchanged status means the primitive refused.
    if (!after || after.status === before.status) {
      throw new MutatorNotFoundError(
        `task ${args.taskId} could not be resumed (status=${before.status}; only paused tasks can be resumed)`,
      );
    }

    appendAudit({
      actor_user_id: actorUserId,
      action: 'task.resume',
      target_type: 'task',
      target_id: `${args.sessionId}:${args.taskId}`,
      before,
      after,
    });

    nudgePusher();
    return { ok: true, task: after };
  } finally {
    inDb.close();
  }
}

export function updateTask(args: UpdateTaskMutatorArgs, actorUserId: string): TaskMutatorResult {
  validateTaskArgs(args);

  if (args.prompt !== undefined) {
    if (typeof args.prompt !== 'string' || args.prompt.trim().length === 0) {
      throw new MutatorValidationError('prompt must be a non-empty string');
    }
  }
  if (args.recurrence !== undefined && args.recurrence !== null) {
    try {
      CronExpressionParser.parse(args.recurrence);
    } catch (err) {
      throw new MutatorValidationError(`invalid cron: ${(err as Error).message ?? String(err)}`);
    }
  }

  const session = getSession(args.sessionId);
  if (!session) throw new MutatorNotFoundError(`session ${args.sessionId} not found`);
  authorizeTaskAccess(actorUserId, session.agent_group_id);

  const inDb = openSessionInboundDb(session.agent_group_id, args.sessionId);
  try {
    const before = readTaskRow(inDb, args.taskId);
    if (!before) throw new MutatorNotFoundError(`task ${args.taskId} not found`);

    const update: TaskUpdate = {};
    if (args.prompt !== undefined) update.prompt = args.prompt;
    if (args.recurrence !== undefined) update.recurrence = args.recurrence;
    if (args.processAfter !== undefined) update.processAfter = args.processAfter;

    const touched = updateTaskPrim(inDb, args.taskId, update);
    if (touched === 0) {
      throw new MutatorNotFoundError(
        `task ${args.taskId} could not be updated (no live row in chain — likely already processed)`,
      );
    }
    const after = readTaskRow(inDb, args.taskId);

    appendAudit({
      actor_user_id: actorUserId,
      action: 'task.update',
      target_type: 'task',
      target_id: `${args.sessionId}:${args.taskId}`,
      before,
      after,
    });

    nudgePusher();
    return { ok: true, task: after ?? null };
  } finally {
    inDb.close();
  }
}
