---
name: add-dashboard-pro
description: Layer the businesslifers customizations onto the base NanoClaw dashboard — wiki-page redesign, per-container CPU/memory columns on the Sessions table, list/card view toggle on Agent Groups, and a CPU-pinned watchdog that flips system health to "degraded" when any container stays above 80% CPU for ~5 minutes. Requires /add-dashboard to have been run first.
---

# /add-dashboard-pro — businesslifers dashboard customizations

Adds six things on top of the base `/add-dashboard` install:

1. **Wiki page redesign** — restyles the dashboard's `/dashboard/wikis` route (markdown rendering, sidebar layout). Surfaces YAML frontmatter as a metadata bar above the article — `verdict:` (worth-exploring / interesting-but-not-now / pass) as a colored badge, `evaluated:` and `updated:` dates, a clickable source link (preferring `url:` for the href, with `source:` as label fallback), and `tags:` as pills. Code blocks get a hover-revealed copy-to-clipboard button.
2. **Per-container CPU + memory columns** on the `/dashboard/sessions` table, with bar visualisations and color thresholds.
3. **Usage ($) column on the Agent Groups table** — sits between Model and Sessions, shows cumulative API-equivalent USD cost per agent group sourced from `/api/tokens/summary` (`tokens.byGroup[id].costUsd`). Useful for spotting which agents are chewing the most context. Empty rows show "—" instead of "$0.00" so they don't visually compete with active ones; values <$0.01 show as "<$0.01"; the cell `title` attribute carries the full 4-decimal value for hover.
4. **List / card view toggle on Agent Groups** — segmented control in the toolbar (next to Search + Models filter) flips between the existing dense table and a card grid. Cards group lead + sub-agents under collapsible team headers (LEAD/SUB-AGENT/AGENT tags, deterministic gradient avatars from agent id, sessions/running/folder stats, a pulsing dot when any session is running, optional usage badge). The current mode persists in `localStorage` under key `ag-view`; default is `cards`. Search and Model filters apply to both views simultaneously and hide group sections that end up empty after filtering. The **Overview page's Agent Groups section** mirrors the list view's hierarchy: leads first, sub-agents indented underneath with `↳`, same LEAD/AGENT/SUB-AGENT tags — reusing the `.agent-groups-v2` CSS scope so styling stays in lockstep.
5. **CPU-pinned watchdog** — the host pusher tracks each container's CPU over a rolling 5-snapshot window (~5 minutes) and appends a reason to `health.reasons` for any container holding ≥80% CPU. The dashboard's existing health pill turns "degraded" automatically. Built after a v1 install once spent days at 98% CPU silently.
6. **Branding** — sidebar header reads "Dashboard Pro" with the NanoClaw icon next to it, and the same SVG serves as the browser favicon. The icon is inlined into the layout as a base64 data URL (no separate static asset to host or route). Source SVG ships in `resources/nanoclaw-icon.svg`; if it changes, re-run svgo and re-encode the `data:image/svg+xml;base64,…` string in the patch.

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

### 4. Install the dashboard patch

```bash
mkdir -p patches
cp .claude/skills/add-dashboard-pro/resources/dashboard-customizations.patch \
   patches/@nanoco__nanoclaw-dashboard@0.3.0.patch
```

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
pnpm exec vitest run src/container-stats.test.ts
```

Expect 20 tests passing.

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

On **Agent Groups**, the toolbar shows a list/card toggle (rightmost control, after the Models filter). Clicking the grid icon flips to a card view that groups lead + sub-agents under collapsible team headers; the chosen mode persists across reloads in `localStorage['ag-view']`.

The wiki redesign is visible at `/dashboard/wikis`.

## Rollback

```bash
rm src/container-stats.ts src/container-stats.test.ts
rm patches/@nanoco__nanoclaw-dashboard@0.3.0.patch
# Remove the patchedDependencies entry from pnpm-workspace.yaml
# Manually revert src/dashboard-pusher.ts (re-run /add-dashboard's pusher copy step)
# Manually remove the getActiveContainerNames export from src/container-runner.ts
pnpm install
pnpm run build
```

The dashboard package's npm version is unchanged by the patch — `pnpm install` after removing the patch entry restores the unpatched module.

## Updating

This skill is distributed via the `private-skills` remote (default `https://github.com/businesslifers/nanoclaw.git`) on branch `skill/dashboard-pro`. Re-running `/update-private-skills` will pull new commits when the patch is updated for newer dashboard releases or the watchdog is tuned.
