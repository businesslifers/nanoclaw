/**
 * Synchronous SQLite handle for this install's local-only modules.
 *
 * Upstream's central-database boundary is the async `DbDriver` (see
 * docs/central-db-async-migration.md). The dashboard-pro and work-item
 * modules on this fork were written against the pre-2.3 synchronous
 * better-sqlite3 surface and are deliberately kept SQLite-only rather than
 * being rewritten statement-by-statement: they run only here, and this
 * install's central DB is the default SQLite `data/v2.db`.
 *
 * Rules for using this:
 * - New code should use the async `DbDriver` from `getDb()` instead.
 * - Never mix a raw transaction with an open `DbDriver.transaction()` scope —
 *   they are separate SQLite transactions on the same connection.
 * - It throws if a non-SQLite central driver is ever composed, which is the
 *   intended failure: it names the module that needs porting.
 */
import type { Database as SqliteDatabase } from 'better-sqlite3';

import { getDb } from './connection.js';
import { sqliteRaw } from './drivers/sqlite.js';

export function getRawDb(): SqliteDatabase {
  return sqliteRaw(getDb());
}

/*
 * Synchronous mirrors of the central-DB reads/writes the dashboard surface
 * needs.
 *
 * `@nanoco/nanoclaw-dashboard` declares its mutator and permissions contracts
 * as SYNCHRONOUS functions (dist/types.d.ts `DashboardMutators`,
 * `DashboardPermissions`), so the dashboard-pro modules on this fork cannot
 * await the async `DbDriver`. Each helper below is a literal transcription of
 * its async counterpart's SQL — keep them in lockstep when the async version
 * changes:
 *
 *   getAllAgentGroupsSync / getAgentGroupSync  ← src/db/agent-groups.ts
 *   updateAgentGroupSync                       ← src/db/agent-groups.ts
 *   getSessionSync / getSessionsByAgentGroupSync ← src/db/sessions.ts
 *   getAllUsersSync / getUserSync              ← src/modules/permissions/db/users.ts
 *   getUserRolesSync / getOwnersSync / hasAdminPrivilegeSync
 *                                              ← src/modules/permissions/db/user-roles.ts
 *   getMembersSync                             ← src/modules/permissions/db/agent-group-members.ts
 *   getUserDmsForUserSync                      ← src/modules/permissions/db/user-dms.ts
 *   getAllMessagingGroupsSync / getMessagingGroupAgentsSync ← src/db/messaging-groups.ts
 *   getDestinationsSync                        ← src/modules/agent-to-agent/db/agent-destinations.ts
 *   getContainerConfigSync / ensureContainerConfigSync / updateContainerConfigScalarsSync
 *                                              ← src/db/container-configs.ts
 */
import { DEFAULT_AGENT_PROVIDER } from '../config.js';
import type {
  AgentDestination,
  AgentGroup,
  AgentGroupMember,
  ContainerConfigRow,
  MessagingGroup,
  MessagingGroupAgent,
  Session,
  User,
  UserDm,
  UserRole,
} from '../types.js';

export function getAllAgentGroupsSync(): AgentGroup[] {
  return getRawDb().prepare('SELECT * FROM agent_groups ORDER BY name').all() as AgentGroup[];
}

export function getAgentGroupSync(id: string): AgentGroup | undefined {
  return getRawDb().prepare('SELECT * FROM agent_groups WHERE id = ?').get(id) as AgentGroup | undefined;
}

export function updateAgentGroupSync(
  id: string,
  updates: Partial<Pick<AgentGroup, 'name' | 'agent_provider' | 'hidden_in_dashboard' | 'model'>>,
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
  getRawDb()
    .prepare(`UPDATE agent_groups SET ${fields.join(', ')} WHERE id = @id`)
    .run(values);
}

export function getSessionSync(id: string): Session | undefined {
  return getRawDb().prepare('SELECT * FROM sessions WHERE id = ?').get(id) as Session | undefined;
}

export function getSessionsByAgentGroupSync(agentGroupId: string): Session[] {
  return getRawDb().prepare('SELECT * FROM sessions WHERE agent_group_id = ?').all(agentGroupId) as Session[];
}

export function getAllUsersSync(): User[] {
  return getRawDb().prepare('SELECT * FROM users ORDER BY display_name').all() as User[];
}

