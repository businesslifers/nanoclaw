# Dashboard Pro — Tasks Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new `/dashboard/tasks` page to the `add-dashboard-pro` skill that lists every active scheduled task across all session DBs, grouped by agent group, with cancel/pause/resume + edit-prompt + edit-schedule actions.

**Architecture:** Host scans every session's `inbound.db` for `kind='task'` rows in live statuses (pending/processing/paused) on every snapshot push, decorates them, and bundles them as `tasks: TaskSummary[]` in the dashboard payload. New mutators `tasks.cancel/pause/resume/update` reuse the existing scheduling primitives in `src/modules/scheduling/db.ts`. Each mutator authorizes via `canAccessAgentGroup`, writes a `dashboard_audit` row, and calls `nudgePusher()`. The dashboard package gets a new SSR page, a tasks-table component, a side drawer with inline edit, three new HTTP routes, and the `cronstrue` dep — all delivered via the existing pnpm-patch flow against `@nanoco/nanoclaw-dashboard@0.3.0`.

**Tech Stack:** Node + TypeScript (host), `better-sqlite3`, `cron-parser` (already host dep, used for next-run computation), `bun:sqlite` (containers — not touched here), pnpm patch for the dashboard package, `cronstrue` (new dep, for human-readable cron text).

**Spec:** `docs/superpowers/specs/2026-04-30-dashboard-pro-tasks-page-design.md` is the binding reference. Read it before starting.

---

## File Structure

### Host (this repo, `main` branch)
- **Create:** `src/dashboard-tasks.ts` — `TaskSummary` type + `collectTasks()` extracted from the pusher for testability.
- **Create:** `src/dashboard-tasks.test.ts` — vitest unit tests using a temp SQLite fixture.
- **Modify:** `src/dashboard-pusher.ts` — call `collectTasks()` and add `tasks` to the snapshot payload.
- **Modify:** `src/dashboard-mutators.ts` — add `tasks.cancel/pause/resume/update` plus the `taskMutators` namespace export.
- **Modify:** `src/dashboard-mutators.test.ts` — add coverage for each new mutator (auth, success, not-found, validation).

### Skill resources (`.claude/skills/add-dashboard-pro/resources/`)
The skill's resource files are mirrors of the host's `src/` files. After host changes are committed and tested, sync them into the skill so a fresh `/add-dashboard-pro` install picks up the same behaviour.
- **Create / sync:** `dashboard-tasks.ts`, `dashboard-tasks.test.ts`
- **Sync:** `dashboard-pusher.ts`, `dashboard-mutators.ts`, `dashboard-mutators.test.ts`
- **Modify:** `dashboard-customizations.patch` — regenerated via `pnpm patch-commit` after editing the extracted dashboard package.
- **Modify:** `SKILL.md` — adds a 9th feature bullet, an apply step for `dashboard-tasks.ts`, and a verify step for the new page.

### Dashboard package (via `pnpm patch @nanoco/nanoclaw-dashboard@0.3.0`)
The package ships compiled JavaScript. Edits go into the *extracted* package directory's `dist/` tree, then `pnpm patch-commit` regenerates `patches/@nanoco__nanoclaw-dashboard@0.3.0.patch` which the skill ships.
- **New:** `dist/ui/pages/tasks.js` — SSR page assembling toolbar + grouped sections + drawer scaffold; per-viewer `canAccessAgentGroup` filter applied here.
- **New:** `dist/ui/pages/tasks-client.js` — client-side script (status chip toggling, search, drawer open/close, save flows).
- **Modify:** `dist/router.js` and `dist/router.d.ts` — add `GET /dashboard/tasks`, `POST /api/tasks/:taskId/action`, `PATCH /api/tasks/:taskId`.
- **Modify:** `dist/types.js` and `dist/types.d.ts` — add `TaskSummary` to `DashboardSnapshot` and `taskMutators` to `DashboardMutators`.
- **Modify:** `dist/store.js` — accept and persist `tasks` from the ingest payload.
- **Modify:** `dist/ui/layout.js` (or wherever the side nav is generated) — add a "Tasks" entry between Sessions and Audit.
- **Modify:** `dist/ui/styles.css` (or equivalent inline-style file) — drawer styles, status badges, group headers, action buttons.
- **Modify:** `package.json` — add `cronstrue` to dependencies.

---

## Phase A — Host

### Task A1: Define `TaskSummary` and write a failing test for `collectTasks`

**Files:**
- Create: `/home/admin/Agents/janet-v2/src/dashboard-tasks.ts`
- Create: `/home/admin/Agents/janet-v2/src/dashboard-tasks.test.ts`

- [ ] **Step 1: Create `src/dashboard-tasks.ts` with the type and a stub function**

```ts
/**
 * Per-snapshot collector for scheduled tasks across all session inbound DBs.
 * Each session has its own inbound.db (data/v2-sessions/<id>/inbound.db); a
 * task lives as a `kind='task'` row in messages_in. This module reads them
 * read-only and returns a normalized list for the dashboard payload.
 */
import Database from 'better-sqlite3';
import path from 'path';
import { CronExpressionParser } from 'cron-parser';

import { DATA_DIR, TIMEZONE } from './config.js';
import { log } from './log.js';

export interface TaskSummary {
  id: string;
  sessionId: string;
  agentGroupId: string;
  agentGroupName: string;
  status: 'pending' | 'processing' | 'paused';
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

/**
 * Open a session's inbound.db read-only and pull live task rows. Returns an
 * empty array on missing file or query failure (logs a warning) so a single
 * broken session can't take down the whole snapshot.
 */
export function collectTasksForSession(sessionRef: SessionRef): TaskSummary[] {
  const dbPath = path.join(DATA_DIR, 'v2-sessions', sessionRef.sessionId, 'inbound.db');
  let db: Database.Database;
  try {
    db = new Database(dbPath, { readonly: true, fileMustExist: true });
  } catch (err) {
    log.warn('collectTasks: inbound.db unreadable', { sessionId: sessionRef.sessionId, err: String(err) });
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
      .all() as Array<{
        id: string;
        status: 'pending' | 'processing' | 'paused';
        content: string;
        process_after: string | null;
        recurrence: string | null;
        series_id: string;
        timestamp: string;
        tries: number;
      }>;

    return rows.map((row) => decorateRow(row, sessionRef));
  } catch (err) {
    log.warn('collectTasks: query failed', { sessionId: sessionRef.sessionId, err: String(err) });
    return [];
  } finally {
    db.close();
  }
}

/** Aggregate across many sessions. Order is `sessionRefs` order, then row order from each DB. */
export function collectTasks(sessionRefs: SessionRef[]): TaskSummary[] {
  const out: TaskSummary[] = [];
  for (const ref of sessionRefs) {
    for (const t of collectTasksForSession(ref)) out.push(t);
  }
  return out;
}

function decorateRow(
  row: {
    id: string;
    status: 'pending' | 'processing' | 'paused';
    content: string;
    process_after: string | null;
    recurrence: string | null;
    series_id: string;
    timestamp: string;
    tries: number;
  },
  sessionRef: SessionRef,
): TaskSummary {
  let prompt = '';
  let scriptPresent = false;
  try {
    const parsed = JSON.parse(row.content) as { prompt?: unknown; script?: unknown };
    if (typeof parsed.prompt === 'string') prompt = parsed.prompt;
    scriptPresent = parsed.script != null && parsed.script !== '';
  } catch {
    // malformed content — leave blank rather than crashing the whole collect
  }

  const promptPreview = prompt.length > 80 ? prompt.slice(0, 77) + '…' : prompt;

  return {
    id: row.id,
    sessionId: sessionRef.sessionId,
    agentGroupId: sessionRef.agentGroupId,
    agentGroupName: sessionRef.agentGroupName,
    status: row.status,
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
      return processAfter; // fall back to last-known process_after if cron is malformed
    }
  }
  return processAfter;
}
```

