# Dashboard Pro — Tasks Page

**Status:** Approved
**Date:** 2026-04-30
**Skill:** `add-dashboard-pro` (private)
**Related:** `src/modules/scheduling/`, `src/dashboard-pusher.ts`, `src/dashboard-mutators.ts`, `src/db/dashboard-audit.ts`

## Problem

NanoClaw agents schedule recurring and one-shot tasks via the `schedule_task` MCP action (`src/modules/scheduling/actions.ts`). Each task is stored as a `messages_in` row inside the per-session inbound DB at `data/v2-sessions/<session_id>/inbound.db`, with `process_after` and (optionally) a cron `recurrence` field. Today the only ways to inspect or manage these tasks are:

1. Asking the agent in chat ("list your scheduled tasks", "cancel the daily ads run").
2. Hand-querying SQLite files on the host.

Operators who run multiple agents have no at-a-glance view of what's scheduled across the install, can't supervise pause/cancel/edit operations across agents from one place, and rely on the chat interface even when the schedule needs human triage rather than agent reasoning.

## Goals

- Single dashboard page surfacing every active scheduled task across every session.
- Operator can cancel, pause, resume, and edit (prompt + schedule) tasks from the dashboard.
- All actions audit-logged automatically through the existing `dashboard_audit` table.
- Visibility scoped to what the viewer is allowed to see (`canAccessAgentGroup`).
- Reuses existing dashboard-pro patterns (snapshot push, mutators, CSRF, nudge-on-write) so the feature lands as additive code rather than a new transport.

## Non-goals (v1)

- "Run now" / trigger-now action.
- Create-from-dashboard. Chat remains the authoring surface for scheduled tasks.
- Per-fire run history beyond what's already in `messages_in`. The drawer shows next-run only, not last-5 firings.
- Real-time push under the existing 60 s snapshot cap. The pusher already nudges within ~1 s after a write; that's the freshness floor we ship.
- Multi-install task aggregation. Scope is one install / one host process.

## Decisions taken during brainstorming

| # | Decision |
|---|----------|
| 1 | **Scope:** scheduled tasks only (rows where `process_after IS NOT NULL OR recurrence IS NOT NULL`), filtered to live statuses (`pending`, `processing`, `paused`). Completed/cancelled never shown on this page. |
| 2 | **Interactivity:** cancel + pause + resume + edit-prompt + edit-schedule. Run-now and create-from-dashboard explicitly out of scope for v1. |
| 3 | **Visibility:** scoped by `canAccessAgentGroup` — same model as existing dashboard mutators. |
| 4 | **Layout:** grouped by agent group, collapsible sections. No flat-vs-grouped toggle in v1. |
| 5 | **Edit UI:** side drawer, sliding from right. |
| 6 | **Data flow:** snapshot push (existing dashboard-pro pattern). Mutations call `nudgePusher()` for sub-second update propagation. |
| 7 | **Recent-fires history:** out of scope for v1. |

## Architecture

### Data flow

The host's existing dashboard pusher already iterates database state every 60 s and pushes a JSON snapshot to the dashboard's ingest endpoint. We add one more collection step.

**`src/dashboard-pusher.ts` — new step `collectTasks()`:**

1. Iterate all sessions returned by `getSessionsByAgentGroup()` (called per agent group during the existing snapshot loop, or once over `getAllAgentGroups`).
2. For each session, open `data/v2-sessions/<session_id>/inbound.db` via the existing `openInboundDb()` helper (read-only).
3. Run:
   ```sql
   SELECT id, status, content, process_after, recurrence, series_id, timestamp, tries
   FROM messages_in
   WHERE kind = 'task'
     AND status IN ('pending','processing','paused')
   ```
   `kind='task'` is the canonical filter — `insertTask` in `src/modules/scheduling/db.ts` writes that literal. Filtering on `process_after IS NOT NULL` would miss paused tasks (whose `process_after` may be null) and would catch non-task rows that happen to use that column.
4. Decorate each row with: `sessionId`, `agentGroupId`, `agentGroupName`, `nextRun` (computed: for one-shot tasks `process_after`; for recurring tasks the next firing per `cron-parser`), `promptPreview` (first 80 chars of parsed `content.prompt`), `scriptPresent` (boolean from `content.script != null`).
5. Bundle as `tasks: TaskSummary[]` in the snapshot payload.

