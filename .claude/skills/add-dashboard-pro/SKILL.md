---
name: add-dashboard-pro
description: Layer the businesslifers customizations onto the base NanoClaw dashboard — wiki-page redesign, per-container CPU/memory columns on the Sessions table, "Agent Groups" relabelled to "Teams" throughout the UI, list/card view toggle on the Teams page, agent/sub-agent rename with audit log, a CPU-pinned watchdog that flips system health to "degraded" when any container stays above 80% CPU for ~5 minutes, a /dashboard/tasks page with cancel/pause/resume/edit actions for scheduled tasks, and an overview-page timeframe selector (24h / week / month / all-time) that drives the activity chart and token-usage cells. Requires /add-dashboard to have been run first.
---

# /add-dashboard-pro — businesslifers dashboard customizations

Adds eleven things on top of the base `/add-dashboard` install. The patch also relabels "Agent Groups" as "Teams" everywhere it appears in the UI (sidebar nav, page header, Overview section, table column headers, the "By Team" cost panel, and tasks-page labels). The internal model, API routes (`/api/agent-groups`, `/dashboard/agent-groups`), CSS class names (`.agent-groups-v2`), and source identifiers stay as `agent-group(s)` — this is a display rename only.

1. **Wiki page redesign** — restyles the dashboard's `/dashboard/wikis` route (markdown rendering, sidebar layout). Surfaces YAML frontmatter as a metadata bar above the article — `verdict:` (worth-exploring / interesting-but-not-now / pass) as a colored badge, `evaluated:` and `updated:` dates, a clickable source link (preferring `url:` for the href, with `source:` as label fallback), and `tags:` as pills. Code blocks get a hover-revealed copy-to-clipboard button. Wiki markdown is agent-authored and rendered into the dashboard origin, so raw HTML is rendered inert: `<script>` / event-handler HTML is HTML-escaped to visible text, and `javascript:`/`data:`/`vbscript:` link and image URLs are stripped, preventing stored XSS (`dist/ui/wiki-render.js`).
2. **Per-container CPU + memory columns** on the `/dashboard/sessions` table, with bar visualisations and color thresholds.
3. **Usage ($) column on the Teams table** — sits between Model and Runs, shows cumulative API-equivalent USD cost per team sourced from `/api/tokens/summary` (`tokens.byGroup[id].costUsd`). Useful for spotting which agents are chewing the most context. Empty rows show "—" instead of "$0.00" so they don't visually compete with active ones; values <$0.01 show as "<$0.01"; the cell `title` attribute carries the full 4-decimal value for hover.
4. **List / card view toggle on Teams** — segmented control in the toolbar (next to Search + Models filter) flips between the existing dense table and a card grid. Cards group lead + sub-agents under collapsible team headers (LEAD/SUB-AGENT/AGENT tags, deterministic gradient avatars from agent id, runs/running/folder stats, a pulsing dot when any session is running, optional usage badge). The **Runs** stat is the lifetime inbound-message count for the team (summed across its sessions) — "how many times it's been prompted/run" — surfaced via a `runCount` field the host pusher rolls up from each session's `inbound.db`. It replaces the old session-row count, which was structurally always 1 in single-session mode and told operators nothing. The current mode persists in `localStorage` under key `ag-view`; default is `cards`. Search and Model filters apply to both views simultaneously and hide group sections that end up empty after filtering. The **Overview page's Teams section** mirrors the list view's hierarchy: leads first, sub-agents indented underneath with `↳`, same LEAD/AGENT/SUB-AGENT tags — reusing the `.agent-groups-v2` CSS scope so styling stays in lockstep.
5. **CPU-pinned watchdog** — the host pusher tracks each container's CPU over a rolling 5-snapshot window (~5 minutes) and appends a reason to `health.reasons` for any container holding ≥80% CPU. The dashboard's existing health pill turns "degraded" automatically. Built after a v1 install once spent days at 98% CPU silently.
6. **Branding** — sidebar header reads "Dashboard Pro" with a logo above it, and the same image serves as the browser favicon. The logo is inlined into the layout as a base64 data URL (no separate static asset to host or route). Defaults to the NanoClaw icon (`resources/nanoclaw-icon.svg`); operators can override per-install by dropping a `dashboard-logo.{svg,png,webp,jpg}` file at the install root before running step 4, or by setting `DASHBOARD_LOGO_PATH=path/to/logo.svg`. The skill bakes the chosen image into the patch at install time. Sidebar slot is 80×80 — square assets render best.
7. **CRUD foundation + agent/sub-agent rename** — first write capability on the dashboard. Hover any agent (card view, list view, and the Overview hierarchy) and a pencil button activates an inline editor; submit `PATCH /api/agent-groups/:id` with `{ name }` and the host validates, authorizes via `canAccessAgentGroup`/`hasAdminPrivilege`, runs `updateAgentGroup` + audit row in a single transaction, then nudges the pusher so the new name appears in <1s. The `id` and `folder` are immutable; `groups/<folder>/container.json` `groupName`/`assistantName` re-sync on the next container spawn (`src/container-runner.ts:423-428`); OneCLI display name re-applies on the next session via the existing `ensureAgent` call. No container restart required. Foundation pieces also added so future write features layer on cleanly: `mutators` + `resolveActor` options on `startDashboard`, double-submit `nc-csrf` cookie + `X-Dashboard-CSRF` header, and `dispatchMutating` for non-GET routes.
8. **Audit log + page** — a new `dashboard_audit` table (migration `016-dashboard-audit`) records every mutator call (`actor_user_id`, `action`, `target_type`, `target_id`, before/after JSON, ts). The `/dashboard/audit` page renders the latest rows with action + target filters and search. Visible immediately after the first dashboard write so operators can audit changes without grepping logs.
9. **Hide team from dashboard** — a per-team off-switch for the listing. Hover any team's name (cards, list, or Overview hierarchy) and an eye-strike button appears next to the rename pencil; one click confirms and PATCHes `/api/agent-groups/:id/hidden` with `{ hidden: true }`. The row disappears immediately (no full reload — both the list table row and any matching cards flip via a delegated handler). A "Hidden (N)" pill appears in the toolbar whenever ≥1 team is hidden; toggling it adds `body.ag-show-hidden`, which un-clips hidden rows and renders them at 55% opacity with the eye button persistently visible so unhide is one click. State persists via the `agent_groups.hidden_in_dashboard` column (migration `017-agent-group-hidden-dashboard`) and the toolbar preference under `localStorage.ag-show-hidden`. The flag does **not** affect runtime — hidden teams still receive messages, run sessions, and accept tasks; it only filters the dashboard view. Audited like rename (`action='agent_group.set_hidden_in_dashboard'`). Authorization mirrors rename (`hasAdminPrivilege`). Cards-grid uses a `:has()` selector so a section whose every member is hidden disappears with its header by default.
10. **Overview timeframe selector** — the static "Last 24 hours" chip in the overview header becomes a `<select>` with four windows (Last 24 hours / Last week / Last month / All time). On change, the page re-fetches `/api/activity?range=<key>` and `/api/tokens/summary?range=<key>` and re-renders the Message Activity chart + Token Usage cells + by-model/by-team breakdowns. The chart bucket granularity adapts (hourly for 24h, daily for week/month, weekly for all-time — capped at the most recent 52 weeks so long-lived installs stay readable). The 24h path stays as snapshot pushes (no extra steady-state cost); other ranges are computed on demand by a `historyProvider` callback exported from `src/dashboard-pusher.ts`. The user's selection persists under `localStorage['ov-window']`. Default is `24h`. For Codex agents whose log timestamps can't be scraped, entries are kept in every range as a best-effort fallback. The new `historyProvider` field must be wired into the `startDashboard(...)` call (see Step 3a below). The **By Model** and **By Team** breakdown tables are sortable by **Requests** and **Cost**: click either column header to sort by it (▼/▲ indicator on the active column, which also gets an `ov-sort-active` highlight); clicking the already-active column toggles descending↔ascending. Default is Cost descending, so the biggest spenders surface first. Sorting is client-side (a single delegated click listener on the static `#ov-token-detail` container, so it survives the innerHTML re-renders triggered by sort toggles and timeframe changes) and re-applies on every render; the per-table sort key + direction are in-memory only (reset on reload). Adding more sortable columns is a one-liner: extend `OV_SORT_FIELDS` (column key → row field) and add an `ovSortTh(table, col, label)` call in the header.
11. **Tasks page** — new `/dashboard/tasks` route listing every active scheduled task across all session inbound DBs, grouped by agent group with collapsible sections. Pulls from the snapshot's new `tasks` array (host scans `kind='task'` rows in pending/processing/paused statuses on every push). Operators can cancel, pause, resume, edit-prompt, and edit-schedule from the dashboard; each action runs through the existing mutator + audit + nudge flow with `canAccessAgentGroup` enforcement (member or higher — more permissive than rename). Cron expressions render human-readable via `cronstrue` (raw cron in tooltip and edit input). Editing happens in a side drawer that opens on row click, with debounced live human-readable cron preview. The drawer renders the prompt as **markdown** — headings, bold, italic, fenced/inline code, bulleted/ordered lists, links, and paragraphs are all formatted via a small client-side escape-first renderer (defined inline in `dist/ui/pages/tasks.js` as `renderMarkdown`). Output is HTML-injection safe: every untrusted character is HTML-escaped before any markdown transform; only `https?:`, `mailto:`, and same-origin links are emitted as `<a>` tags (others fall back to plain text). Action visibility per status matches the underlying scheduling primitives' refusal-to-act semantics: `processing` rows show no action buttons (subdued "currently running" note); `pending` shows Pause+Cancel; `paused` shows Resume+Cancel. Mutators reuse the four primitives in `src/modules/scheduling/db.ts` (`cancelTask`, `pauseTask`, `resumeTask`, `updateTask`); their `id OR series_id` matching means recurring chains are operated on at the live row, not the historical row the agent originally saw. Audit `target_id` is composite `<sessionId>:<taskId>` since `taskId` isn't globally unique across session DBs. The host's `startDashboard` accepts a new `permissions: { canAccessAgentGroup }` callback so the `/api/tasks` route can filter per-viewer without bundling host modules into the dashboard package.

