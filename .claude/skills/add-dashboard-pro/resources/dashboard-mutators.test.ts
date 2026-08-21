import fs from 'fs';
import path from 'path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const TEST_DATA_DIR = '/tmp/nanoclaw-dashboard-mutators-test';

vi.mock('./config.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./config.js')>();
  return { ...actual, DATA_DIR: '/tmp/nanoclaw-dashboard-mutators-test' };
});

import { closeDb, createAgentGroup, initTestDb } from './db/index.js';
// Sync mirrors — assertions read committed state; see src/db/sqlite-legacy.ts.
import { getAgentGroupSync as getAgentGroup, getContainerConfigSync as getContainerConfig } from './db/sqlite-legacy.js';
import { runMigrations } from './db/migrations/index.js';
import { getRecentAudit } from './db/dashboard-audit.js';
import { createSession } from './db/sessions.js';
import { ensureSchema, openInboundDb } from './mailbox/sqlite/session-db.js';
import { createUser } from './modules/permissions/db/users.js';
import { grantRole } from './modules/permissions/db/user-roles.js';
import { addMember } from './modules/permissions/db/agent-group-members.js';
import { insertTaskRow } from './mailbox/sqlite/tasks.js';
import {
  MutatorAuthError,
  MutatorConflictError,
  MutatorNotFoundError,
  MutatorValidationError,
  cancelTask,
  pauseTask,
  resumeTask,
  renameAgentGroup,
  resolveDashboardActor,
  updateAgentGroupModel,
  updateTask,
} from './dashboard-mutators.js';

vi.mock('./dashboard-pusher.js', () => ({ nudgePusher: vi.fn() }));
vi.mock('./container-runner.js', () => ({ killContainer: vi.fn() }));

import { nudgePusher } from './dashboard-pusher.js';
import { killContainer } from './container-runner.js';

function now() {
  return new Date().toISOString();
}

async function seedAgentGroup(id: string, name: string) {
  await createAgentGroup({ id, name, folder: id, agent_provider: null, created_at: now() });
}

async function seedUserWithRole(userId: string, role: 'owner' | 'admin', scope: string | null) {
  await createUser({ id: userId, kind: 'discord', display_name: null, created_at: now() });
  await grantRole({ user_id: userId, role, agent_group_id: scope, granted_by: null, granted_at: now() });
}

async function seedUserAsMember(userId: string, agentGroupId: string) {
  await createUser({ id: userId, kind: 'discord', display_name: null, created_at: now() });
  await addMember({ user_id: userId, agent_group_id: agentGroupId, added_by: null, added_at: now() });
}

async function seedSessionWithTasks(
  sessionId: string,
  agentGroupId: string,
  taskRows: Array<{
    id: string;
    status?: 'pending' | 'paused' | 'processing' | 'completed' | 'failed';
    recurrence?: string | null;
    processAfter?: string | null;
    prompt?: string;
    script?: string | null;
    seriesId?: string;
  }>,
) {
  await createSession({
    id: sessionId,
    agent_group_id: agentGroupId,
    messaging_group_id: null,
    thread_id: null,
    agent_provider: null,
    status: 'active',
    container_status: 'stopped',
    last_active: now(),
    created_at: now(),
  } as never);

  const dir = path.join(TEST_DATA_DIR, 'v2-sessions', agentGroupId, sessionId);
  fs.mkdirSync(dir, { recursive: true });
  const dbPath = path.join(dir, 'inbound.db');
  ensureSchema(dbPath, 'inbound');
  const inDb = openInboundDb(dbPath);
  for (const row of taskRows) {
    insertTaskRow(inDb, {
      id: row.id,
      seriesId: row.seriesId ?? row.id,
      // Must stay in the FUTURE: updateTask only touches paused rows or
      // pending rows whose process_after has not passed, so a fixed literal
      // date silently expires the fixture (it did, on 2026-04-30).
      processAfter: row.processAfter ?? new Date(Date.now() + 86_400_000).toISOString(),
      recurrence: row.recurrence ?? null,
      content: JSON.stringify({ prompt: row.prompt ?? 'test prompt', script: row.script ?? null }),
    });
    // insertTaskRow creates with status='pending'; flip to whatever the test wants.
    if (row.status && row.status !== 'pending') {
      inDb.prepare('UPDATE messages_in SET status = ? WHERE id = ?').run(row.status, row.id);
    }
  }
  inDb.close();
}