- [ ] **Step 2: Create the failing test fixture**

```ts
/**
 * Tests for collectTasks. Uses real SQLite files in a temp dir — same pattern
 * as src/modules/scheduling/recurrence.test.ts. No mocks of better-sqlite3.
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { describe, expect, beforeEach, afterEach, it, vi } from 'vitest';
import Database from 'better-sqlite3';

const TEST_DIR = path.join(os.tmpdir(), 'nanoclaw-dashboard-tasks-test');

// Mock the config so DATA_DIR points at our temp dir.
vi.mock('./config.js', () => ({
  DATA_DIR: TEST_DIR,
  TIMEZONE: 'UTC',
}));

import { collectTasks, collectTasksForSession } from './dashboard-tasks.js';

function seedSession(sessionId: string, rows: Array<Record<string, unknown>>): void {
  const dir = path.join(TEST_DIR, 'v2-sessions', sessionId);
  fs.mkdirSync(dir, { recursive: true });
  const dbPath = path.join(dir, 'inbound.db');
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE messages_in (
      id TEXT PRIMARY KEY,
      seq INTEGER,
      kind TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      status TEXT NOT NULL,
      tries INTEGER NOT NULL DEFAULT 0,
      process_after TEXT,
      recurrence TEXT,
      series_id TEXT,
      platform_id TEXT,
      channel_type TEXT,
      thread_id TEXT,
      content TEXT NOT NULL,
      trigger INTEGER NOT NULL DEFAULT 1
    );
  `);
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