## What this skill is NOT

- Not a replacement for `/add-dashboard`. It assumes the base dashboard is already installed and only patches/extends it.
- Not yet portable to non-Docker container runtimes (Apple Container etc.) — the watchdog shells out to `docker stats` and silently returns `[]` on other runtimes.

## Phase 0: Preflight

Run this from the install root. The skill must NOT proceed if any check fails.

```bash
# Helper — exits with a clear message if anything's wrong.
problems=()
[ -f pnpm-workspace.yaml ] || problems+=("pnpm-workspace.yaml missing — this skill assumes pnpm")
grep -q '@nanoco/nanoclaw-dashboard' package.json 2>/dev/null \
  || problems+=("@nanoco/nanoclaw-dashboard not in package.json — run /add-dashboard first")
[ -f src/dashboard-pusher.ts ] || problems+=("src/dashboard-pusher.ts missing — run /add-dashboard first")
[ -f src/container-runner.ts ] || problems+=("src/container-runner.ts missing")
[ ! -f src/container-stats.ts ] || problems+=("src/container-stats.ts already exists — skill may already be applied")
[ ! -f src/dashboard-tasks.ts ] || problems+=("src/dashboard-tasks.ts already exists — skill may already be applied")
[ ! -f patches/@nanoco__nanoclaw-dashboard@0.3.0.patch ] \
  || problems+=("patches/@nanoco__nanoclaw-dashboard@0.3.0.patch already exists — skill may already be applied")
if [ ${#problems[@]} -gt 0 ]; then
  printf 'PRECONDITION FAILED:\n'; printf '  - %s\n' "${problems[@]}"
  echo 'Resolve the above before re-running.'
  exit 1
fi
echo 'Preconditions OK — safe to apply.'
```