beforeEach(async () => {
  await initTestDb();
  await runMigrations(await initTestDb()); // idempotent — table already there from initTestDb but migrations need to run on it
  // initTestDb returns a fresh DB; rerun to ensure migrations applied.
  vi.mocked(nudgePusher).mockClear();
  vi.mocked(killContainer).mockClear();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
});

// initTestDb is idempotent; the second call in beforeEach above just hands back
// the same handle. Migrations run against it once and don't repeat.

afterEach(async () => {
  await closeDb();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
});

describe('renameAgentGroup', () => {
  it('renames when actor is owner', async () => {
    await seedAgentGroup('ag-1', 'Old');
    await seedUserWithRole('u-owner', 'owner', null);

    const result = renameAgentGroup({ id: 'ag-1', name: 'New' }, 'u-owner');
    expect(result).toEqual({ id: 'ag-1', name: 'New' });
    expect(getAgentGroup('ag-1')!.name).toBe('New');
    expect(nudgePusher).toHaveBeenCalledTimes(1);

    const audit = getRecentAudit(10);
    expect(audit).toHaveLength(1);
    expect(audit[0].action).toBe('agent_group.rename');
    expect(audit[0].actor_user_id).toBe('u-owner');
    expect(audit[0].target_id).toBe('ag-1');
    expect(JSON.parse(audit[0].before_json!)).toEqual({ name: 'Old' });
    expect(JSON.parse(audit[0].after_json!)).toEqual({ name: 'New' });
  });

  it('renames when actor is global admin', async () => {
    await seedAgentGroup('ag-1', 'Old');
    await seedUserWithRole('u-ga', 'admin', null);
    expect(() => renameAgentGroup({ id: 'ag-1', name: 'New' }, 'u-ga')).not.toThrow();
    expect(getAgentGroup('ag-1')!.name).toBe('New');
  });

  it('renames when actor is scoped admin of this group', async () => {
    await seedAgentGroup('ag-1', 'Old');
    await seedUserWithRole('u-sa', 'admin', 'ag-1');
    expect(() => renameAgentGroup({ id: 'ag-1', name: 'New' }, 'u-sa')).not.toThrow();
  });

  it('rejects scoped admin of a DIFFERENT group', async () => {
    await seedAgentGroup('ag-1', 'Old');
    await seedAgentGroup('ag-2', 'Other');
    await seedUserWithRole('u-sa-other', 'admin', 'ag-2');
    expect(() => renameAgentGroup({ id: 'ag-1', name: 'New' }, 'u-sa-other')).toThrow(MutatorAuthError);
  });

  it('rejects unknown actor', async () => {
    await seedAgentGroup('ag-1', 'Old');
    expect(() => renameAgentGroup({ id: 'ag-1', name: 'New' }, 'nobody')).toThrow(MutatorAuthError);
  });

  it('rejects empty name', async () => {
    await seedAgentGroup('ag-1', 'Old');
    await seedUserWithRole('u-owner', 'owner', null);
    expect(() => renameAgentGroup({ id: 'ag-1', name: '' }, 'u-owner')).toThrow(MutatorValidationError);
    expect(() => renameAgentGroup({ id: 'ag-1', name: '   ' }, 'u-owner')).toThrow(MutatorValidationError);
  });

  it('rejects name longer than 80 chars', async () => {
    await seedAgentGroup('ag-1', 'Old');
    await seedUserWithRole('u-owner', 'owner', null);
    expect(() => renameAgentGroup({ id: 'ag-1', name: 'x'.repeat(81) }, 'u-owner')).toThrow(MutatorValidationError);
  });

  it('rejects name with control chars', async () => {
    await seedAgentGroup('ag-1', 'Old');
    await seedUserWithRole('u-owner', 'owner', null);
    expect(() => renameAgentGroup({ id: 'ag-1', name: 'badname' }, 'u-owner')).toThrow(MutatorValidationError);
  });

  it('rejects when name collides with another agent group', async () => {
    await seedAgentGroup('ag-1', 'Alpha');
    await seedAgentGroup('ag-2', 'Beta');
    await seedUserWithRole('u-owner', 'owner', null);
    expect(() => renameAgentGroup({ id: 'ag-1', name: 'Beta' }, 'u-owner')).toThrow(MutatorConflictError);
  });

  it('allows renaming to the SAME name (no-op, no audit row)', async () => {
    await seedAgentGroup('ag-1', 'Same');
    await seedUserWithRole('u-owner', 'owner', null);
    const result = renameAgentGroup({ id: 'ag-1', name: 'Same' }, 'u-owner');
    expect(result).toEqual({ id: 'ag-1', name: 'Same' });
    expect(getRecentAudit(10)).toHaveLength(0);
    expect(nudgePusher).not.toHaveBeenCalled();
  });

  it('throws MutatorNotFoundError for unknown agent group id', async () => {
    await seedUserWithRole('u-owner', 'owner', null);
    expect(() => renameAgentGroup({ id: 'no-such-group', name: 'X' }, 'u-owner')).toThrow(MutatorNotFoundError);
  });

  it('trims whitespace from the new name', async () => {
    await seedAgentGroup('ag-1', 'Old');
    await seedUserWithRole('u-owner', 'owner', null);
    const result = renameAgentGroup({ id: 'ag-1', name: '  Trimmed  ' }, 'u-owner');
    expect(result.name).toBe('Trimmed');
    expect(getAgentGroup('ag-1')!.name).toBe('Trimmed');
  });
});

