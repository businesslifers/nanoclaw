/**
 * Synchronous mirror of `canAccessAgentGroup` for the dashboard package.
 *
 * `@nanoco/nanoclaw-dashboard` declares its permissions bridge as a
 * SYNCHRONOUS predicate (`canAccessAgentGroup(userId, agentGroupId): boolean`,
 * dist/types.d.ts), while the host's own resolver became async with the
 * central-database driver seam. Rather than lie to the package with a
 * floating promise (which is always truthy — every user would pass), this
 * resolves the identical rule set against the legacy SQLite handle.
 *
 * Keep in lockstep with `src/modules/permissions/access.ts`: unknown user →
 * deny; owner / global admin / scoped admin of the group / membership row →
 * allow. Any change there belongs here too.
 */
import type { AccessDecision } from './modules/permissions/access.js';
import { getRawDb } from './db/sqlite-legacy.js';

export function canAccessAgentGroupSync(userId: string, agentGroupId: string): AccessDecision {
  const db = getRawDb();
  const one = (sql: string, ...params: unknown[]): boolean => db.prepare(sql).get(...params) !== undefined;

  if (!one('SELECT 1 FROM users WHERE id = ? LIMIT 1', userId)) return { allowed: false, reason: 'unknown_user' };
  if (one("SELECT 1 FROM user_roles WHERE user_id = ? AND role = 'owner' AND agent_group_id IS NULL LIMIT 1", userId)) {
    return { allowed: true, reason: 'owner' };
  }
  if (one("SELECT 1 FROM user_roles WHERE user_id = ? AND role = 'admin' AND agent_group_id IS NULL LIMIT 1", userId)) {
    return { allowed: true, reason: 'global_admin' };
  }
  if (
    one(
      "SELECT 1 FROM user_roles WHERE user_id = ? AND role = 'admin' AND agent_group_id = ? LIMIT 1",
      userId,
      agentGroupId,
    )
  ) {
    return { allowed: true, reason: 'admin_of_group' };
  }
  if (one('SELECT 1 FROM agent_group_members WHERE user_id = ? AND agent_group_id = ? LIMIT 1', userId, agentGroupId)) {
    return { allowed: true, reason: 'member' };
  }
  return { allowed: false, reason: 'not_member' };
}