If "skill may already be applied" fires, the operator should inspect what's already in place rather than blindly overwriting. A re-run after a partial install can be done by deleting the offending files first.

## Phase 1: Apply

### 1. Copy the container-stats files

```bash
cp .claude/skills/add-dashboard-pro/resources/container-stats.ts      src/container-stats.ts
cp .claude/skills/add-dashboard-pro/resources/container-stats.test.ts src/container-stats.test.ts
```

`src/container-stats.ts` shells out to `docker ps` (filtered by the install's nanoclaw label) then `docker stats --no-stream`, parses the JSON output, and exposes a `CpuWatchdog` class. Tests are pure (no docker daemon required).

### 2. Replace the pusher with the customized version

The base `/add-dashboard` pusher does not collect container stats and does not run the watchdog. Replace it:

```bash
cp .claude/skills/add-dashboard-pro/resources/dashboard-pusher.ts src/dashboard-pusher.ts
```

The replacement adds:
- A module-level `CpuWatchdog` instance.
- Per-snapshot calls to `collectContainerStats(getActiveContainerNames())`.
- Decoration of each session row with `cpu_percent` / `mem_percent` / `mem_usage_bytes` / `mem_limit_bytes`.
- A new `system: { containers, pinnedSessions }` block.
- Pinned-CPU reasons appended to `health.reasons` (which the dashboard's overview already renders).

If the operator has previously customized `src/dashboard-pusher.ts` themselves, those edits will be lost. The operator should diff before/after and re-apply any local-only changes on top.

### 3a. Add the dashboard CRUD foundation to the host

Three host files come from upstream — copy them into place and wire them into `src/index.ts`:

```bash
# DB migrations + helpers + mutators (skill resources track upstream copies)
cp .claude/skills/add-dashboard-pro/resources/migrations-016-dashboard-audit.ts             src/db/migrations/016-dashboard-audit.ts
cp .claude/skills/add-dashboard-pro/resources/migrations-017-agent-group-hidden-dashboard.ts src/db/migrations/017-agent-group-hidden-dashboard.ts
cp .claude/skills/add-dashboard-pro/resources/db-dashboard-audit.ts                          src/db/dashboard-audit.ts
cp .claude/skills/add-dashboard-pro/resources/db-dashboard-audit.test.ts                     src/db/dashboard-audit.test.ts
cp .claude/skills/add-dashboard-pro/resources/dashboard-mutators.ts                          src/dashboard-mutators.ts
cp .claude/skills/add-dashboard-pro/resources/dashboard-mutators.test.ts                     src/dashboard-mutators.test.ts

# Tasks-page collector helper (consumed by the customised pusher) + tests
cp .claude/skills/add-dashboard-pro/resources/dashboard-tasks.ts               src/dashboard-tasks.ts
cp .claude/skills/add-dashboard-pro/resources/dashboard-tasks.test.ts          src/dashboard-tasks.test.ts
```

Migration 017 adds an `agent_groups.hidden_in_dashboard INTEGER NOT NULL DEFAULT 0` column. The `AgentGroup` type in `src/types.ts` must include `hidden_in_dashboard?: number;` and `updateAgentGroup`'s parameter type in `src/db/agent-groups.ts` must include `'hidden_in_dashboard'` in the `Partial<Pick<...>>`. Apply both edits manually.

The tasks page and the timeframe selector both require host wiring changes — extend the `startDashboard(...)` call in `src/index.ts` to pass a `permissions: { canAccessAgentGroup }` callback (so the dashboard's `/api/tasks` route can filter per-viewer) and a `historyProvider` callback pair (so `/api/activity?range=` and `/api/tokens/summary?range=` can compute on-demand without bundling host modules into the dashboard package):

```ts
// src/index.ts — alongside the existing startDashboard call
import { canAccessAgentGroup } from './modules/permissions/access.js';
import { getActivityForRange, getTokenSummaryForRange } from './dashboard-pusher.js';
// ...
startDashboard({
  // ...existing fields (mutators, resolveActor, etc.)
  permissions: {
    canAccessAgentGroup: (userId, agentGroupId) => canAccessAgentGroup(userId, agentGroupId).allowed,
  },
  historyProvider: {
    activity: getActivityForRange,
    tokenSummary: getTokenSummaryForRange,
  },
});
```

Then edit `src/db/migrations/index.ts` to register `migration016` and `migration017`, edit `src/dashboard-pusher.ts` to import `getRecentAudit` + export `nudgePusher` + include `audit: getRecentAudit(200)` in the snapshot, and edit `src/index.ts` to pass `mutators` + `resolveActor` into `startDashboard` via `buildDashboardMutatorContext()`. The skill ships these snippets in `resources/` for copy/paste:

```bash
# index.ts wiring
cp .claude/skills/add-dashboard-pro/resources/index-snippet.ts /tmp/index-snippet.ts  # human-applied
```

These are manual edits because `src/index.ts`, `src/dashboard-pusher.ts`, and `src/db/migrations/index.ts` are core code that other skills also touch — patching via sed risks future merge conflicts.

Verify after editing:

```bash
grep -q 'buildDashboardMutatorContext' src/index.ts && \
  grep -q 'getActivityForRange' src/index.ts && \
  grep -q 'nudgePusher' src/dashboard-pusher.ts && \
  grep -q 'getActivityForRange' src/dashboard-pusher.ts && \
  grep -q 'migration016' src/db/migrations/index.ts && \
  grep -q 'migration017' src/db/migrations/index.ts && echo OK
```

### 3. Add the `getActiveContainerNames()` export to `src/container-runner.ts`

The pusher needs to map session ids → container names. Add this export next to the existing `getActiveContainerCount` / `isContainerRunning` helpers (search for `export function isContainerRunning`):

```typescript
/** Snapshot of currently-tracked sessionId → container name. Read-only copy. */
export function getActiveContainerNames(): Map<string, string> {
  const out = new Map<string, string>();
  for (const [sid, entry] of activeContainers) out.set(sid, entry.containerName);
  return out;
}
```

This is a manual edit because `container-runner.ts` is core code, not a skill resource — patching it via sed risks future merge conflicts. Verify after editing:

```bash
grep -q 'getActiveContainerNames' src/container-runner.ts && echo OK
```

### 4. Install the dashboard patch (with optional custom logo)

By default the patch ships with the NanoClaw icon as the sidebar logo and favicon. To use a custom logo, do either of:

- Drop a file at the install root named `dashboard-logo.svg` (or `.png`, `.webp`, `.jpg`) before running this step — the skill auto-detects it.
- Set `DASHBOARD_LOGO_PATH=path/to/your-logo.svg` to point at a file elsewhere (overrides the auto-detected one).

The sidebar slot is 80×80 px, so square assets render best. SVG is recommended (sharp at any size + small payload). The chosen file is base64-encoded and baked into the patch — no separate asset is hosted, no runtime read.

```bash
bash .claude/skills/add-dashboard-pro/resources/rebake-dashboard-logo.sh
```

The helper writes `patches/@nanoco__nanoclaw-dashboard@0.3.0.patch`. Commit that file alongside any custom `dashboard-logo.*` for reproducible installs.

To change the logo later, run `/update-dashboard-logo` (the sister skill) — that re-bakes the patch and reapplies it without re-running the full install. Or invoke `bash .claude/skills/add-dashboard-pro/resources/rebake-dashboard-logo.sh && pnpm install && pnpm run build` and restart the service yourself.

Add the `patchedDependencies` entry to `pnpm-workspace.yaml` if it isn't already there:

```yaml
patchedDependencies:
  '@nanoco/nanoclaw-dashboard@0.3.0': patches/@nanoco__nanoclaw-dashboard@0.3.0.patch
```

If the file already has a `patchedDependencies:` block, append the entry inside it. If it has no such block, add one at top level.

### 5. Apply the patch and rebuild

```bash
pnpm install         # applies the patch into node_modules
pnpm run build       # compiles host TS — must finish clean
```

If `pnpm install` complains about `minimumReleaseAge` or `onlyBuiltDependencies`, see CLAUDE.md "Supply Chain Security (pnpm)" — those policies must NOT be bypassed without explicit human approval.

## Phase 2: Verify

### Tests

```bash
pnpm exec vitest run src/container-stats.test.ts src/dashboard-tasks.test.ts src/dashboard-mutators.test.ts
```

Expect: container-stats 20 tests, dashboard-tasks 9 tests, dashboard-mutators 37 tests — all passing.

### Restart and check the dashboard

```bash
# Linux (systemd) — find this install's unit:
for u in $(systemctl --user list-unit-files --no-legend 'nanoclaw-v2-*.service' | awk '{print $1}'); do
  systemctl --user cat "$u" | grep -q "WorkingDirectory=$PWD" && systemctl --user restart "$u" && break
done

# macOS (launchd):
# launchctl kickstart -k gui/$(id -u)/com.nanoclaw
```

Open the dashboard, navigate to **Sessions**: there should be new **CPU** and **Memory** columns with bar fills (color-graded green/yellow/red at <50/<80/≥80%). Within ~60 seconds of the first container spawn, both columns populate. The watchdog needs 5 consecutive snapshots above 80% (~5 minutes) before it surfaces in the health pill on Overview.

On **Overview** the top-right of the header shows the timeframe `<select>` (Last 24 hours / Last week / Last month / All time). Changing it re-fetches `/api/activity?range=…` and `/api/tokens/summary?range=…` and re-renders the activity chart + token usage cells without a full reload. The choice persists across reloads in `localStorage['ov-window']`.

On **Teams** (`/dashboard/agent-groups` — the page label is "Teams"), the toolbar shows a list/card toggle (rightmost control, after the Models filter). Clicking the grid icon flips to a card view that groups lead + sub-agents under collapsible team headers; the chosen mode persists across reloads in `localStorage['ag-view']`.

The wiki redesign is visible at `/dashboard/wikis`.

On **Tasks** (new nav entry between Sessions and Audit), the toolbar shows a search box and status chips (Pending / Processing / Paused). Below it, sections per agent group containing live scheduled tasks. Click a row to open the side drawer; edit prompt or cron and Save — the row updates in <1s via `nudgePusher`. Cancel (with confirmation) removes the task from the page; the audit log on `/dashboard/audit` shows a `task.cancel` row immediately. For `processing` tasks, the drawer is read-only and shows "Currently running" — actions reactivate when the turn completes. Cron expressions render human-readable; raw cron is in the schedule cell's tooltip and the drawer's edit input. A non-admin member of an agent group only sees that group's tasks; owners and global admins see everything.

## Rollback

```bash
rm src/container-stats.ts src/container-stats.test.ts
rm src/dashboard-tasks.ts src/dashboard-tasks.test.ts
rm patches/@nanoco__nanoclaw-dashboard@0.3.0.patch
# Remove the patchedDependencies entry from pnpm-workspace.yaml
# Manually revert src/dashboard-pusher.ts (re-run /add-dashboard's pusher copy step)
# Manually remove the getActiveContainerNames export from src/container-runner.ts
# Manually remove the tasks mutators from src/dashboard-mutators.ts (the cancelTask/pauseTask/resumeTask/updateTask exports + the helpers under the "Task mutators" header)
# Manually remove the permissions and historyProvider callbacks from the startDashboard call in src/index.ts
# Manually remove cronstrue from package.json then re-pin via pnpm install
pnpm install
pnpm run build
```

The dashboard package's npm version is unchanged by the patch — `pnpm install` after removing the patch entry restores the unpatched module.

## Updating

This skill is distributed via the `private-skills` remote (default `https://github.com/businesslifers/nanoclaw.git`) on branch `skill/dashboard-pro`. Re-running `/update-private-skills` will pull new commits when the patch is updated for newer dashboard releases or the watchdog is tuned.
