/**
 * Tests for collectTasks. Uses real SQLite files in a temp dir — same pattern
 * as src/modules/scheduling/recurrence.test.ts. ensureSchema() does the
 * messages_in DDL so tests stay in lockstep with the canonical schema.
 */
import fs from 'fs';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const TEST_DIR = '/tmp/nanoclaw-dashboard-tasks-test';

vi.mock('./config.js', () => ({
  DATA_DIR: '/tmp/nanoclaw-dashboard-tasks-test',
  TIMEZONE: 'UTC',
}));

import { ensureSchema, openInboundDb } from './db/session-db.js';
import { collectTasks, collectTasksForSession, type SessionRef } from './dashboard-tasks.js';

interface SeedRow {
  id?: string;
  kind?: string;
  status?: string;
  process_after?: string | null;
  recurrence?: string | null;
  series_id?: string;
  content?: string;
  tries?: number;
  timestamp?: string;
}

function seedSession(agentGroupId: string, sessionId: string, rows: SeedRow[]): void {
  const dir = path.join(TEST_DIR, 'v2-sessions', agentGroupId, sessionId);
  fs.mkdirSync(dir, { recursive: true });
  const dbPath = path.join(dir, 'inbound.db');
  ensureSchema(dbPath, 'inbound');
  const db = openInboundDb(dbPath);
  const insert = db.prepare(`
    INSERT INTO messages_in (id, seq, kind, timestamp, status, tries, process_after, recurrence, series_id, content)
    VALUES (@id, @seq, @kind, @timestamp, @status, @tries, @process_after, @recurrence, @series_id, @content)
  `);
  let seq = 0;
  for (const r of rows) {
    insert.run({
      id: r.id ?? `t-${seq}`,
      seq: seq++,
      kind: r.kind ?? 'task',
      timestamp: r.timestamp ?? '2026-04-30T00:00:00Z',
      status: r.status ?? 'pending',
      tries: r.tries ?? 0,
      process_after: r.process_after ?? null,
      recurrence: r.recurrence ?? null,
      series_id: r.series_id ?? r.id ?? `t-${seq - 1}`,
      content: r.content ?? JSON.stringify({ prompt: 'hi', script: null }),
    });
  }
  db.close();
}

const refA: SessionRef = { sessionId: 's1', agentGroupId: 'ag1', agentGroupName: 'Group A' };
const refB: SessionRef = { sessionId: 's2', agentGroupId: 'ag2', agentGroupName: 'Group B' };

beforeEach(() => {
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('collectTasks', () => {
  it('returns an empty array when no sessions are passed', () => {
    expect(collectTasks([])).toEqual([]);
  });

  it("includes only kind='task' rows in live statuses", () => {
    seedSession('ag1', 's1', [
      { id: 't1', kind: 'task', status: 'pending', content: JSON.stringify({ prompt: 'A' }) },
      { id: 't2', kind: 'task', status: 'completed', content: JSON.stringify({ prompt: 'B' }) },
      { id: 't3', kind: 'chat', status: 'pending', content: JSON.stringify({ text: 'hi' }) },
      { id: 't4', kind: 'task', status: 'paused', content: JSON.stringify({ prompt: 'C' }) },
      { id: 't5', kind: 'task', status: 'processing', content: JSON.stringify({ prompt: 'D' }) },
      { id: 't6', kind: 'task', status: 'failed', content: JSON.stringify({ prompt: 'E' }) },
    ]);
    const tasks = collectTasks([refA]);
    expect(tasks.map((t) => t.id).sort()).toEqual(['t1', 't4', 't5']);
  });

  it('decorates rows with prompt preview, script flag, and next run', () => {
    const longPrompt = 'x'.repeat(200);
    seedSession('ag1', 's1', [
      {
        id: 't1',
        status: 'pending',
        recurrence: '0 9 * * *',
        process_after: '2026-04-30T09:00:00Z',
        content: JSON.stringify({ prompt: longPrompt, script: 'echo hi' }),
      },
    ]);
    const [task] = collectTasks([refA]);
    expect(task.id).toBe('t1');
    expect(task.agentGroupId).toBe('ag1');
    expect(task.agentGroupName).toBe('Group A');
    expect(task.sessionId).toBe('s1');
    expect(task.promptPreview.length).toBe(78);
    expect(task.promptPreview.endsWith('…')).toBe(true);
    expect(task.prompt).toBe(longPrompt);
    expect(task.prompt.length).toBe(200);
    expect(task.scriptPresent).toBe(true);
    expect(task.recurrence).toBe('0 9 * * *');
    expect(task.nextRun).toMatch(/^\d{4}-\d{2}-\d{2}T09:00:00/);
  });

  it('uses process_after as nextRun for one-shot tasks', () => {
    seedSession('ag1', 's1', [
      {
        id: 't1',
        status: 'pending',
        process_after: '2026-05-01T14:00:00Z',
        recurrence: null,
        content: JSON.stringify({ prompt: 'one-shot' }),
      },
    ]);
    const [task] = collectTasks([refA]);
    expect(task.nextRun).toBe('2026-05-01T14:00:00Z');
    expect(task.recurrence).toBeNull();
  });

  it('falls back to process_after when recurrence is malformed', () => {
    seedSession('ag1', 's1', [
      {
        id: 't1',
        status: 'pending',
        recurrence: 'not-a-cron',
        process_after: '2026-05-01T14:00:00Z',
        content: JSON.stringify({ prompt: 'broken' }),
      },
    ]);
    const [task] = collectTasks([refA]);
    expect(task.nextRun).toBe('2026-05-01T14:00:00Z');
  });

  it('returns [] for a session whose inbound.db does not exist', () => {
    const tasks = collectTasks([{ sessionId: 'nonexistent', agentGroupId: 'ag1', agentGroupName: 'Group A' }]);
    expect(tasks).toEqual([]);
  });

  it('survives a malformed content JSON without throwing', () => {
    seedSession('ag1', 's1', [{ id: 't1', status: 'pending', content: 'not json' }]);
    const [task] = collectTasksForSession(refA);
    expect(task.id).toBe('t1');
    expect(task.prompt).toBe('');
    expect(task.promptPreview).toBe('');
    expect(task.scriptPresent).toBe(false);
  });

  it('aggregates tasks across multiple sessions in input order', () => {
    seedSession('ag1', 's1', [{ id: 't-a', status: 'pending' }]);
    seedSession('ag2', 's2', [{ id: 't-b', status: 'pending' }]);
    const tasks = collectTasks([refA, refB]);
    expect(tasks.map((t) => t.id)).toEqual(['t-a', 't-b']);
    expect(tasks[0].agentGroupName).toBe('Group A');
    expect(tasks[1].agentGroupName).toBe('Group B');
  });

  it('keeps short prompts intact (no ellipsis)', () => {
    seedSession('ag1', 's1', [{ id: 't1', status: 'pending', content: JSON.stringify({ prompt: 'short' }) }]);
    const [task] = collectTasksForSession(refA);
    expect(task.prompt).toBe('short');
    expect(task.promptPreview).toBe('short');
  });
});