describe('updateAgentGroupModel', () => {
  // Self-contained seeding (deliberately NOT reusing seedSessionWithTasks —
  // that helper diverges between the installed and skill-resource copies of
  // this test file; this block must stay identical in both).
  function seedBareSession(id: string, agentGroupId: string, containerStatus: 'running' | 'idle' | 'stopped') {
    createSession({
      id,
      agent_group_id: agentGroupId,
      messaging_group_id: null,
      thread_id: null,
      agent_provider: null,
      status: 'active',
      container_status: containerStatus,
      last_active: now(),
      created_at: now(),
    } as never);
  }

  it('sets a model override when actor is owner', async () => {
    await seedAgentGroup('ag-1', 'Team');
    await seedUserWithRole('u-owner', 'owner', null);

    const result = updateAgentGroupModel({ id: 'ag-1', model: 'opus' }, 'u-owner');
    expect(result).toEqual({ id: 'ag-1', model: 'opus', effort: null, killed: 0 });
    expect(getAgentGroup('ag-1')!.model).toBe('opus');
    expect(nudgePusher).toHaveBeenCalledTimes(1);
    expect(killContainer).not.toHaveBeenCalled();

    const audit = getRecentAudit(10);
    expect(audit).toHaveLength(1);
    expect(audit[0].action).toBe('agent_group.set_model');
    expect(audit[0].actor_user_id).toBe('u-owner');
    expect(audit[0].target_id).toBe('ag-1');
    expect(JSON.parse(audit[0].before_json!)).toEqual({ model: null });
    expect(JSON.parse(audit[0].after_json!)).toEqual({ model: 'opus' });
  });

  it('clears the override with model: null', async () => {
    await seedAgentGroup('ag-1', 'Team');
    await seedUserWithRole('u-owner', 'owner', null);
    updateAgentGroupModel({ id: 'ag-1', model: 'haiku' }, 'u-owner');

    const result = updateAgentGroupModel({ id: 'ag-1', model: null }, 'u-owner');
    expect(result.model).toBeNull();
    expect(getAgentGroup('ag-1')!.model).toBeNull();

    const audit = getRecentAudit(10);
    expect(audit).toHaveLength(2);
    expect(JSON.parse(audit[0].before_json!)).toEqual({ model: 'haiku' });
    expect(JSON.parse(audit[0].after_json!)).toEqual({ model: null });
  });

  it('trims whitespace and treats empty/blank string as clear', async () => {
    await seedAgentGroup('ag-1', 'Team');
    await seedUserWithRole('u-owner', 'owner', null);

    expect(updateAgentGroupModel({ id: 'ag-1', model: '  sonnet[1m]  ' }, 'u-owner').model).toBe('sonnet[1m]');
    expect(getAgentGroup('ag-1')!.model).toBe('sonnet[1m]');

    expect(updateAgentGroupModel({ id: 'ag-1', model: '   ' }, 'u-owner').model).toBeNull();
    expect(getAgentGroup('ag-1')!.model).toBeNull();
  });

  it('rejects non-string non-null model', async () => {
    await seedAgentGroup('ag-1', 'Team');
    await seedUserWithRole('u-owner', 'owner', null);
    expect(() => updateAgentGroupModel({ id: 'ag-1', model: 42 as never }, 'u-owner')).toThrow(MutatorValidationError);
  });

  it('rejects model longer than 120 chars or with control chars', async () => {
    await seedAgentGroup('ag-1', 'Team');
    await seedUserWithRole('u-owner', 'owner', null);
    expect(() => updateAgentGroupModel({ id: 'ag-1', model: 'x'.repeat(121) }, 'u-owner')).toThrow(
      MutatorValidationError,
    );
    expect(() => updateAgentGroupModel({ id: 'ag-1', model: 'badmodel' }, 'u-owner')).toThrow(MutatorValidationError);
  });

  it('allows scoped admin of this group and global admin', async () => {
    await seedAgentGroup('ag-1', 'Team');
    await seedUserWithRole('u-sa', 'admin', 'ag-1');
    await seedUserWithRole('u-ga', 'admin', null);
    expect(() => updateAgentGroupModel({ id: 'ag-1', model: 'haiku' }, 'u-sa')).not.toThrow();
    expect(() => updateAgentGroupModel({ id: 'ag-1', model: 'opus' }, 'u-ga')).not.toThrow();
  });

  it('rejects unknown actor and scoped admin of a DIFFERENT group', async () => {
    await seedAgentGroup('ag-1', 'Team');
    await seedAgentGroup('ag-2', 'Other');
    await seedUserWithRole('u-sa-other', 'admin', 'ag-2');
    expect(() => updateAgentGroupModel({ id: 'ag-1', model: 'opus' }, 'nobody')).toThrow(MutatorAuthError);
    expect(() => updateAgentGroupModel({ id: 'ag-1', model: 'opus' }, 'u-sa-other')).toThrow(MutatorAuthError);
  });

  it('throws MutatorNotFoundError for unknown agent group id', async () => {
    await seedUserWithRole('u-owner', 'owner', null);
    expect(() => updateAgentGroupModel({ id: 'no-such-group', model: 'opus' }, 'u-owner')).toThrow(
      MutatorNotFoundError,
    );
  });

  it('no-op (unchanged model, no restart) writes no audit and no nudge', async () => {
    await seedAgentGroup('ag-1', 'Team');
    await seedUserWithRole('u-owner', 'owner', null);
    const result = updateAgentGroupModel({ id: 'ag-1', model: null }, 'u-owner');
    expect(result).toEqual({ id: 'ag-1', model: null, effort: null, killed: 0 });
    expect(getRecentAudit(10)).toHaveLength(0);
    expect(nudgePusher).not.toHaveBeenCalled();
  });

  it('restart kills only running/idle containers of the group', async () => {
    await seedAgentGroup('ag-1', 'Team');
    await seedUserWithRole('u-owner', 'owner', null);
    seedBareSession('s-run', 'ag-1', 'running');
    seedBareSession('s-idle', 'ag-1', 'idle');
    seedBareSession('s-stop', 'ag-1', 'stopped');

    const result = updateAgentGroupModel({ id: 'ag-1', model: 'haiku', restart: true }, 'u-owner');
    expect(result.killed).toBe(2);
    expect(killContainer).toHaveBeenCalledTimes(2);
    const killedIds = vi.mocked(killContainer).mock.calls.map((c) => c[0]);
    expect(killedIds.sort()).toEqual(['s-idle', 's-run']);
    expect(nudgePusher).toHaveBeenCalledTimes(1);
  });

  it('restart with unchanged model still kills, but writes no audit', async () => {
    await seedAgentGroup('ag-1', 'Team');
    await seedUserWithRole('u-owner', 'owner', null);
    seedBareSession('s-run', 'ag-1', 'running');

    const result = updateAgentGroupModel({ id: 'ag-1', model: null, restart: true }, 'u-owner');
    expect(result).toEqual({ id: 'ag-1', model: null, effort: null, killed: 1 });
    expect(killContainer).toHaveBeenCalledTimes(1);
    expect(getRecentAudit(10)).toHaveLength(0);
    expect(nudgePusher).toHaveBeenCalledTimes(1);
  });

  it('sets effort into container_configs with its own audit row', async () => {
    await seedAgentGroup('ag-1', 'Team');
    await seedUserWithRole('u-owner', 'owner', null);

    const result = updateAgentGroupModel({ id: 'ag-1', model: null, effort: 'medium' }, 'u-owner');
    expect(result).toEqual({ id: 'ag-1', model: null, effort: 'medium', killed: 0 });
    expect(getContainerConfig('ag-1')!.effort).toBe('medium');
    expect(nudgePusher).toHaveBeenCalledTimes(1);

    const audit = getRecentAudit(10);
    expect(audit).toHaveLength(1);
    expect(audit[0].action).toBe('agent_group.set_effort');
    expect(JSON.parse(audit[0].before_json!)).toEqual({ effort: null });
    expect(JSON.parse(audit[0].after_json!)).toEqual({ effort: 'medium' });
  });

  it('changes model and effort together in one call — two audit rows', async () => {
    await seedAgentGroup('ag-1', 'Team');
    await seedUserWithRole('u-owner', 'owner', null);

    const result = updateAgentGroupModel({ id: 'ag-1', model: 'opus', effort: 'xhigh' }, 'u-owner');
    expect(result).toEqual({ id: 'ag-1', model: 'opus', effort: 'xhigh', killed: 0 });
    expect(getAgentGroup('ag-1')!.model).toBe('opus');
    expect(getContainerConfig('ag-1')!.effort).toBe('xhigh');

    const actions = getRecentAudit(10).map((a) => a.action);
    expect(actions.sort()).toEqual(['agent_group.set_effort', 'agent_group.set_model']);
    expect(nudgePusher).toHaveBeenCalledTimes(1);
  });

  it('clears effort with null / blank, lowercases and trims input', async () => {
    await seedAgentGroup('ag-1', 'Team');
    await seedUserWithRole('u-owner', 'owner', null);
    updateAgentGroupModel({ id: 'ag-1', model: null, effort: '  HIGH ' }, 'u-owner');
    expect(getContainerConfig('ag-1')!.effort).toBe('high');

    const result = updateAgentGroupModel({ id: 'ag-1', model: null, effort: null }, 'u-owner');
    expect(result.effort).toBeNull();
    expect(getContainerConfig('ag-1')!.effort).toBeNull();

    updateAgentGroupModel({ id: 'ag-1', model: null, effort: 'low' }, 'u-owner');
    expect(updateAgentGroupModel({ id: 'ag-1', model: null, effort: '   ' }, 'u-owner').effort).toBeNull();
    expect(getContainerConfig('ag-1')!.effort).toBeNull();
  });

  it('absent effort field leaves the stored effort untouched', async () => {
    await seedAgentGroup('ag-1', 'Team');
    await seedUserWithRole('u-owner', 'owner', null);
    updateAgentGroupModel({ id: 'ag-1', model: null, effort: 'max' }, 'u-owner');
    vi.mocked(nudgePusher).mockClear();

    const result = updateAgentGroupModel({ id: 'ag-1', model: 'sonnet' }, 'u-owner');
    expect(result.effort).toBe('max');
    expect(getContainerConfig('ag-1')!.effort).toBe('max');
    // Only the model audit row was added.
    const actions = getRecentAudit(10).map((a) => a.action);
    expect(actions.filter((a) => a === 'agent_group.set_effort')).toHaveLength(1);
  });

  it('unchanged effort writes no audit and no nudge', async () => {
    await seedAgentGroup('ag-1', 'Team');
    await seedUserWithRole('u-owner', 'owner', null);
    updateAgentGroupModel({ id: 'ag-1', model: null, effort: 'high' }, 'u-owner');
    vi.mocked(nudgePusher).mockClear();

    const result = updateAgentGroupModel({ id: 'ag-1', model: null, effort: 'high' }, 'u-owner');
    expect(result.effort).toBe('high');
    expect(getRecentAudit(10)).toHaveLength(1); // just the original set
    expect(nudgePusher).not.toHaveBeenCalled();
  });

  it('rejects non-string non-null effort and over-long/control-char effort', async () => {
    await seedAgentGroup('ag-1', 'Team');
    await seedUserWithRole('u-owner', 'owner', null);
    expect(() => updateAgentGroupModel({ id: 'ag-1', model: null, effort: 42 as never }, 'u-owner')).toThrow(
      MutatorValidationError,
    );
    expect(() => updateAgentGroupModel({ id: 'ag-1', model: null, effort: 'x'.repeat(41) }, 'u-owner')).toThrow(
      MutatorValidationError,
    );
    expect(() => updateAgentGroupModel({ id: 'ag-1', model: null, effort: 'hi\x01gh' }, 'u-owner')).toThrow(
      MutatorValidationError,
    );
  });
});