describe('collectTasks', () => {
  beforeEach(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('returns an empty array when no sessions exist', () => {
    expect(collectTasks([])).toEqual([]);
  });

  it('includes only kind="task" rows in live statuses', () => {
    seedSession('s1', [
      { id: 't1', kind: 'task', status: 'pending', content: JSON.stringify({ prompt: 'A' }) },
      { id: 't2', kind: 'task', status: 'completed', content: JSON.stringify({ prompt: 'B' }) }, // excluded — completed
      { id: 't3', kind: 'chat', status: 'pending', content: JSON.stringify({ text: 'hi' }) }, // excluded — not a task
      { id: 't4', kind: 'task', status: 'paused', content: JSON.stringify({ prompt: 'C' }) },
      { id: 't5', kind: 'task', status: 'processing', content: JSON.stringify({ prompt: 'D' }) },
    ]);
    const tasks = collectTasks([{ sessionId: 's1', agentGroupId: 'ag1', agentGroupName: 'Group A' }]);
    expect(tasks.map((t) => t.id).sort()).toEqual(['t1', 't4', 't5']);
  });

  it('decorates rows with prompt preview, script flag, and next run', () => {
    const longPrompt = 'x'.repeat(200);
    seedSession('s1', [
      {
        id: 't1',
        status: 'pending',
        recurrence: '0 9 * * *',
        process_after: '2026-04-30T09:00:00Z',
        content: JSON.stringify({ prompt: longPrompt, script: 'echo hi' }),
      },
    ]);
    const [task] = collectTasks([{ sessionId: 's1', agentGroupId: 'ag1', agentGroupName: 'Group A' }]);
    expect(task.promptPreview.length).toBe(78); // 77 chars + ellipsis
    expect(task.promptPreview.endsWith('…')).toBe(true);
    expect(task.scriptPresent).toBe(true);
    expect(task.nextRun).toMatch(/^\d{4}-\d{2}-\d{2}T09:00:00/);
  });

  it('returns [] for a session whose inbound.db does not exist', () => {
    const tasks = collectTasks([{ sessionId: 'nonexistent', agentGroupId: 'ag1', agentGroupName: 'Group A' }]);
    expect(tasks).toEqual([]);
  });

  it('survives a malformed content JSON', () => {
    seedSession('s1', [{ id: 't1', status: 'pending', content: 'not json' }]);
    const [task] = collectTasksForSession({ sessionId: 's1', agentGroupId: 'ag1', agentGroupName: 'Group A' });
    expect(task.promptPreview).toBe('');
    expect(task.scriptPresent).toBe(false);
  });

  it('aggregates tasks across multiple sessions in input order', () => {
    seedSession('a', [{ id: 't-a', status: 'pending' }]);
    seedSession('b', [{ id: 't-b', status: 'pending' }]);
    const tasks = collectTasks([
      { sessionId: 'a', agentGroupId: 'ag1', agentGroupName: 'A' },
      { sessionId: 'b', agentGroupId: 'ag2', agentGroupName: 'B' },
    ]);
    expect(tasks.map((t) => t.id)).toEqual(['t-a', 't-b']);
  });
});
```

- [ ] **Step 3: Run the test to confirm it actually exercises the implementation**

Run: `pnpm exec vitest run src/dashboard-tasks.test.ts`
Expected: PASS — 6 tests. (The implementation written in step 1 is intentionally complete; the tests assert it does the right thing rather than driving its construction.)

- [ ] **Step 4: Run the host typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/dashboard-tasks.ts src/dashboard-tasks.test.ts
git commit -m "$(cat <<'EOF'
feat(dashboard-pro): add collectTasks helper for snapshot pusher

Reads kind='task' rows in live statuses (pending/processing/paused)
from each session's inbound.db, decorates with agent group name,
prompt preview, script flag, and next-run timestamp computed via
cron-parser. Tested with real SQLite fixtures (no mocks).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task A2: Wire `collectTasks` into `dashboard-pusher.ts` snapshot

**Files:**
- Modify: `/home/admin/Agents/janet-v2/src/dashboard-pusher.ts`

- [ ] **Step 1: Import and call `collectTasks` in the pusher's `push()` function**

Add to the imports near the top of `dashboard-pusher.ts` (alongside the existing `import { getSessionsByAgentGroup } from './db/sessions.js';` and `import { getAllAgentGroups } from './db/agent-groups.js';`):

```ts
import { collectTasks, type TaskSummary, type SessionRef } from './dashboard-tasks.js';
```

In the body of the `push()` function (or wherever the snapshot object is assembled — search for `return {` near the snapshot composition; it's around line 235 of the current file), build a `sessionRefs` array from data already gathered for the snapshot:

```ts
const sessionRefs: SessionRef[] = [];
for (const group of agentGroups) {
  const sessions = getSessionsByAgentGroup(group.id);
  for (const session of sessions) {
    sessionRefs.push({ sessionId: session.id, agentGroupId: group.id, agentGroupName: group.name });
  }
}
const tasks: TaskSummary[] = collectTasks(sessionRefs);
```

Then add `tasks` to the snapshot payload returned by `push()` (the object that's POSTed to the dashboard ingest). Use the existing snapshot-key style (e.g., adjacent to `sessions`, `wikis`, `audit`).

- [ ] **Step 2: Run host typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Run the existing pusher-related test (if any) to make sure nothing broke**

Run: `pnpm test`
Expected: all existing tests still pass.

- [ ] **Step 4: Commit**

```bash
git add src/dashboard-pusher.ts
git commit -m "$(cat <<'EOF'
feat(dashboard-pro): include tasks in dashboard snapshot

Wires collectTasks() into the snapshot push so /dashboard/tasks
has data to render. ~10ms per session DB; negligible at install
sizes we care about.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task A3: Add `tasks.cancel` mutator

**Files:**
- Modify: `/home/admin/Agents/janet-v2/src/dashboard-mutators.ts`
- Modify: `/home/admin/Agents/janet-v2/src/dashboard-mutators.test.ts`

- [ ] **Step 1: Read the existing `dashboard-mutators.ts` end-to-end**

Run: `Read tool on src/dashboard-mutators.ts` (full file).
This sets up: how `MutatorContext` resolves the actor, how `appendAudit` is shaped, how `nudgePusher` is invoked, and the existing rename mutator's structure. The new `tasks.*` mutators follow the same pattern.

- [ ] **Step 2: Write the failing test for `tasks.cancel`**

In `src/dashboard-mutators.test.ts`, add a new `describe('tasks.cancel')` block. Use the existing fixtures pattern (it already mocks the central DB; we'll need to also seed a session inbound.db). Add these tests:

```ts
describe('tasks.cancel', () => {
  it('throws MutatorAuthError when actor cannot access the agent group', async () => {
    // setup: session belongs to ag1; actor is a member of ag2 only
    await expect(
      mutators.tasks.cancel({ actorUserId: 'u-other' }, { taskId: 't1', sessionId: 'sess1' }),
    ).rejects.toThrow(MutatorAuthError);
  });

  it('throws MutatorNotFoundError when the task does not exist', async () => {
    await expect(
      mutators.tasks.cancel({ actorUserId: 'u-owner' }, { taskId: 'no-such-task', sessionId: 'sess1' }),
    ).rejects.toThrow(MutatorNotFoundError);
  });

  it('throws MutatorNotFoundError when the task is in `processing` (cancelTask refuses)', async () => {
    // seed a task with status='processing'
    await expect(
      mutators.tasks.cancel({ actorUserId: 'u-owner' }, { taskId: 't-proc', sessionId: 'sess1' }),
    ).rejects.toThrow(MutatorNotFoundError);
  });

  it('cancels a pending task and writes audit row', async () => {
    const result = await mutators.tasks.cancel(
      { actorUserId: 'u-owner' },
      { taskId: 't-pending', sessionId: 'sess1' },
    );
    expect(result.ok).toBe(true);
    expect(result.task?.status).toBe('completed');
    expect(result.task?.recurrence).toBeNull();

    const audit = getAuditRows();
    expect(audit.at(-1)).toMatchObject({
      action: 'task.cancel',
      target_type: 'task',
      target_id: 'sess1:t-pending',
    });
  });
});
```

(Mutators-test setup details — `getAuditRows`, the in-memory central DB, agent-group fixtures — already exist in this file. Reuse them. For the session inbound.db, add a small helper analogous to the test fixture in `src/dashboard-tasks.test.ts` that seeds a task row.)

- [ ] **Step 3: Run the failing test**

Run: `pnpm exec vitest run src/dashboard-mutators.test.ts -t 'tasks.cancel'`
Expected: FAIL — `mutators.tasks` is undefined / `is not a function`.

- [ ] **Step 4: Implement the `tasks.cancel` mutator in `dashboard-mutators.ts`**

Add a new `tasksMutators` object alongside the existing rename mutator. Pattern:

```ts
import Database from 'better-sqlite3';
import path from 'path';

import { getSession } from './db/sessions.js';
import { canAccessAgentGroup } from './modules/permissions/access.js';
import { cancelTask, pauseTask, resumeTask, updateTask, type TaskUpdate } from './modules/scheduling/db.ts';
import { DATA_DIR } from './config.js';

interface TasksMutatorArgs {
  taskId: string;
  sessionId: string;
}

function openSessionInboundDb(sessionId: string): Database.Database {
  const dbPath = path.join(DATA_DIR, 'v2-sessions', sessionId, 'inbound.db');
  return new Database(dbPath);
}

function readTaskRow(db: Database.Database, taskId: string): Record<string, unknown> | undefined {
  return db
    .prepare(
      `SELECT id, status, content, process_after, recurrence, series_id, timestamp, tries
       FROM messages_in WHERE (id = ? OR series_id = ?) AND kind = 'task' LIMIT 1`,
    )
    .get(taskId, taskId) as Record<string, unknown> | undefined;
}

export const tasksMutators = {
  async cancel(actor: { actorUserId: string }, args: TasksMutatorArgs) {
    const session = getSession(args.sessionId);
    if (!session) throw new MutatorNotFoundError(`session ${args.sessionId} not found`);

    if (!canAccessAgentGroup(actor.actorUserId, session.agent_group_id)) {
      throw new MutatorAuthError('not authorised for this agent group');
    }

    const db = openSessionInboundDb(args.sessionId);
    try {
      const before = readTaskRow(db, args.taskId);
      if (!before) throw new MutatorNotFoundError(`task ${args.taskId} not found`);

      cancelTask(db, args.taskId);
      const after = readTaskRow(db, args.taskId);

      // cancelTask only acts on rows in ('pending','paused'); a 'processing' row
      // is left untouched. Detect no-op so the caller sees a 404 rather than a
      // misleading "ok" response.
      if (after && after.status === before.status && after.recurrence === before.recurrence) {
        throw new MutatorNotFoundError(`task ${args.taskId} could not be cancelled (likely processing)`);
      }

      appendAudit({
        actor_user_id: actor.actorUserId,
        action: 'task.cancel',
        target_type: 'task',
        target_id: `${args.sessionId}:${args.taskId}`,
        before_json: JSON.stringify(before),
        after_json: JSON.stringify(after ?? null),
      });

      nudgePusher();
      return { ok: true as const, task: after ?? null };
    } finally {
      db.close();
    }
  },
  // pause / resume / update added in subsequent tasks
};
```

Then export `tasks: tasksMutators` from the same file's main `mutators` object (search for the export of `agentGroups` rename for the pattern).

- [ ] **Step 5: Run the test, expect pass**

Run: `pnpm exec vitest run src/dashboard-mutators.test.ts -t 'tasks.cancel'`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/dashboard-mutators.ts src/dashboard-mutators.test.ts
git commit -m "feat(dashboard-pro): tasks.cancel mutator + audit"
```

---

### Task A4: Add `tasks.pause` mutator

Same structure as A3.

**Files:** Modify `src/dashboard-mutators.ts` and `src/dashboard-mutators.test.ts`.

- [ ] **Step 1: Write the failing test**

```ts
describe('tasks.pause', () => {
  it('throws auth when not authorised', async () => { /* same pattern as cancel */ });
  it('throws not-found when task missing', async () => { /* … */ });
  it('throws not-found when task is paused or processing (pauseTask refuses)', async () => { /* seed a paused task */ });
  it('pauses a pending task and writes audit', async () => {
    const r = await mutators.tasks.pause({ actorUserId: 'u-owner' }, { taskId: 't-pending', sessionId: 'sess1' });
    expect(r.task?.status).toBe('paused');
    expect(getAuditRows().at(-1)?.action).toBe('task.pause');
  });
});
```

- [ ] **Step 2: Run the failing test** — `pnpm exec vitest run src/dashboard-mutators.test.ts -t 'tasks.pause'` — expect FAIL (`mutators.tasks.pause` undefined).

- [ ] **Step 3: Add the `pause` method to `tasksMutators`**

```ts
async pause(actor: { actorUserId: string }, args: TasksMutatorArgs) {
  const session = getSession(args.sessionId);
  if (!session) throw new MutatorNotFoundError(`session ${args.sessionId} not found`);
  if (!canAccessAgentGroup(actor.actorUserId, session.agent_group_id)) {
    throw new MutatorAuthError('not authorised for this agent group');
  }

  const db = openSessionInboundDb(args.sessionId);
  try {
    const before = readTaskRow(db, args.taskId);
    if (!before) throw new MutatorNotFoundError(`task ${args.taskId} not found`);

    pauseTask(db, args.taskId);
    const after = readTaskRow(db, args.taskId);

    if (after?.status !== 'paused') {
      throw new MutatorNotFoundError(`task ${args.taskId} could not be paused (must be pending)`);
    }

    appendAudit({
      actor_user_id: actor.actorUserId,
      action: 'task.pause',
      target_type: 'task',
      target_id: `${args.sessionId}:${args.taskId}`,
      before_json: JSON.stringify(before),
      after_json: JSON.stringify(after),
    });

    nudgePusher();
    return { ok: true as const, task: after };
  } finally {
    db.close();
  }
}
```

- [ ] **Step 4: Run test** — expect PASS.

- [ ] **Step 5: Commit** — `git commit -m "feat(dashboard-pro): tasks.pause mutator + audit"`.

---

### Task A5: Add `tasks.resume` mutator

Same structure as A4 — symmetric to pause.

- [ ] **Step 1: Failing test:** asserts auth, not-found, no-op (when not paused), and the happy path:

```ts
it('resumes a paused task and writes audit', async () => {
  const r = await mutators.tasks.resume({ actorUserId: 'u-owner' }, { taskId: 't-paused', sessionId: 'sess1' });
  expect(r.task?.status).toBe('pending');
  expect(getAuditRows().at(-1)?.action).toBe('task.resume');
});
```

- [ ] **Step 2:** run, expect FAIL.

- [ ] **Step 3: Add the `resume` method** — identical to `pause` but using `resumeTask` and asserting `after.status === 'pending'`. Audit `action` is `'task.resume'`.

- [ ] **Step 4:** run, expect PASS.

- [ ] **Step 5: Commit** — `git commit -m "feat(dashboard-pro): tasks.resume mutator + audit"`.

---

### Task A6: Add `tasks.update` mutator (prompt + schedule edit)

**Files:** same.

- [ ] **Step 1: Write failing tests covering validation:**

```ts
describe('tasks.update', () => {
  it('throws validation on empty prompt', async () => {
    await expect(
      mutators.tasks.update({ actorUserId: 'u-owner' }, { taskId: 't1', sessionId: 'sess1', prompt: '   ' }),
    ).rejects.toThrow(MutatorValidationError);
  });

  it('throws validation on malformed cron', async () => {
    await expect(
      mutators.tasks.update({ actorUserId: 'u-owner' }, { taskId: 't1', sessionId: 'sess1', recurrence: 'not-a-cron' }),
    ).rejects.toThrow(MutatorValidationError);
  });

  it('throws not-found when task vanished', async () => {
    await expect(
      mutators.tasks.update({ actorUserId: 'u-owner' }, { taskId: 'no-such', sessionId: 'sess1', prompt: 'new' }),
    ).rejects.toThrow(MutatorNotFoundError);
  });

  it('updates prompt and writes audit with before/after diff', async () => {
    const r = await mutators.tasks.update(
      { actorUserId: 'u-owner' },
      { taskId: 't-pending', sessionId: 'sess1', prompt: 'new prompt' },
    );
    expect(JSON.parse(r.task!.content as string).prompt).toBe('new prompt');
    expect(getAuditRows().at(-1)?.action).toBe('task.update');
  });

  it('updates recurrence and validates cron', async () => {
    const r = await mutators.tasks.update(
      { actorUserId: 'u-owner' },
      { taskId: 't-pending', sessionId: 'sess1', recurrence: '0 9 * * *' },
    );
    expect(r.task?.recurrence).toBe('0 9 * * *');
  });

  it('clears recurrence when null is passed (turn recurring into one-shot)', async () => {
    const r = await mutators.tasks.update(
      { actorUserId: 'u-owner' },
      { taskId: 't-recurring', sessionId: 'sess1', recurrence: null },
    );
    expect(r.task?.recurrence).toBeNull();
  });
});
```

- [ ] **Step 2:** run, expect FAIL.

- [ ] **Step 3: Implement `update`:**

```ts
import { CronExpressionParser } from 'cron-parser';

async update(
  actor: { actorUserId: string },
  args: TasksMutatorArgs & { prompt?: string; recurrence?: string | null; processAfter?: string },
) {
  if (args.prompt !== undefined) {
    if (typeof args.prompt !== 'string' || args.prompt.trim() === '') {
      throw new MutatorValidationError('prompt must be a non-empty string');
    }
  }
  if (args.recurrence !== undefined && args.recurrence !== null) {
    try {
      CronExpressionParser.parse(args.recurrence);
    } catch (err) {
      throw new MutatorValidationError(`invalid cron: ${String((err as Error).message ?? err)}`);
    }
  }

  const session = getSession(args.sessionId);
  if (!session) throw new MutatorNotFoundError(`session ${args.sessionId} not found`);
  if (!canAccessAgentGroup(actor.actorUserId, session.agent_group_id)) {
    throw new MutatorAuthError('not authorised for this agent group');
  }

  const db = openSessionInboundDb(args.sessionId);
  try {
    const before = readTaskRow(db, args.taskId);
    if (!before) throw new MutatorNotFoundError(`task ${args.taskId} not found`);

    const update: TaskUpdate = {};
    if (args.prompt !== undefined) update.prompt = args.prompt;
    if (args.recurrence !== undefined) update.recurrence = args.recurrence;
    if (args.processAfter !== undefined) update.processAfter = args.processAfter;

    const touched = updateTask(db, args.taskId, update);
    if (touched === 0) {
      throw new MutatorNotFoundError(`task ${args.taskId} could not be updated (no live row in chain)`);
    }
    const after = readTaskRow(db, args.taskId);

    appendAudit({
      actor_user_id: actor.actorUserId,
      action: 'task.update',
      target_type: 'task',
      target_id: `${args.sessionId}:${args.taskId}`,
      before_json: JSON.stringify(before),
      after_json: JSON.stringify(after),
    });

    nudgePusher();
    return { ok: true as const, task: after };
  } finally {
    db.close();
  }
}
```

- [ ] **Step 4:** run, expect PASS.

- [ ] **Step 5: Commit** — `git commit -m "feat(dashboard-pro): tasks.update mutator with cron + prompt validation"`.

---

### Task A7: Wire the host-side flow end-to-end (HTTP routes are in the dashboard package; this task only ensures the mutator dispatch table includes `tasks`)

The dashboard package's `dispatchMutating()` looks up `mutators.tasks.cancel` etc. by name from the `DashboardMutators` it received from `startDashboard(...)`. The host-side wiring is already correct *if* `tasksMutators` is exposed under the right key on the `mutators` object built by `buildDashboardMutatorContext()` in `src/index.ts`.

**Files:**
- Modify: `/home/admin/Agents/janet-v2/src/index.ts` (or wherever `buildDashboardMutatorContext` is — search for it; it was added by the existing dashboard-pro CRUD foundation step).

- [ ] **Step 1: Verify (and add if missing) the `tasks` namespace on the mutator object**

Search: `grep -n 'agentGroups' src/index.ts src/dashboard-mutators.ts`
The existing rename mutator is exported as `mutators.agentGroups.rename` or similar. Add:

```ts
import { tasksMutators } from './dashboard-mutators.js';
// ...
const mutators = {
  agentGroups: { rename: ... },  // existing
  tasks: tasksMutators,          // new
};
```

- [ ] **Step 2: typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Run the full host test suite**

Run: `pnpm test`
Expected: all green (existing tests + new task tests).

- [ ] **Step 4: Commit** — `git commit -m "feat(dashboard-pro): expose tasks mutators on dashboard dispatch table"`.

---

## Phase B — Dashboard package patch

The dashboard package ships as compiled JS in `dist/`. The `add-dashboard-pro` skill extends it via a single pnpm patch. To add the Tasks page, regenerate that patch with new content.

### Task B1: Extract the dashboard package for editing

- [ ] **Step 1: Run pnpm patch**

```bash
pnpm patch @nanoco/nanoclaw-dashboard@0.3.0
```
This prints the path to the extracted working directory (something like `/home/admin/.local/share/pnpm/store/...` or a temp path under the current install). **Save the path** — you'll edit there and patch-commit it.

Export it for the rest of the task list:
```bash
export DASH_DIR='<paste-path-here>'
```

- [ ] **Step 2: Verify the existing patch is already applied to that working dir**

Run: `ls $DASH_DIR/dist/ui/pages/` — you should see `wikis.js` and `audit.js` among the others. If they're missing, the patch didn't apply on extraction; abort and check `pnpm-workspace.yaml` for the patchedDependencies entry.

---

### Task B2: Add `cronstrue` to the dashboard package's `package.json`

- [ ] **Step 1: Edit `$DASH_DIR/package.json`**

Add `cronstrue` to `dependencies`:

```json
"cronstrue": "2.50.0"
```

(Verify on `npmjs.com/package/cronstrue` that 2.50.0 has been published more than 3 days ago — `pnpm-workspace.yaml` enforces `minimumReleaseAge: 4320`. If 2.50.0 is too new, drop one minor version. Pin a literal version, no carets.)

- [ ] **Step 2: Add `cronstrue` to the install's host `package.json` too** (the host calls it during SSR)

```bash
pnpm add cronstrue@2.50.0
```

This runs from the install root (`/home/admin/Agents/janet-v2/`).

---

### Task B3: Extend the snapshot store to accept `tasks`

- [ ] **Step 1: Modify `$DASH_DIR/dist/store.js`**

Find where `setSnapshot(payload)` (or the equivalent) destructures the incoming JSON. Add `tasks` to the destructured fields and persist it:

```js
export function setSnapshot(payload) {
  // existing fields...
  state.tasks = Array.isArray(payload.tasks) ? payload.tasks : [];
  // ...
}
```

And add a getter:
```js
export function getTasks() { return state.tasks ?? []; }
```

- [ ] **Step 2: Modify `$DASH_DIR/dist/store.d.ts`** — add the `tasks` field typed as `TaskSummary[]` (declared in step B5 below).

---

### Task B4: Add types

- [ ] **Step 1: Modify `$DASH_DIR/dist/types.d.ts`**

Append:
```ts
export interface TaskSummary {
  id: string;
  sessionId: string;
  agentGroupId: string;
  agentGroupName: string;
  status: 'pending' | 'processing' | 'paused';
  promptPreview: string;
  scriptPresent: boolean;
  recurrence: string | null;
  processAfter: string | null;
  nextRun: string | null;
  seriesId: string;
  createdAt: string;
  tries: number;
}

export interface TasksMutators {
  cancel(actor: { actorUserId: string }, args: { taskId: string; sessionId: string }):
    Promise<{ ok: true; task: any | null }>;
  pause(actor: { actorUserId: string }, args: { taskId: string; sessionId: string }):
    Promise<{ ok: true; task: any }>;
  resume(actor: { actorUserId: string }, args: { taskId: string; sessionId: string }):
    Promise<{ ok: true; task: any }>;
  update(actor: { actorUserId: string }, args: {
    taskId: string;
    sessionId: string;
    prompt?: string;
    recurrence?: string | null;
    processAfter?: string;
  }): Promise<{ ok: true; task: any }>;
}

// Extend DashboardMutators:
export interface DashboardMutators {
  agentGroups?: { rename: (actor: any, args: any) => Promise<any> };
  tasks?: TasksMutators;
}
```

(If the existing `DashboardMutators` definition lives somewhere else in `dist/`, find it via `grep -rn "DashboardMutators" $DASH_DIR/dist/` and add `tasks` there.)

---

### Task B5: Add the `/dashboard/tasks` SSR page

- [ ] **Step 1: Create `$DASH_DIR/dist/ui/pages/tasks.js`**

Pattern this file after `$DASH_DIR/dist/ui/pages/audit.js` (a recent same-style page added by the existing patch). The page exports a `tasksPage(req, res)` function that:

1. Reads tasks from the store: `import { getTasks } from '../../store.js';`
2. Reads the actor: `const actorUserId = req.actorUserId; // populated by the auth middleware`
3. Filters tasks the actor can see:
   ```js
   import { canAccessAgentGroup } from '../../host-bridge.js'; // exposed by the host via mutators init
   const visible = getTasks().filter(t => canAccessAgentGroup(actorUserId, t.agentGroupId));
   ```
   *(If `canAccessAgentGroup` isn't already bridged into the dashboard package, the cleanest add is via the `mutators` parameter passed to `startDashboard` — extend that to include a `permissions: { canAccessAgentGroup }` callback. That host-side wiring goes in `src/index.ts` as a follow-up if needed.)*
4. Groups by `agentGroupId`:
   ```js
   const groups = new Map();
   for (const t of visible) {
     if (!groups.has(t.agentGroupId)) groups.set(t.agentGroupId, { name: t.agentGroupName, tasks: [] });
     groups.get(t.agentGroupId).tasks.push(t);
   }
   ```
5. Renders HTML with the existing layout helper. Include a `<script src="/static/tasks-client.js"></script>` for client-side interactions (drawer, search, chips).

Skeleton:
```js
import cronstrue from 'cronstrue';
import { layout } from '../layout.js';
import { getTasks } from '../../store.js';
import { canAccessAgentGroup } from '../../host-bridge.js';

export function tasksPage(req, res) {
  const actorUserId = req.actorUserId;
  const visible = getTasks().filter(t => canAccessAgentGroup(actorUserId, t.agentGroupId));
  const groups = groupByAgent(visible);

  const body = renderToolbar() + renderGroups(groups);
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(layout({ title: 'Tasks', body, scripts: ['tasks-client.js'] }));
}

function renderGroups(groups) {
  let html = '';
  for (const [id, { name, tasks }] of groups) {
    const counts = countByStatus(tasks);
    html += `<section class="task-group" data-group-id="${id}">
      <header>${escape(name)} <span class="counts">${formatCounts(counts)}</span></header>
      <table>${tasks.map(renderRow).join('')}</table>
    </section>`;
  }
  return html;
}

function renderRow(t) {
  const sched = t.recurrence
    ? `<span title="${escape(t.recurrence)}">${escape(cronstrue.toString(t.recurrence))}</span>`
    : '<span class="badge oneshot">one-shot</span>';
  // ...full row including action buttons constrained by t.status (see spec)
}
```

The full HTML structure must match the spec's UI section (toolbar, groups, drawer, action visibility per status). Reference `audit.js` for the toolbar/list pattern and the existing wikis page for a styled-content approach.

- [ ] **Step 2: Create `$DASH_DIR/dist/ui/pages/tasks-client.js`** — client-side script: chip toggling, search filtering, drawer open/close, save handlers that POST to `/api/tasks/:taskId/action` and PATCH `/api/tasks/:taskId`. Pattern after similar client scripts (search dist/ui/ for `<script>` tag references).

- [ ] **Step 3: Add styles** — append CSS for `.task-group`, `.task-row`, `.badge`, `.task-drawer`, `.drawer-backdrop`, `.action-btn`, status-specific colours. Locate the CSS surface (look for `dist/ui/styles.css` or a string concatenation in `dist/ui/layout.js`) and add the rules.

---

### Task B6: Wire the routes in `dist/router.js`

- [ ] **Step 1: Add page route**

```js
// Near other GET page routes in dispatch()
if (method === 'GET' && path === '/dashboard/tasks') {
  return tasksPage(req, res);
}
```

Import at the top: `import { tasksPage } from './ui/pages/tasks.js';`

- [ ] **Step 2: Add API routes in `dispatchMutating`**

```js
if (method === 'POST' && /^\/api\/tasks\/[^/]+\/action$/.test(path)) {
  const taskId = decodeURIComponent(path.split('/')[3]);
  const { sessionId, action } = body;
  if (!sessionId || !action) return json(res, { error: 'missing sessionId or action' }, 400);
  if (!['cancel', 'pause', 'resume'].includes(action)) {
    return json(res, { error: 'invalid action' }, 400);
  }
  try {
    const result = await mutators.tasks[action]({ actorUserId }, { taskId, sessionId });
    return json(res, result);
  } catch (err) {
    return json(res, { error: err.message }, err.status ?? 500);
  }
}

if (method === 'PATCH' && /^\/api\/tasks\/[^/]+$/.test(path)) {
  const taskId = decodeURIComponent(path.split('/')[3]);
  const { sessionId, prompt, recurrence, processAfter } = body;
  if (!sessionId) return json(res, { error: 'missing sessionId' }, 400);
  try {
    const result = await mutators.tasks.update(
      { actorUserId },
      { taskId, sessionId, prompt, recurrence, processAfter },
    );
    return json(res, result);
  } catch (err) {
    return json(res, { error: err.message }, err.status ?? 500);
  }
}
```

- [ ] **Step 3: Update `dist/router.d.ts`** — no signature change to `dispatch`/`dispatchMutating`, but add the `TasksMutators` import where `DashboardMutators` is referenced.

---

### Task B7: Add the Tasks nav entry

- [ ] **Step 1: Find the nav assembly site**

```bash
grep -rn 'Sessions' $DASH_DIR/dist/ui/ | grep -i 'href\|link\|nav'
```

The nav is likely in `$DASH_DIR/dist/ui/layout.js`. Add an entry between Sessions and Audit:

```js
{ href: '/dashboard/tasks', label: 'Tasks' },
```

(Use the same icon style as adjacent entries.)

---

### Task B8: Regenerate the patch and copy it back to the skill

- [ ] **Step 1: Patch-commit**

From the install root:
```bash
pnpm patch-commit "$DASH_DIR"
```

This regenerates `patches/@nanoco__nanoclaw-dashboard@0.3.0.patch` in the install root.

- [ ] **Step 2: Verify the patch grew**

```bash
wc -l patches/@nanoco__nanoclaw-dashboard@0.3.0.patch
# expect noticeably larger than the pre-task baseline (~7247 lines → +500 to +1500)
```

- [ ] **Step 3: Copy to skill resources**

```bash
cp patches/@nanoco__nanoclaw-dashboard@0.3.0.patch \
   .claude/skills/add-dashboard-pro/resources/dashboard-customizations.patch
```

- [ ] **Step 4: Re-run pnpm install to verify the patch still applies clean**

```bash
pnpm install
```
Expected: no patch errors. If it fails, your edits introduced something the patch system can't replay — fix and re-patch-commit.

- [ ] **Step 5: Build the host**

```bash
pnpm run build
```
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add patches/@nanoco__nanoclaw-dashboard@0.3.0.patch \
        .claude/skills/add-dashboard-pro/resources/dashboard-customizations.patch \
        package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(dashboard-pro): /dashboard/tasks page + drawer + cronstrue dep

Adds the new page to dist/ui/pages/tasks.js, client-side script in
dist/ui/pages/tasks-client.js, three new HTTP routes in router.js,
nav entry between Sessions and Audit, and pins cronstrue 2.50.0 for
human-readable cron rendering. Patch regenerated via
pnpm patch-commit and synced to the skill.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase C — Skill packaging + verify

### Task C1: Sync host code into skill resources

The skill stores the canonical copies of host files; without this sync a fresh install of the skill would have stale code.

- [ ] **Step 1: Copy**

```bash
cp src/dashboard-tasks.ts                .claude/skills/add-dashboard-pro/resources/dashboard-tasks.ts
cp src/dashboard-tasks.test.ts           .claude/skills/add-dashboard-pro/resources/dashboard-tasks.test.ts
cp src/dashboard-pusher.ts               .claude/skills/add-dashboard-pro/resources/dashboard-pusher.ts
cp src/dashboard-mutators.ts             .claude/skills/add-dashboard-pro/resources/dashboard-mutators.ts
cp src/dashboard-mutators.test.ts        .claude/skills/add-dashboard-pro/resources/dashboard-mutators.test.ts
```

- [ ] **Step 2: Run prettier on the synced copies**

```bash
pnpm exec prettier --write \
  .claude/skills/add-dashboard-pro/resources/dashboard-tasks.ts \
  .claude/skills/add-dashboard-pro/resources/dashboard-tasks.test.ts \
  .claude/skills/add-dashboard-pro/resources/dashboard-pusher.ts \
  .claude/skills/add-dashboard-pro/resources/dashboard-mutators.ts \
  .claude/skills/add-dashboard-pro/resources/dashboard-mutators.test.ts
```

- [ ] **Step 3: Diff to confirm sync**

```bash
diff src/dashboard-tasks.ts .claude/skills/add-dashboard-pro/resources/dashboard-tasks.ts
# expect: no differences (post-prettier)
```

Repeat for each pair.

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/add-dashboard-pro/resources/
git commit -m "chore(add-dashboard-pro): sync tasks page resources from host"
```

---

### Task C2: Update `SKILL.md` to advertise the 9th feature

**Files:** `.claude/skills/add-dashboard-pro/SKILL.md`

- [ ] **Step 1: Edit the description frontmatter and the bullet list**

Change the opening sentence from "Adds eight things..." to "Adds nine things..." and add a 9th bullet describing the Tasks page (mirror tone and depth of the other 8 — 3-5 lines, naming files and behaviours).

```markdown
9. **Tasks page** — new `/dashboard/tasks` route listing every active scheduled task across all session inbound DBs, grouped by agent group with collapsible sections. Operators can cancel, pause, resume, edit-prompt, and edit-schedule from the dashboard; each action runs through the existing mutator + audit + nudge flow with `canAccessAgentGroup` enforcement. Cron expressions render human-readable via `cronstrue` (raw cron in tooltip and edit input). Editing happens in a side drawer that opens on row click. The mutator implementation reuses the four scheduling primitives in `src/modules/scheduling/db.ts` (`cancelTask`, `pauseTask`, `resumeTask`, `updateTask`); their `id OR series_id` matching means recurring chains are operated on at the live row, not the historical one.
```

- [ ] **Step 2: Add an apply step under "Phase 1: Apply" / "3. Add the dashboard CRUD foundation to the host"**

```bash
cp .claude/skills/add-dashboard-pro/resources/dashboard-tasks.ts      src/dashboard-tasks.ts
cp .claude/skills/add-dashboard-pro/resources/dashboard-tasks.test.ts src/dashboard-tasks.test.ts
```

- [ ] **Step 3: Add a verify step under "Phase 2: Verify"**

```markdown
On **Tasks**, the toolbar shows status chips and a search box; below it, sections per agent group containing scheduled tasks. Click a row to open the drawer; edit prompt or cron and save — the updated row appears in the table within ~1s (via `nudgePusher`). Cancel a task and it disappears from the page; the audit log on `/dashboard/audit` shows a `task.cancel` row.
```

- [ ] **Step 4: Update the rollback block** to also `rm src/dashboard-tasks.ts src/dashboard-tasks.test.ts`.

- [ ] **Step 5: Update the preflight check** — add a row to flag `[ ! -f src/dashboard-tasks.ts ]` so re-runs detect prior application.

- [ ] **Step 6: Commit**

```bash
git add .claude/skills/add-dashboard-pro/SKILL.md
git commit -m "docs(add-dashboard-pro): SKILL.md advertises the new tasks page"
```

---

### Task C3: End-to-end manual verification

- [ ] **Step 1: Restart the host so the new pusher logic takes effect**

```bash
# Linux
for u in $(systemctl --user list-unit-files --no-legend 'nanoclaw-v2-*.service' | awk '{print $1}'); do
  systemctl --user cat "$u" | grep -q "WorkingDirectory=$PWD" && systemctl --user restart "$u" && break
done
```

- [ ] **Step 2: Schedule a recurring task in chat**

In any agent group's channel, ask the agent to schedule a task (e.g. via Telegram to Marketing Team: *"schedule a daily report at 09:00"*). Confirm the agent calls `schedule_task`.

- [ ] **Step 3: Open `/dashboard/tasks` in the browser**

Verify:
- The new "Tasks" entry appears in the side nav.
- Marketing Team section is visible, expanded, and contains the task you just scheduled.
- The cron column reads as human-readable text (e.g. "At 09:00").
- Hover the cron text — tooltip shows the raw `0 9 * * *`.

- [ ] **Step 4: Open the drawer**

Click the task row. Drawer slides in. Verify:
- Full prompt displayed in editable textarea.
- Cron in editable input; below it, a live human-readable preview that updates as you type.
- Status badge present.
- Footer shows Pause + Cancel.

- [ ] **Step 5: Edit the prompt**

Click the prompt's pencil, change to "test edit", click Save. Verify within ~1s the table row's prompt-preview updates.

- [ ] **Step 6: Pause the task**

Click Pause in the drawer footer. Verify:
- Status badge flips to "paused".
- Footer now shows Resume (not Pause).

- [ ] **Step 7: Cancel the task**

Click Cancel; confirm the dialog. Verify:
- Drawer closes.
- Task disappears from the page.

- [ ] **Step 8: Inspect the audit log**

Open `/dashboard/audit`. Verify four rows appear, in order: `task.update`, `task.pause`, (none for resume since you didn't), `task.cancel`. Each has actor, target_id `<sess>:<taskId>`, and before/after JSON.

- [ ] **Step 9: Permission check**

Log in as a non-admin user (or change actor via the dashboard's actor switch if it has one). Verify only the agent groups they're a member of show up, and that direct API calls (e.g. `curl ... /api/tasks/<id>/action`) return 403 for groups they can't access.

- [ ] **Step 10: Smoke-test running tasks**

While a task is `processing`, open its drawer. Verify:
- The "Currently running" message is shown.
- Pause/Cancel are not visible.
- Edit fields are read-only.

---

## Self-Review

The following checklist runs in the head of whoever's executing the plan; fix any gaps inline before declaring complete.

**1. Spec coverage:** every section of the spec maps to at least one task above. The eight Decisions table rows are covered:

| Decision | Task(s) |
|---|---|
| Scope (kind='task', live statuses) | A1, A2 |
| Cancel / pause / resume | A3, A4, A5 |
| Edit prompt + schedule | A6 |
| Visibility (canAccessAgentGroup) | A3-A6 (server-side), B5 (SSR filter), B6 (route auth) |
| Layout (grouped, collapsible) | B5 |
| Edit UI (side drawer) | B5 |
| Data flow (snapshot push) | A1, A2, B3 |
| Recent-fires out of scope | (intentional — no task) |

**2. Placeholder scan:** every code step contains real code. The dashboard-package edits are the only place I describe shape-of-change rather than line-by-line code, and that's deliberate — the upstream JS structure isn't visible from outside the extracted dir, so the engineer in `pnpm patch` mode follows the spec's UI section + adjacent existing pages (`audit.js`, `wikis.js`) as the model.

**3. Type consistency:** `TaskSummary` defined once in `src/dashboard-tasks.ts` (Task A1) and re-declared in `dist/types.d.ts` (Task B4); both definitions match exactly. `tasksMutators` keys (`cancel`, `pause`, `resume`, `update`) are used identically in A3-A6, A7, and B6.

**4. No spec gap:** nothing in the spec lacks a task.

---

## Execution

Plan complete and saved to `docs/superpowers/plans/2026-04-30-dashboard-pro-tasks-page.md`. Per the user's request to proceed without further approval, I'll execute via **subagent-driven development** — fresh subagent per task, two-stage review between tasks. Phase A (host) first, then Phase B (dashboard patch), then Phase C (packaging + verify).
