/**
 * Synchronous central-DB access for the two fork surfaces that cannot be async.
 *
 * `@nanoco/nanoclaw-dashboard` is synchronous end to end: `dispatchMutating`
 * does `const after = fn(...)` and serializes `after` directly, and the
 * permission callback runs inside an `Array.prototype.filter`. Handing it an
 * async callback would serialize `{}` for every mutation, turn a rejection
 * into an unhandled rejection behind an `ok: true` response, and make every
 * Promise truthy in the permission filter.
 *
 * The work-item module shares the constraint: its mutation entry points are
 * called from the dashboard's sync mutators AND from the async delivery-action
 * path, and only a sync function can serve both.
 *
 * Upstream's central-DB wrappers are all async now (`DbDriver`), so these
 * surfaces read through this module instead: the SAME connection the driver
 * holds, taken raw via `sqliteRaw(getDb())`. Not a second handle, not a cache
 * — every call queries live state.
 *
 * Each function below mirrors, verbatim, the SQL of the async wrapper it
 * shadows. When one of those changes upstream, change it here too; the pairing
 * is named in each function's comment so a grep for the async name finds this
 * file. Only the dashboard and work-item surfaces may import from here —
 * everything else uses the canonical async wrappers.
 */
import { DEFAULT_AGENT_PROVIDER } from './config.js';
import { configFromDb, emptyConfig, type ContainerConfig } from './container-config.js';
import type Database from 'better-sqlite3';

import { getDb } from './db/connection.js';
import { sqliteRaw } from './db/drivers/sqlite.js';
import type {
  AgentGroup,
  AgentDestination,
  AgentGroupMember,
  ContainerConfigRow,
  MessagingGroup,
  MessagingGroupAgent,
  Session,
  User,
  UserDm,
  UserRole,
} from './types.js';

function raw() {
  return sqliteRaw(getDb());
}

/** Shadows `getAllAgentGroups` (src/db/agent-groups.ts). */
export function getAllAgentGroupsSync(): AgentGroup[] {
  return raw().prepare('SELECT * FROM agent_groups ORDER BY name').all() as AgentGroup[];
}

/** Shadows `getAgentGroup` (src/db/agent-groups.ts). */
export function getAgentGroupSync(id: string): AgentGroup | undefined {
  return raw().prepare('SELECT * FROM agent_groups WHERE id = ?').get(id) as AgentGroup | undefined;
}

/** Shadows `getSession` (src/db/sessions.ts). */
export function getSessionSync(id: string): Session | undefined {
  return raw().prepare('SELECT * FROM sessions WHERE id = ?').get(id) as Session | undefined;
}

/** Shadows `getSessionsByAgentGroup` (src/db/sessions.ts). */
export function getSessionsByAgentGroupSync(agentGroupId: string): Session[] {
  return raw().prepare('SELECT * FROM sessions WHERE agent_group_id = ?').all(agentGroupId) as Session[];
}

/** Shadows `getAllMessagingGroups` (src/db/messaging-groups.ts). */
export function getAllMessagingGroupsSync(): MessagingGroup[] {
  return raw().prepare('SELECT * FROM messaging_groups ORDER BY name').all() as MessagingGroup[];
}

/** Shadows `getMessagingGroupAgents` (src/db/messaging-groups.ts). */
export function getMessagingGroupAgentsSync(messagingGroupId: string): MessagingGroupAgent[] {
  return raw()
    .prepare('SELECT * FROM messaging_group_agents WHERE messaging_group_id = ? ORDER BY priority DESC, id')
    .all(messagingGroupId) as MessagingGroupAgent[];
}

/** Shadows `getContainerConfig` (src/db/container-configs.ts). */
export function getContainerConfigSync(agentGroupId: string): ContainerConfigRow | undefined {
  return raw().prepare('SELECT * FROM container_configs WHERE agent_group_id = ?').get(agentGroupId) as
    | ContainerConfigRow
    | undefined;
}

/** Shadows `getMembers` (src/modules/permissions/db/agent-group-members.ts). */
export function getMembersSync(agentGroupId: string): AgentGroupMember[] {
  return raw()
    .prepare('SELECT * FROM agent_group_members WHERE agent_group_id = ? ORDER BY added_at')
    .all(agentGroupId) as AgentGroupMember[];
}

/** Shadows `getUser` (src/modules/permissions/db/users.ts). */
export function getUserSync(id: string): User | undefined {
  return raw().prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
}

/** Shadows `getAllUsers` (src/modules/permissions/db/users.ts). */
export function getAllUsersSync(): User[] {
  return raw().prepare('SELECT * FROM users ORDER BY created_at').all() as User[];
}

/** Shadows `getUserRoles` (src/modules/permissions/db/user-roles.ts). */
export function getUserRolesSync(userId: string): UserRole[] {
  return raw().prepare('SELECT * FROM user_roles WHERE user_id = ?').all(userId) as UserRole[];
}

/** Shadows `getOwners` (src/modules/permissions/db/user-roles.ts). */
export function getOwnersSync(): UserRole[] {
  return raw()
    .prepare('SELECT * FROM user_roles WHERE role = ? AND agent_group_id IS NULL ORDER BY granted_at')
    .all('owner') as UserRole[];
}

/** Shadows `getAdminsOfAgentGroup` (src/modules/permissions/db/user-roles.ts). */
export function getAdminsOfAgentGroupSync(agentGroupId: string): UserRole[] {
  return raw()
    .prepare('SELECT * FROM user_roles WHERE role = ? AND agent_group_id = ? ORDER BY granted_at')
    .all('admin', agentGroupId) as UserRole[];
}

