/**
 * Per-snapshot collector for scheduled tasks across all session inbound DBs.
 * Each session has its own inbound.db (data/v2-sessions/<id>/inbound.db); a
 * task lives as a `kind='task'` row in messages_in. This module reads them
 * read-only and returns a normalized list for the dashboard payload.
 *
 * The dashboard pusher calls collectTasks() on every snapshot push (~60s)
 * and after every task mutator (via nudgePusher). Cost is ~10ms per session
 * DB; negligible at install sizes we care about.
 */
import Database from 'better-sqlite3';
import { CronExpressionParser } from 'cron-parser';

import { TIMEZONE } from './config.js';
import { log } from './log.js';
import { inboundDbPath } from './session-manager.js';

export interface TaskSummary {
  id: string;
  sessionId: string;
  agentGroupId: string;
  agentGroupName: string;
  status: 'pending' | 'processing' | 'paused';
  /** Full prompt — used by the drawer's edit textarea, hover tooltip, and search. */
  prompt: string;
  /** First 80 chars of prompt (with ellipsis) — used by the one-line table cell. */
  promptPreview: string;
  scriptPresent: boolean;
  recurrence: string | null;
  processAfter: string | null;
  /** ISO timestamp of the next scheduled fire, or null when indeterminate. */
  nextRun: string | null;
  seriesId: string;
  /** When the task row itself was inserted into messages_in. */
  createdAt: string;
  tries: number;
}

export interface SessionRef {
  sessionId: string;
  agentGroupId: string;
  agentGroupName: string;
}

interface TaskRow {
  id: string;
  status: 'pending' | 'processing' | 'paused';
  content: string;
  process_after: string | null;
  recurrence: string | null;
  series_id: string;
  timestamp: string;
  tries: number;
}

export function collectTasksForSession(sessionRef: SessionRef): TaskSummary[] {
  const dbPath = inboundDbPath(sessionRef.agentGroupId, sessionRef.sessionId);
  let db: Database.Database;
  try {
    db = new Database(dbPath, { readonly: true, fileMustExist: true });
  } catch (err) {
    log.warn('collectTasks: inbound.db unreadable', {
      sessionId: sessionRef.sessionId,
      err: String(err),
    });
    return [];
  }
  try {
    const rows = db
      .prepare(
        `SELECT id, status, content, process_after, recurrence, series_id, timestamp, tries
         FROM messages_in
         WHERE kind = 'task'
           AND status IN ('pending', 'processing', 'paused')`,
      )
      .all() as TaskRow[];

    return rows.map((row) => decorateRow(row, sessionRef));
  } catch (err) {
    log.warn('collectTasks: query failed', {
      sessionId: sessionRef.sessionId,
      err: String(err),
    });
    return [];
  } finally {
    db.close();
  }
}

export function collectTasks(sessionRefs: SessionRef[]): TaskSummary[] {
  const out: TaskSummary[] = [];
  for (const ref of sessionRefs) {
    for (const t of collectTasksForSession(ref)) out.push(t);
  }
  return out;
}

function decorateRow(row: TaskRow, sessionRef: SessionRef): TaskSummary {
  let prompt = '';
  let scriptPresent = false;
  try {
    const parsed = JSON.parse(row.content) as { prompt?: unknown; script?: unknown };
    if (typeof parsed.prompt === 'string') prompt = parsed.prompt;
    scriptPresent = parsed.script != null && parsed.script !== '';
  } catch {
    // malformed content — leave defaults rather than crashing the whole collect
  }

  const promptPreview = prompt.length > 80 ? prompt.slice(0, 77) + '…' : prompt;

  return {
    id: row.id,
    sessionId: sessionRef.sessionId,
    agentGroupId: sessionRef.agentGroupId,
    agentGroupName: sessionRef.agentGroupName,
    status: row.status,
    prompt,
    promptPreview,
    scriptPresent,
    recurrence: row.recurrence,
    processAfter: row.process_after,
    nextRun: computeNextRun(row.recurrence, row.process_after),
    seriesId: row.series_id,
    createdAt: row.timestamp,
    tries: row.tries,
  };
}

function computeNextRun(recurrence: string | null, processAfter: string | null): string | null {
  if (recurrence) {
    try {
      const interval = CronExpressionParser.parse(recurrence, { tz: TIMEZONE });
      return interval.next().toISOString();
    } catch {
      return processAfter;
    }
  }
  return processAfter;
}