describe('resolveDashboardActor', () => {
  it('returns the install owner', async () => {
    await seedUserWithRole('u-owner', 'owner', null);
    const result = resolveDashboardActor({} as never);
    expect(result).toBe('u-owner');
  });

  it('returns undefined when no owner is set', async () => {
    const result = resolveDashboardActor({} as never);
    expect(result).toBeUndefined();
  });
});

describe('cancelTask', () => {
  it('rejects missing taskId or sessionId', async () => {
    await seedUserWithRole('u-owner', 'owner', null);
    expect(() => cancelTask({ taskId: '', sessionId: 's1' }, 'u-owner')).toThrow(MutatorValidationError);
    expect(() => cancelTask({ taskId: 't1', sessionId: '' }, 'u-owner')).toThrow(MutatorValidationError);
  });

  it('throws not-found when session does not exist', async () => {
    await seedUserWithRole('u-owner', 'owner', null);
    expect(() => cancelTask({ taskId: 't1', sessionId: 'no-such' }, 'u-owner')).toThrow(MutatorNotFoundError);
  });

  it('throws auth when actor cannot access the agent group', async () => {
    await seedAgentGroup('ag-1', 'Group A');
    await seedAgentGroup('ag-2', 'Group B');
    await seedUserAsMember('u-other', 'ag-2'); // member of a DIFFERENT group
    await seedSessionWithTasks('s1', 'ag-1', [{ id: 't1', status: 'pending' }]);
    expect(() => cancelTask({ taskId: 't1', sessionId: 's1' }, 'u-other')).toThrow(MutatorAuthError);
  });

  it('throws auth for unknown user', async () => {
    await seedAgentGroup('ag-1', 'Group A');
    await seedSessionWithTasks('s1', 'ag-1', [{ id: 't1', status: 'pending' }]);
    expect(() => cancelTask({ taskId: 't1', sessionId: 's1' }, 'u-nobody')).toThrow(MutatorAuthError);
  });

  it('throws not-found when task does not exist in inbound.db', async () => {
    await seedAgentGroup('ag-1', 'Group A');
    await seedUserWithRole('u-owner', 'owner', null);
    await seedSessionWithTasks('s1', 'ag-1', []);
    expect(() => cancelTask({ taskId: 'no-such', sessionId: 's1' }, 'u-owner')).toThrow(MutatorNotFoundError);
  });

  it('throws not-found (no-op) when task is processing', async () => {
    await seedAgentGroup('ag-1', 'Group A');
    await seedUserWithRole('u-owner', 'owner', null);
    await seedSessionWithTasks('s1', 'ag-1', [{ id: 't-proc', status: 'processing' }]);
    expect(() => cancelTask({ taskId: 't-proc', sessionId: 's1' }, 'u-owner')).toThrow(MutatorNotFoundError);
  });

  it('cancels a pending task and writes audit', async () => {
    await seedAgentGroup('ag-1', 'Group A');
    await seedUserWithRole('u-owner', 'owner', null);
    await seedSessionWithTasks('s1', 'ag-1', [{ id: 't-pending', status: 'pending', recurrence: '0 9 * * *' }]);

    const r = cancelTask({ taskId: 't-pending', sessionId: 's1' }, 'u-owner');
    expect(r.ok).toBe(true);
    expect(r.task?.status).toBe('cancelled');
    expect(r.task?.recurrence).toBeNull();

    expect(nudgePusher).toHaveBeenCalledTimes(1);

    const audit = getRecentAudit(10);
    expect(audit).toHaveLength(1);
    expect(audit[0].action).toBe('task.cancel');
    expect(audit[0].target_type).toBe('task');
    expect(audit[0].target_id).toBe('s1:t-pending');
    expect(JSON.parse(audit[0].before_json!).status).toBe('pending');
    expect(JSON.parse(audit[0].after_json!).status).toBe('cancelled');
  });

  it('cancels a paused task', async () => {
    await seedAgentGroup('ag-1', 'Group A');
    await seedUserAsMember('u-member', 'ag-1');
    await seedSessionWithTasks('s1', 'ag-1', [{ id: 't-paused', status: 'paused' }]);

    const r = cancelTask({ taskId: 't-paused', sessionId: 's1' }, 'u-member');
    expect(r.task?.status).toBe('cancelled');
  });

  it('allows scoped admin of the agent group', async () => {
    await seedAgentGroup('ag-1', 'Group A');
    await seedUserWithRole('u-sa', 'admin', 'ag-1');
    await seedSessionWithTasks('s1', 'ag-1', [{ id: 't1', status: 'pending' }]);
    expect(() => cancelTask({ taskId: 't1', sessionId: 's1' }, 'u-sa')).not.toThrow();
  });
});

