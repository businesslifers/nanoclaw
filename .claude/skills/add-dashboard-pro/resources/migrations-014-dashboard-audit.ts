import type Database from 'better-sqlite3';
import type { Migration } from './index.js';

export const migration014: Migration = {
  version: 14,
  name: 'dashboard-audit',
  up(db: Database.Database) {
    db.exec(`
      CREATE TABLE dashboard_audit (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        ts            TEXT NOT NULL,
        actor_user_id TEXT NOT NULL,
        action        TEXT NOT NULL,
        target_type   TEXT NOT NULL,
        target_id     TEXT NOT NULL,
        before_json   TEXT,
        after_json    TEXT
      );
      CREATE INDEX idx_dashboard_audit_ts ON dashboard_audit(ts DESC);
      CREATE INDEX idx_dashboard_audit_target ON dashboard_audit(target_type, target_id);
    `);
  },
};
