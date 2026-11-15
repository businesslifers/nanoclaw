/**
 * FORK NOTE — why these helpers stay synchronous while the central DB went
 * async behind `DbDriver`.
 *
 * They are called from BOTH the async module side and the dashboard side, and
 * `@nanoco/nanoclaw-dashboard` is synchronous end to end: `dispatchMutating`
 * does `const after = fn(...)` then serializes `after` directly, and the
 * permission check runs inside an `Array.prototype.filter`. An async callback
 * there would serialize `{}` for every mutation, turn a rejection into an
 * unhandled rejection behind an `ok: true` response, and make every Promise
 * truthy in the permission filter — i.e. show every team to every actor.
 *
 * So these keep a raw better-sqlite3 handle via `sqliteRaw(getDb())` — the
 * same connection the driver holds, not a second one, so there is no write
 * contention and no cache staleness. Sync functions are callable from async
 * callers; the reverse is not true, which is why the shared helpers are the
 * ones that stay sync.
 *
 * One consequence worth knowing: the async driver's `transaction()` yields,
 * so a raw write here can now land inside an open host transaction and be
 * rolled back with it. Dashboard writes are rare human clicks, so that is
 * accepted — but never open a raw `BEGIN` here: a nested BEGIN while a driver
 * transaction is open throws. Single-statement writes only.
 */

import type Database from 'better-sqlite3';

import { getDb } from './connection.js';
import { sqliteRaw } from './drivers/sqlite.js';

export interface DashboardAuditRow {
  id: number;
  ts: string;
  actor_user_id: string;
  action: string;
  target_type: string;
  target_id: string;
  before_json: string | null;
  after_json: string | null;
}

export interface AppendAuditInput {
  actor_user_id: string;
  action: string;
  target_type: string;
  target_id: string;
  before: unknown;
  after: unknown;
}

export function appendAudit(input: AppendAuditInput, db: Database.Database = sqliteRaw(getDb())): DashboardAuditRow {
  const ts = new Date().toISOString();
  const before_json = input.before === undefined ? null : JSON.stringify(input.before);
  const after_json = input.after === undefined ? null : JSON.stringify(input.after);
  const result = db
    .prepare(
      `INSERT INTO dashboard_audit (ts, actor_user_id, action, target_type, target_id, before_json, after_json)
       VALUES (@ts, @actor_user_id, @action, @target_type, @target_id, @before_json, @after_json)`,
    )
    .run({
      ts,
      actor_user_id: input.actor_user_id,
      action: input.action,
      target_type: input.target_type,
      target_id: input.target_id,
      before_json,
      after_json,
    });
  return db
    .prepare('SELECT * FROM dashboard_audit WHERE id = ?')
    .get(result.lastInsertRowid as number) as DashboardAuditRow;
}

export function getRecentAudit(limit = 200): DashboardAuditRow[] {
  return sqliteRaw(getDb())
    .prepare('SELECT * FROM dashboard_audit ORDER BY id DESC LIMIT ?')
    .all(limit) as DashboardAuditRow[];
}