describe('pauseTask', () => {
  it('pauses a pending task and writes audit', async () => {
    await seedAgentGroup('ag-1', 'Group A');
    await seedUserAsMember('u-member', 'ag-1');
    await seedSessionWithTasks('s1', 'ag-1', [{ id: 't1', status: 'pending' }]);

    const r = pauseTask({ taskId: 't1', sessionId: 's1' }, 'u-member');
    expect(r.task?.status).toBe('paused');

    const audit = getRecentAudit(10);
    expect(audit[0].action).toBe('task.pause');
    expect(audit[0].target_id).toBe('s1:t1');
  });

  it('throws not-found for already-paused task (pauseTask refuses)', async () => {
    await seedAgentGroup('ag-1', 'Group A');
    await seedUserWithRole('u-owner', 'owner', null);
    await seedSessionWithTasks('s1', 'ag-1', [{ id: 't1', status: 'paused' }]);
    expect(() => pauseTask({ taskId: 't1', sessionId: 's1' }, 'u-owner')).toThrow(MutatorNotFoundError);
  });

  it('throws not-found for processing task', async () => {
    await seedAgentGroup('ag-1', 'Group A');
    await seedUserWithRole('u-owner', 'owner', null);
    await seedSessionWithTasks('s1', 'ag-1', [{ id: 't1', status: 'processing' }]);
    expect(() => pauseTask({ taskId: 't1', sessionId: 's1' }, 'u-owner')).toThrow(MutatorNotFoundError);
  });

  it('rejects unauthorized actor', async () => {
    await seedAgentGroup('ag-1', 'Group A');
    await seedAgentGroup('ag-2', 'Group B');
    await seedUserAsMember('u-other', 'ag-2');
    await seedSessionWithTasks('s1', 'ag-1', [{ id: 't1', status: 'pending' }]);
    expect(() => pauseTask({ taskId: 't1', sessionId: 's1' }, 'u-other')).toThrow(MutatorAuthError);
  });
});