/** Shadows `hasAdminPrivilege` (src/modules/permissions/db/user-roles.ts): owner OR global admin OR scoped admin. */
export function hasAdminPrivilegeSync(userId: string, agentGroupId: string): boolean {
  const row = raw()
    .prepare(
      `SELECT 1 FROM user_roles
        WHERE user_id = ?
          AND (
            (role = 'owner' AND agent_group_id IS NULL)
            OR (role = 'admin' AND agent_group_id IS NULL)
            OR (role = 'admin' AND agent_group_id = ?)
          )
        LIMIT 1`,
    )
    .get(userId, agentGroupId);
  return row !== undefined;
}

/** Shadows `getUserDmsForUser` (src/modules/permissions/db/user-dms.ts). */
export function getUserDmsForUserSync(userId: string): UserDm[] {
  return raw().prepare('SELECT * FROM user_dms WHERE user_id = ?').all(userId) as UserDm[];
}

/** Shadows `findSessionByAgentGroup` (src/db/sessions.ts). */
export function findSessionByAgentGroupSync(agentGroupId: string): Session | undefined {
  return raw()
    .prepare(
      `SELECT * FROM sessions
       WHERE agent_group_id = ?
         AND status = 'active'
         AND NOT (messaging_group_id IS NULL AND thread_id IS NOT NULL AND thread_id LIKE 'system:%')
       ORDER BY created_at DESC
       LIMIT 1`,
    )
    .get(agentGroupId) as Session | undefined;
}

/** Shadows `getDestinations` (src/modules/agent-to-agent/db/agent-destinations.ts). */
export function getDestinationsSync(agentGroupId: string): AgentDestination[] {
  return raw()
    .prepare('SELECT * FROM agent_destinations WHERE agent_group_id = ?')
    .all(agentGroupId) as AgentDestination[];
}

/** Shadows `hasTable` (src/db/connection.ts) for the sync surfaces. */
export function hasTableSync(name: string): boolean {
  const row = raw().prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name);
  return row !== undefined;
}

/** The driver's raw better-sqlite3 handle, for one-off queries on the sync surfaces. */
export function rawDb(): Database.Database {
  return raw();
}

// ---------------------------------------------------------------------------
// Writers.
//
// The dashboard's mutator callbacks are synchronous (see the header), so its
// writes cannot go through the async wrappers either. Each mirrors its async
// twin's SQL. `runInTransaction` wraps a mutation + its audit row so the two
// land together; it uses better-sqlite3's own transaction helper rather than a
// raw BEGIN, which would throw if a driver transaction were already open.
// ---------------------------------------------------------------------------

const SCALAR_COLUMNS_SYNC = new Set([
  'provider',
  'model',
  'effort',
  'image_tag',
  'assistant_name',
  'max_messages_per_prompt',
  'cli_scope',
  'timezone',
]);

/** Run `fn` inside one SQLite transaction on the driver's own connection. */
export function runInTransaction(fn: () => void): void {
  raw().transaction(fn)();
}

/** Shadows `updateAgentGroup` (src/db/agent-groups.ts). */
export function updateAgentGroupSync(
  id: string,
  updates: Partial<Pick<AgentGroup, 'name' | 'agent_provider' | 'model' | 'hidden_in_dashboard'>>,
): void {
  const fields: string[] = [];
  const values: Record<string, unknown> = { id };
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      fields.push(`${key} = @${key}`);
      values[key] = value;
    }
  }
  if (fields.length === 0) return;
  raw()
    .prepare(`UPDATE agent_groups SET ${fields.join(', ')} WHERE id = @id`)
    .run(values);
}

/** Shadows `ensureContainerConfig` (src/db/container-configs.ts). */
export function ensureContainerConfigSync(agentGroupId: string, provider?: string | null): void {
  const normalized = (provider ?? DEFAULT_AGENT_PROVIDER).toLowerCase();
  const stamped = normalized && normalized !== 'claude' ? normalized : null;
  raw()
    .prepare(
      `INSERT INTO container_configs (agent_group_id, provider, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT (agent_group_id) DO NOTHING`,
    )
    .run(agentGroupId, stamped, new Date().toISOString());
}

/** Shadows `updateContainerConfigScalars` (src/db/container-configs.ts). */
export function updateContainerConfigScalarsSync(
  agentGroupId: string,
  updates: Partial<
    Pick<
      ContainerConfigRow,
      | 'provider'
      | 'model'
      | 'effort'
      | 'image_tag'
      | 'assistant_name'
      | 'max_messages_per_prompt'
      | 'cli_scope'
      | 'timezone'
    >
  >,
): void {
  const fields: string[] = [];
  const values: Record<string, unknown> = { agent_group_id: agentGroupId };
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      if (!SCALAR_COLUMNS_SYNC.has(key)) throw new Error(`Invalid scalar column: ${key}`);
      fields.push(`${key} = @${key}`);
      values[key] = value;
    }
  }
  if (fields.length === 0) return;
  fields.push('updated_at = @updated_at');
  values.updated_at = new Date().toISOString();
  raw()
    .prepare(`UPDATE container_configs SET ${fields.join(', ')} WHERE agent_group_id = @agent_group_id`)
    .run(values);
}

/** Shadows `getLiveContainerConfig` (src/container-config.ts). */
export function getLiveContainerConfigSync(agentGroupId: string): ContainerConfig {
  const group = getAgentGroupSync(agentGroupId);
  const row = getContainerConfigSync(agentGroupId);
  if (!group || !row) return emptyConfig();
  return configFromDb(row, group);
}
