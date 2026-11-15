/**
 * Synchronous access check for the dashboard.
 *
 * `canAccessAgentGroup` in `src/modules/permissions/access.ts` is the
 * canonical resolver and is async (the central DB moved behind `DbDriver`).
 * The dashboard cannot consume it: `@nanoco/nanoclaw-dashboard` calls the
 * permission callback inside an `Array.prototype.filter`, where a Promise is
 * always truthy — every team would be visible to every actor.
 *
 * So this mirrors the same ladder over a raw better-sqlite3 handle
 * (`sqliteRaw(getDb())` — the driver's own connection, not a second one).
 * It is NOT a cache: every call queries live state, so a revoked role takes
 * effect immediately, exactly as the async resolver does.
 *
 * Keep the two in step. If the ladder changes in `access.ts`, change it here
 * too — and do not "fix" this back to the async resolver: the TS2322 that
 * would follow is the guardrail, not the bug.
 */
import { getDb } from './db/connection.js';
import { sqliteRaw } from './db/drivers/sqlite.js';
import type { AccessDecision } from './modules/permissions/access.js';

/** Same ladder as `canAccessAgentGroup`, returning the full decision. */
export function canAccessAgentGroupDecisionSync(userId: string, agentGroupId: string): AccessDecision {
  const db = sqliteRaw(getDb());
  if (!db.prepare('SELECT 1 FROM users WHERE id = ?').get(userId)) {
    return { allowed: false, reason: 'unknown_user' };
  }
  const owner = db
    .prepare("SELECT 1 FROM user_roles WHERE user_id = ? AND role = 'owner' AND agent_group_id IS NULL LIMIT 1")
    .get(userId);
  if (owner) return { allowed: true, reason: 'owner' };
  const globalAdmin = db
    .prepare("SELECT 1 FROM user_roles WHERE user_id = ? AND role = 'admin' AND agent_group_id IS NULL LIMIT 1")
    .get(userId);
  if (globalAdmin) return { allowed: true, reason: 'global_admin' };
  const scopedAdmin = db
    .prepare("SELECT 1 FROM user_roles WHERE user_id = ? AND role = 'admin' AND agent_group_id = ? LIMIT 1")
    .get(userId, agentGroupId);
  if (scopedAdmin) return { allowed: true, reason: 'admin_of_group' };
  const member = db
    .prepare('SELECT 1 FROM agent_group_members WHERE user_id = ? AND agent_group_id = ? LIMIT 1')
    .get(userId, agentGroupId);
  if (member) return { allowed: true, reason: 'member' };
  return { allowed: false, reason: 'not_member' };
}

/** Same ladder as `canAccessAgentGroup`: owner → global admin → scoped admin → member. */
export function canAccessAgentGroupSync(userId: string, agentGroupId: string): boolean {
  const db = sqliteRaw(getDb());
  const known = db.prepare('SELECT 1 FROM users WHERE id = ?').get(userId);
  if (!known) return false;

  const role = db
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
  if (role) return true;

  const member = db
    .prepare('SELECT 1 FROM agent_group_members WHERE user_id = ? AND agent_group_id = ? LIMIT 1')
    .get(userId, agentGroupId);
  return member !== undefined;
}
