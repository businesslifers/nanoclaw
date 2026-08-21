/**
 * DB helpers for work_item_notes — the agent's running narrative per work
 * item (migration 103). Higher-volume, free-text; separate from the
 * structured dashboard_audit compliance log by design.
 */
import type Database from 'better-sqlite3';

import { getRawDb } from './sqlite-legacy.js';
import type { WorkItemAuthorKind } from './work-items.js';

export interface WorkItemNote {
  id: number;
  work_item_id: string;
  ts: string;
  author_kind: WorkItemAuthorKind;
  author_id: string | null;
  note: string;
}

export function addWorkItemNote(
  entry: {
    work_item_id: string;
    author_kind: WorkItemAuthorKind;
    author_id?: string | null;
    note: string;
  },
  db: Database.Database = getRawDb(),
): WorkItemNote {
  const ts = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO work_item_notes (work_item_id, ts, author_kind, author_id, note)
       VALUES (@work_item_id, @ts, @author_kind, @author_id, @note)`,
    )
    .run({
      work_item_id: entry.work_item_id,
      ts,
      author_kind: entry.author_kind,
      author_id: entry.author_id ?? null,
      note: entry.note,
    });
  return {
    id: Number(result.lastInsertRowid),
    work_item_id: entry.work_item_id,
    ts,
    author_kind: entry.author_kind,
    author_id: entry.author_id ?? null,
    note: entry.note,
  };
}

export function listWorkItemNotes(workItemId: string, limit = 100, db: Database.Database = getRawDb()): WorkItemNote[] {
  // Newest N in chronological order (subquery keeps the cap on the newest end).
  return db
    .prepare(
      `SELECT * FROM (
         SELECT * FROM work_item_notes WHERE work_item_id = ? ORDER BY ts DESC, id DESC LIMIT ?
       ) ORDER BY ts ASC, id ASC`,
    )
    .all(workItemId, limit) as WorkItemNote[];
}

export function countWorkItemNotes(workItemId: string, db: Database.Database = getRawDb()): number {
  return (
    db.prepare('SELECT COUNT(*) AS c FROM work_item_notes WHERE work_item_id = ?').get(workItemId) as { c: number }
  ).c;
}