The dashboard's in-memory state holds the latest snapshot. The page reads from there; no separate API call for the table view.

**Performance:** ~10 ms per session DB query × ~6 sessions in this install ≈ 60 ms per push. Negligible. If the install grows past ~100 sessions, the pusher can switch to the hybrid pattern (page reads from snapshot, drawer fetches via `/api/tasks/:id`) without breaking the page contract.

### Mutators

Five new mutator functions added to `src/dashboard-mutators.ts` (or `src/dashboard-mutators-tasks.ts` if `dashboard-mutators.ts` becomes unwieldy — judgment call at implementation time).

```ts
mutators.tasks = {
  async cancel(actor, { taskId, sessionId }) { ... },
  async pause(actor, { taskId, sessionId }) { ... },
  async resume(actor, { taskId, sessionId }) { ... },
  async update(actor, { taskId, sessionId, prompt?, recurrence?, processAfter? }) { ... },
};
```

Each mutator:

1. Resolves the session via `getSession(sessionId)`. Returns 404 if missing.
2. Authorizes via `canAccessAgentGroup(actor, session.agent_group_id)`. Returns 403 if denied.
3. Opens the session's `inbound.db`.
4. **Reads the task row pre-mutation** (for the audit `before` blob).
5. Calls the corresponding primitive in `src/modules/scheduling/db.ts` (`cancelTask`, `pauseTask`, `resumeTask`, `updateTask`). Each primitive matches by `id OR series_id` so it operates on the *live* row in a recurring chain rather than the historical row the agent originally saw — so the dashboard mutator passes only `taskId` and trusts the primitive's matching logic.
6. **Reads the task row post-mutation** for the audit `after` blob. For `cancel`, this is the row in its new `completed` state with `recurrence=NULL`, not null.
7. Computes `touched` (e.g., `cancelTask` is void, but the mutator can compare row state pre/post; `updateTask` already returns the count). When `touched=0`, returns 404 — the task either vanished or was already in a status the primitive ignores (cancel and pause both refuse to act on `processing` rows by design).
8. Writes a `dashboard_audit` row.
9. Calls `nudgePusher()` so the next snapshot includes the change within ~1 s.
10. Returns `{ ok: true, task: <after-row> }`.

### Routes (in the dashboard package patch)

Three new HTTP endpoints, double-submit CSRF protected via `nc-csrf` cookie + `X-Dashboard-CSRF` header (existing `dispatchMutating` wrapper):

- `GET /dashboard/tasks` — page render. SSR + hydrate, same pattern as other pages.
- `POST /api/tasks/:taskId/action` — body `{ sessionId, action: 'cancel' | 'pause' | 'resume' }`. Dispatches to the matching mutator.
- `PATCH /api/tasks/:taskId` — body `{ sessionId, prompt?, recurrence?, processAfter? }`. Dispatches to `tasks.update`.

