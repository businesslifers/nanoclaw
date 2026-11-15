import type Database from 'better-sqlite3';
import type { Migration } from './index.js';

export const migration017: Migration = {
  version: 17,
  name: 'agent-group-hidden-dashboard',
  up(db: Database.Database) {
    db.exec(`
      ALTER TABLE agent_groups
      ADD COLUMN hidden_in_dashboard INTEGER NOT NULL DEFAULT 0;
    `);
  },
};