describe('resumeTask', () => {
  it('resumes a paused task and writes audit', async () => {
    await seedAgentGroup('ag-1', 'Group A');
    await seedUserAsMember('u-member', 'ag-1');
    await seedSessionWithTasks('s1', 'ag-1', [{ id: 't1', status: 'paused' }]);

    const r = resumeTask({ taskId: 't1', sessionId: 's1' }, 'u-member');
    expect(r.task?.status).toBe('pending');

    const audit = getRecentAudit(10);
    expect(audit[0].action).toBe('task.resume');
    expect(audit[0].target_id).toBe('s1:t1');
  });

  it('throws not-found for already-pending task (resumeTask refuses)', async () => {
    await seedAgentGroup('ag-1', 'Group A');
    await seedUserWithRole('u-owner', 'owner', null);
    await seedSessionWithTasks('s1', 'ag-1', [{ id: 't1', status: 'pending' }]);
    expect(() => resumeTask({ taskId: 't1', sessionId: 's1' }, 'u-owner')).toThrow(MutatorNotFoundError);
  });

  it('rejects unauthorized actor', async () => {
    await seedAgentGroup('ag-1', 'Group A');
    await seedAgentGroup('ag-2', 'Group B');
    await seedUserAsMember('u-other', 'ag-2');
    await seedSessionWithTasks('s1', 'ag-1', [{ id: 't1', status: 'paused' }]);
    expect(() => resumeTask({ taskId: 't1', sessionId: 's1' }, 'u-other')).toThrow(MutatorAuthError);
  });
});