`taskId` is **not globally unique** across session DBs (the agent generates it; it's a UUID-ish string but no enforced uniqueness across the install). `sessionId` is required in the body to disambiguate. The route URL keeps `:taskId` for readability; the body carries the disambiguator.

### Session ID source

The page receives `sessionId` from the snapshot's `tasks` array (each task has it). The frontend echoes it back when calling action / update endpoints. The frontend never looks up `sessionId` from anything else.

## UI

### Page route: `/dashboard/tasks`

**Toolbar:**
- Search input (filters by `promptPreview` substring, case-insensitive).
- Status chips: Pending / Processing / Paused. Pending + Processing on by default; Paused on by default. Toggling a chip filters in-place.
- No status chip for Completed or Cancelled — those statuses are excluded from the snapshot entirely.

**Body:**
- One section per agent group the viewer can access. Sections sorted alphabetically by `agentGroupName`.
- Section header: agent group name + per-status count badges (e.g. "Marketing Team · 3 pending · 1 running"). Header is the click target for collapse/expand.
- **Default expansion:** expanded if the group has any `pending` or `processing` tasks; collapsed if only `paused`.
- Section body: a table with columns `Status` (badge) | `Prompt` (truncated to one line) | `Schedule` (human-readable) | `Next Run` (relative time) | `Actions` (icon buttons).

**Empty state:** "No scheduled tasks. Tasks are created when an agent calls `schedule_task` from chat — try asking your agent to schedule something."

### Side drawer

Triggered by clicking a task row (or the prompt cell). Slides in from the right at ~360 px width. Dismissible by Esc, click outside, or Close button. Only one drawer open at a time.

**Drawer content (top-to-bottom):**

| Field | Read mode | Edit mode |
|-------|-----------|-----------|
| Title | Truncated prompt as `<h2>` | n/a |
| Status badge | Pill | n/a |
| Prompt | Full text in styled block | `<textarea>` autosize |
| Schedule | Human-readable cron + raw cron in `<code>` | Cron `<input>` + live human-readable preview that updates as the operator types (debounced ~150 ms; invalid cron renders an error message in place of the preview) |
| Next run | Absolute timestamp + relative text | n/a — derived |
| One-shot vs recurring | Inferred from data; shown as a chip | n/a |
| Script | Collapsible `<details>` block (read-only) | n/a |
| Agent group | Read-only link to agent group page | n/a |
| Created | Absolute timestamp | n/a |

Each editable field has a pencil icon on hover. Click flips that field into edit mode, surfaces inline Save / Cancel buttons. Save calls `PATCH /api/tasks/:taskId`. The drawer stays open after save; the row in the table updates from the next push.

**Drawer footer (sticky):**

Action visibility follows the underlying primitive's accepted statuses (defined in `src/modules/scheduling/db.ts`):

| Status | Visible actions |
|--------|-----------------|
| `pending` | Pause + Cancel |
| `paused` | Resume + Cancel |
| `processing` | None — agent is actively running this turn; the row will transition naturally. (Editing is also locked out for `processing`.) A subdued informational note appears: "Currently running. Actions available again after the turn completes." |

`Cancel task` is destructive (red) and behind a confirm dialog: "Cancel task X? This cannot be undone." After confirm, the row is set to `status='completed'` with cleared `recurrence` — for recurring tasks this means future occurrences stop; the chain is severed.

### Cron display

Add `cronstrue` (~5 KB minified) as a dependency of the dashboard package. Use it to convert `0 9 * * 1` → "At 09:00, only on Monday". Show the parsed string in the table's Schedule column and at the top of the drawer's schedule field; show the raw cron in a tooltip and as the value of the edit input.

One-shot tasks (`process_after` set, `recurrence` null): show the badge "one-shot" in the Schedule column instead of cron text.

### Real-time freshness

The page does not poll. It reads the snapshot the dashboard already maintains; the snapshot refreshes every 60 s by the pusher's interval and within ~1 s after any mutator call (via `nudgePusher`). Status transitions caused by the agent itself (`pending → processing → completed`) appear at the next regular snapshot — that's the documented freshness cap.

## Audit

Every mutator writes a row to `dashboard_audit` (existing table, migration `014`):

| Column | Value |
|--------|-------|
| `actor_user_id` | from `resolveActor` (existing) |
| `action` | `task.cancel` / `task.pause` / `task.resume` / `task.update` |
| `target_type` | `task` |
| `target_id` | `<sessionId>:<taskId>` (composite, since `taskId` alone isn't globally unique) |
| `before` | full task row JSON (pre-mutation) |
| `after` | full task row JSON (post-mutation). For `cancel`, the row is *not* deleted — it transitions to `status='completed'` with `recurrence=NULL`, so `after` reflects that state. |
| `ts` | now |

Action filter chips on `/dashboard/audit` already accept arbitrary action strings; the new actions appear automatically. No migration needed.

## Permissions

- Page route (`GET /dashboard/tasks`): any logged-in dashboard user. The page filters per-task on render.
- Snapshot bundles **all** tasks (not pre-filtered by viewer); the dashboard's SSR layer for `/dashboard/tasks` calls `canAccessAgentGroup(viewer, task.agentGroupId)` per task before rendering, dropping unauthorized tasks from the page payload. This keeps the pusher's snapshot uniform across viewers (no per-viewer cache invalidation) while still enforcing access at the render boundary.
- Mutators re-check `canAccessAgentGroup` server-side as defense in depth — the SSR filter is for UX, not authorization.

## Errors

| Scenario | Server response | UI |
|---|---|---|
| Task vanished between snapshot and mutation (just ran or already cancelled) | 404 | Toast "Task no longer exists", drawer closes, snapshot refresh |
| Viewer not authorized for that task's agent group | 403 | Toast "Permission denied" |
| `update` with malformed cron | 400 with field error | Drawer keeps inputs; inline error under the cron field |
| `update` with empty / whitespace-only prompt | 400 | Drawer keeps inputs; inline error under the prompt field |
| Network failure | n/a | Toast + retry; optimistic UI rolled back |
| Mutator throws unexpectedly | 500 | Toast "Something went wrong"; full error logged via `log.error` |

Cron validation: parse with `cron-parser` (already a host dep, used by `src/modules/scheduling/recurrence.ts`) before write. If parse throws, return 400 with `{ field: 'recurrence', message }`.

## Testing

**Unit (host, vitest):**
- `collectTasks` aggregation: multi-session fixture, expected output shape, status filter, snapshot decorations correct.
- Each mutator: authorized happy path, forbidden path, missing-target path, audit row written with correct shape.
- `update` validation: bad cron → 400; empty prompt → 400; valid update → success.

**Integration (host, vitest):**
- End-to-end mutator round-trip: open temporary inbound DB, write a task, call mutator, assert DB state changed AND audit row exists AND `nudgePusher` was called.

**E2E (dashboard package patch):** the upstream `@nanoco/nanoclaw-dashboard` already has a Playwright suite — extend it. If implementation discovers the suite is absent or broken, fall back to a recorded manual checklist (apply the skill, schedule a task, walk every interaction below) and note this in the skill's verification section. Either way, the checklist itself stands:
- Page renders with grouped sections.
- Drawer opens / closes (click row, Esc, click outside, Close button).
- Edit-and-save flow for prompt and for cron.
- Cancel task confirmation dialog appears and only cancels on confirm.
- Status chips filter rows.
- Search filters rows.
- Keyboard navigation: tab through chips, into table, into drawer; focus trap inside drawer.

## Skill packaging (`add-dashboard-pro`)

This becomes the **9th** feature in the skill's "eight things" list (now nine).

**New files in `.claude/skills/add-dashboard-pro/resources/`:**
- `dashboard-mutators-tasks.ts` (or fold into existing `dashboard-mutators.ts` — decide at implementation time based on file size).
- `dashboard-mutators-tasks.test.ts` correspondingly.

**Modified files in `.claude/skills/add-dashboard-pro/resources/`:**
- `dashboard-pusher.ts` — adds `collectTasks()` step.
- `dashboard-customizations.patch` — adds the page route, the drawer component, the table component, the API route handlers, and the `cronstrue` dependency to the dashboard package's `package.json`.

**Modified `SKILL.md`:**
- Add a 9th bullet to the feature list describing the Tasks page.
- Add an apply step for copying the new mutator file (analogous to existing 3a step).
- Add a verification step for the new page (analogous to "navigate to Sessions" step).

**Dependency:** `cronstrue` added to the dashboard package's `package.json` via the patch. Subject to `minimumReleaseAge: 4320` policy (3 days) — pin a specific version that's been on npm > 3 days.

## Open questions resolved during brainstorming

- ~~Recent-fires history in drawer~~ → out of scope for v1 (option a).

## Implementation sequencing

1. **Host:** add `collectTasks` to `dashboard-pusher.ts`; add `tasks.*` mutators to `dashboard-mutators.ts`; tests for both.
2. **Dashboard package patch:** new page route, table component, drawer component, action handlers, cron parsing.
3. **Skill packaging:** copy new resources, update SKILL.md, verify `pnpm install` regenerates the patch fresh from the modified upstream.
4. **Manual verification:** apply the skill to this install, schedule a task in chat, confirm it appears on the page; cancel/pause/resume/edit through the dashboard; confirm audit log captures all four.
