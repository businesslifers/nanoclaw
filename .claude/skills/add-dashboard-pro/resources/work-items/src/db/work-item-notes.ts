/**
 * DB helpers for work_item_notes — the agent's running narrative per work
 * item (migration 103). Higher-volume, free-text; separate from the
 * structured dashboard_audit compliance log by design.
 */
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
  db: Database.Database = sqliteRaw(getDb()),
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

export function listWorkItemNotes(
  workItemId: string,
  limit = 100,
  db: Database.Database = sqliteRaw(getDb()),
): WorkItemNote[] {
  // Newest N in chronological order (subquery keeps the cap on the newest end).
  return db
    .prepare(
      `SELECT * FROM (
         SELECT * FROM work_item_notes WHERE work_item_id = ? ORDER BY ts DESC, id DESC LIMIT ?
       ) ORDER BY ts ASC, id ASC`,
    )
    .all(workItemId, limit) as WorkItemNote[];
}

export function countWorkItemNotes(workItemId: string, db: Database.Database = sqliteRaw(getDb())): number {
  return (
    db.prepare('SELECT COUNT(*) AS c FROM work_item_notes WHERE work_item_id = ?').get(workItemId) as { c: number }
  ).c;
}
