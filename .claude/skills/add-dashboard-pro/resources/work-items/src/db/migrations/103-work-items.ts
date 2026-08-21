import type Database from 'better-sqlite3';
import type { Migration } from './index.js';

/**
 * Canonical cross-team work-item store (dashboard Kanban/List/Timeline +
 * agent-facing work-item MCP tools). One row per tracked unit of work:
 * plain tasks, cross-team delegations, owner-blocked deliverables,
 * content-calendar slots (parent rows), and weekly cadence obligations.
 *
 * `status` is a fixed core enum (open | in_progress | blocked | done |
 * cancelled) so a cross-team Kanban means the same thing everywhere;
 * `status_detail` is free-text, team-specific, display-only. `kind` is
 * advisory/unenforced — used for filtering and to route sweep logic.
 *
 * `work_item_notes` is the agent's running narrative (timestamped free-text
 * paragraphs) — deliberately separate from `dashboard_audit`, which is a
 * structured before/after compliance log of dashboard-actor mutations.
 */
export const migration103: Migration = {
  version: 103,
  name: 'work-items',
  sqliteOnly: true,
  up(db: Database.Database) {
    db.exec(`
      CREATE TABLE work_items (
        id                            TEXT PRIMARY KEY,
        owner_agent_group_id          TEXT NOT NULL REFERENCES agent_groups(id),
        assignee_agent_group_id       TEXT REFERENCES agent_groups(id),
        assignee_user_id              TEXT REFERENCES users(id),
        assignee_label                TEXT,
        parent_id                     TEXT REFERENCES work_items(id),
        kind                          TEXT NOT NULL DEFAULT 'task',
        title                         TEXT NOT NULL,
        status                        TEXT NOT NULL DEFAULT 'open',
        status_detail                 TEXT,
        due_at                        TEXT,
        follow_up_at                  TEXT,
        completed_at                  TEXT,
        reminder_tier                 TEXT,
        reminder_last_sent_at         TEXT,
        cadence_expected_dow          INTEGER,
        cadence_period_label          TEXT,
        cadence_last_completed_period TEXT,
        fields_json                   TEXT,
        created_by_kind               TEXT NOT NULL,
        created_by_id                 TEXT,
        created_at                    TEXT NOT NULL,
        updated_at                    TEXT NOT NULL
      );
      CREATE INDEX idx_work_items_owner ON work_items(owner_agent_group_id, status);
      CREATE INDEX idx_work_items_assignee ON work_items(assignee_agent_group_id, status);
      CREATE INDEX idx_work_items_due ON work_items(due_at);
      CREATE INDEX idx_work_items_parent ON work_items(parent_id);

      CREATE TABLE work_item_notes (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        work_item_id TEXT NOT NULL REFERENCES work_items(id),
        ts           TEXT NOT NULL,
        author_kind  TEXT NOT NULL,
        author_id    TEXT,
        note         TEXT NOT NULL
      );
      CREATE INDEX idx_work_item_notes_item ON work_item_notes(work_item_id, ts);
    `);
  },
};
