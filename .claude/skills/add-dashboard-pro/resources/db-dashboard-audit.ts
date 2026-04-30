import type Database from 'better-sqlite3';

import { getDb } from './connection.js';

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

export function appendAudit(input: AppendAuditInput, db: Database.Database = getDb()): DashboardAuditRow {
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
  return getDb().prepare('SELECT * FROM dashboard_audit ORDER BY id DESC LIMIT ?').all(limit) as DashboardAuditRow[];
}
