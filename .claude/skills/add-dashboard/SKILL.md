---
name: add-dashboard
description: Add HTTP dashboard with usage tracking. Monitor live container state, message activity, token usage/costs, task history, and reaction stats. Prereq — skill/status-tracker must be applied first.
---

# Add Dashboard

This skill adds an HTTP dashboard for monitoring NanoClaw and a usage tracking pipeline for token/cost metrics.

## Prerequisites

Status tracker must be applied first:

```bash
test -f src/status-tracker.ts && echo "Status tracker: OK" || echo "Status tracker: MISSING — run /add-status-tracker first"
```

If missing, run `/add-status-tracker` before proceeding.

## Phase 1: Pre-flight

### Check if already applied

```bash
test -f src/dashboard.ts && echo "Already applied" || echo "Not applied"
```

If already applied, skip to Phase 3 (Verify).

## Phase 2: Apply Code Changes

### Ensure the skills remote

```bash
git remote -v
```

If `skills` remote pointing to `https://github.com/businesslifers/nanoclaw.git` is missing, add it:

```bash
git remote add skills https://github.com/businesslifers/nanoclaw.git
```

### Merge the skill branch

```bash
git fetch skills skill/dashboard
git merge skills/skill/dashboard
```

If there are merge conflicts on `package-lock.json`:

```bash
git checkout --theirs package-lock.json
git add package-lock.json
git merge --continue
```

For any other conflict, read the conflicted file and reconcile both sides manually.

This adds:
- `src/dashboard.ts` — HTTP dashboard server (port 3200 by default)
- Usage tracking schema in `src/db.ts` (usage_logs table, logUsage, getUsageByGroup, getUsageRecent, getUsageTotals)
- Dashboard query functions in `src/db.ts` (getMessageContent, getBotReplyAfter, getMessageActivity, getReactionStats, getRecentTaskRunLogs, getTaskRunLogs)
- Usage fields on `ContainerOutput` in `src/container-runner.ts`
- Usage accumulation in `container/agent-runner/src/index.ts`
- Dashboard startup/shutdown and logUsage wiring in `src/index.ts`
- `getSnapshot()` and `isActive()` on GroupQueue in `src/group-queue.ts`

### Configure (optional)

Add to `.env` only if you need non-defaults:

```bash
DASHBOARD_PORT=3200          # default
DASHBOARD_AUTH_TOKEN=<random> # optional — locks the endpoint
```

### Validate code changes

```bash
npm run build
```

Build must be clean before proceeding.

## Phase 3: Verify

### Build and restart

```bash
npm run build
```

Linux:
```bash
systemctl --user restart nanoclaw
```

macOS:
```bash
launchctl kickstart -k gui/$(id -u)/com.nanoclaw
```

### Test the dashboard

```bash
curl -s http://localhost:3200/ | head -20
```

Should return HTML. Open in a browser to see the full dashboard.

If `DASHBOARD_AUTH_TOKEN` is set:

```bash
curl -s -H "Authorization: Bearer <token>" http://localhost:3200/
```

## Removal

1. Delete `src/dashboard.ts`
2. Remove `startDashboard` import and call from `src/index.ts`
3. Remove `dashboardServer` variable and `.close()` call from `src/index.ts`
4. Remove `logUsage` import and call from `src/index.ts`
5. Remove usage fields from `ContainerOutput` in `src/container-runner.ts`
6. Remove usage accumulation from `container/agent-runner/src/index.ts`
7. Remove `usage_logs` table, `UsageLog` interface, and usage query functions from `src/db.ts`
8. Remove dashboard-only query functions from `src/db.ts` (getMessageContent, getBotReplyAfter, etc.)
9. Remove `DASHBOARD_PORT` and `DASHBOARD_AUTH_TOKEN` from `.env`
10. Rebuild: `npm run build && systemctl --user restart nanoclaw`