describe('updateTask', () => {
  it('rejects empty prompt', async () => {
    await seedAgentGroup('ag-1', 'Group A');
    await seedUserWithRole('u-owner', 'owner', null);
    await seedSessionWithTasks('s1', 'ag-1', [{ id: 't1', status: 'pending' }]);
    expect(() => updateTask({ taskId: 't1', sessionId: 's1', prompt: '' }, 'u-owner')).toThrow(MutatorValidationError);
    expect(() => updateTask({ taskId: 't1', sessionId: 's1', prompt: '   ' }, 'u-owner')).toThrow(
      MutatorValidationError,
    );
  });

  it('rejects malformed cron', async () => {
    await seedAgentGroup('ag-1', 'Group A');
    await seedUserWithRole('u-owner', 'owner', null);
    await seedSessionWithTasks('s1', 'ag-1', [{ id: 't1', status: 'pending' }]);
    expect(() => updateTask({ taskId: 't1', sessionId: 's1', recurrence: 'not-a-cron' }, 'u-owner')).toThrow(
      MutatorValidationError,
    );
  });

  it('throws not-found when task does not exist', async () => {
    await seedAgentGroup('ag-1', 'Group A');
    await seedUserWithRole('u-owner', 'owner', null);
    await seedSessionWithTasks('s1', 'ag-1', []);
    expect(() => updateTask({ taskId: 'no-such', sessionId: 's1', prompt: 'new' }, 'u-owner')).toThrow(
      MutatorNotFoundError,
    );
  });

  it('updates prompt and writes audit with diff', async () => {
    await seedAgentGroup('ag-1', 'Group A');
    await seedUserWithRole('u-owner', 'owner', null);
    await seedSessionWithTasks('s1', 'ag-1', [{ id: 't1', status: 'pending', prompt: 'original' }]);

    const r = updateTask({ taskId: 't1', sessionId: 's1', prompt: 'new prompt' }, 'u-owner');
    expect(JSON.parse(r.task!.content).prompt).toBe('new prompt');

    const audit = getRecentAudit(10);
    expect(audit[0].action).toBe('task.update');
    expect(JSON.parse(JSON.parse(audit[0].before_json!).content).prompt).toBe('original');
    expect(JSON.parse(JSON.parse(audit[0].after_json!).content).prompt).toBe('new prompt');
  });

  it('updates recurrence with valid cron', async () => {
    await seedAgentGroup('ag-1', 'Group A');
    await seedUserWithRole('u-owner', 'owner', null);
    await seedSessionWithTasks('s1', 'ag-1', [{ id: 't1', status: 'pending', recurrence: '0 9 * * *' }]);

    const r = updateTask({ taskId: 't1', sessionId: 's1', recurrence: '0 8 * * 1' }, 'u-owner');
    expect(r.task?.recurrence).toBe('0 8 * * 1');
  });

  it('clears recurrence when null is passed (recurring → one-shot)', async () => {
    await seedAgentGroup('ag-1', 'Group A');
    await seedUserWithRole('u-owner', 'owner', null);
    await seedSessionWithTasks('s1', 'ag-1', [{ id: 't1', status: 'pending', recurrence: '0 9 * * *' }]);

    const r = updateTask({ taskId: 't1', sessionId: 's1', recurrence: null }, 'u-owner');
    expect(r.task?.recurrence).toBeNull();
  });

  it('rejects unauthorized actor', async () => {
    await seedAgentGroup('ag-1', 'Group A');
    await seedAgentGroup('ag-2', 'Group B');
    await seedUserAsMember('u-other', 'ag-2');
    await seedSessionWithTasks('s1', 'ag-1', [{ id: 't1', status: 'pending' }]);
    expect(() => updateTask({ taskId: 't1', sessionId: 's1', prompt: 'new' }, 'u-other')).toThrow(MutatorAuthError);
  });
});
