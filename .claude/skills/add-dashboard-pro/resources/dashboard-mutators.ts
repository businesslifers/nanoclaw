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

import { appendAudit } from './db/dashboard-audit.js';
import { getAgentGroup, updateAgentGroup } from './db/agent-groups.js';
import { getDb } from './db/connection.js';
import { hasAdminPrivilege } from './modules/permissions/db/user-roles.js';
import { getOwners } from './modules/permissions/db/user-roles.js';
import { nudgePusher } from './dashboard-pusher.js';

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
const CONTROL_CHAR_RE = /[\x00-\x1f\x7f]/;

function validateName(raw: unknown): string {
  if (typeof raw !== 'string') throw new MutatorValidationError('name must be a string');
  const trimmed = raw.trim();
  if (trimmed.length === 0) throw new MutatorValidationError('name must not be empty');
  if (trimmed.length > NAME_MAX) throw new MutatorValidationError(`name exceeds ${NAME_MAX} chars`);
  if (CONTROL_CHAR_RE.test(trimmed)) throw new MutatorValidationError('name contains control characters');
  return trimmed;
}

export interface RenameAgentGroupArgs {
  id: string;
  name: string;
}

export interface MutatorContext {
  /** Resolves an inbound HTTP request to a NanoClaw user_id, or undefined if no actor can be inferred. */
  resolveActor(req: IncomingMessage): string | undefined;
  mutators: {
    renameAgentGroup(args: RenameAgentGroupArgs, actorUserId: string): { id: string; name: string };
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

/** The mutator bundle the host hands to the dashboard server. */
export function buildDashboardMutatorContext(): MutatorContext {
  return {
    resolveActor: resolveDashboardActor,
    mutators: {
      renameAgentGroup,
    },
  };
}