export function getUserSync(id: string): User | undefined {
  return getRawDb().prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
}

export function getUserRolesSync(userId: string): UserRole[] {
  return getRawDb().prepare('SELECT * FROM user_roles WHERE user_id = ?').all(userId) as UserRole[];
}

export function getOwnersSync(): UserRole[] {
  return getRawDb()
    .prepare("SELECT * FROM user_roles WHERE role = 'owner' AND agent_group_id IS NULL ORDER BY granted_at")
    .all() as UserRole[];
}

export function hasAdminPrivilegeSync(userId: string, agentGroupId: string): boolean {
  const db = getRawDb();
  const global = db
    .prepare(
      "SELECT 1 FROM user_roles WHERE user_id = ? AND role IN ('owner', 'admin') AND agent_group_id IS NULL LIMIT 1",
    )
    .get(userId);
  if (global !== undefined) return true;
  return (
    db
      .prepare("SELECT 1 FROM user_roles WHERE user_id = ? AND role = 'admin' AND agent_group_id = ? LIMIT 1")
      .get(userId, agentGroupId) !== undefined
  );
}

export function getMembersSync(agentGroupId: string): AgentGroupMember[] {
  return getRawDb()
    .prepare('SELECT * FROM agent_group_members WHERE agent_group_id = ? ORDER BY added_at')
    .all(agentGroupId) as AgentGroupMember[];
}

export function getUserDmsForUserSync(userId: string): UserDm[] {
  return getRawDb().prepare('SELECT * FROM user_dms WHERE user_id = ?').all(userId) as UserDm[];
}

export function getAllMessagingGroupsSync(): MessagingGroup[] {
  return getRawDb().prepare('SELECT * FROM messaging_groups ORDER BY created_at DESC').all() as MessagingGroup[];
}

export function getMessagingGroupAgentsSync(messagingGroupId: string): MessagingGroupAgent[] {
  return getRawDb()
    .prepare('SELECT * FROM messaging_group_agents WHERE messaging_group_id = ? ORDER BY priority DESC')
    .all(messagingGroupId) as MessagingGroupAgent[];
}

export function getDestinationsSync(agentGroupId: string): AgentDestination[] {
  if (!tableExistsSync('agent_destinations')) return [];
  return getRawDb()
    .prepare('SELECT * FROM agent_destinations WHERE agent_group_id = ? ORDER BY local_name')
    .all(agentGroupId) as AgentDestination[];
}

export function tableExistsSync(name: string): boolean {
  return (
    getRawDb().prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name = ? LIMIT 1").get(name) !== undefined
  );
}

export function getContainerConfigSync(agentGroupId: string): ContainerConfigRow | undefined {
  return getRawDb().prepare('SELECT * FROM container_configs WHERE agent_group_id = ?').get(agentGroupId) as
    | ContainerConfigRow
    | undefined;
}

export function ensureContainerConfigSync(agentGroupId: string, provider?: string | null): void {
  const normalized = (provider ?? DEFAULT_AGENT_PROVIDER).toLowerCase();
  const stamped = normalized && normalized !== 'claude' ? normalized : null;
  getRawDb()
    .prepare(
      `INSERT INTO container_configs (agent_group_id, provider, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT (agent_group_id) DO NOTHING`,
    )
    .run(agentGroupId, stamped, new Date().toISOString());
}

export function updateContainerConfigScalarsSync(
  agentGroupId: string,
  updates: Partial<Pick<ContainerConfigRow, 'provider' | 'model' | 'effort'>>,
): void {
  const fields: string[] = [];
  const values: Record<string, unknown> = { agent_group_id: agentGroupId };
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      fields.push(`${key} = @${key}`);
      values[key] = value;
    }
  }
  if (fields.length === 0) return;
  fields.push('updated_at = @updated_at');
  values.updated_at = new Date().toISOString();
  getRawDb()
    .prepare(`UPDATE container_configs SET ${fields.join(', ')} WHERE agent_group_id = @agent_group_id`)
    .run(values);
}

export function getAdminsOfAgentGroupSync(agentGroupId: string): UserRole[] {
  return getRawDb()
    .prepare("SELECT * FROM user_roles WHERE role = 'admin' AND agent_group_id = ? ORDER BY granted_at")
    .all(agentGroupId) as UserRole[];
}
