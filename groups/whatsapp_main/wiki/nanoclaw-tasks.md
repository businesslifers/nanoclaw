---
tags: [nanoclaw, tasks, scheduling, cron]
source: https://docs.nanoclaw.dev/concepts/tasks, https://docs.nanoclaw.dev/api/task-scheduling
updated: 2026-04-08
---

# NanoClaw — Scheduled Tasks

## Overview

Scheduled tasks are automated agent invocations triggered by time rather than user input. They run the same Claude Agent SDK as interactive messages and have full tool access. Results can be sent to the group chat or logged silently.

## Schedule types

| Type | Value format | Example |
|---|---|---|
| **cron** | Standard 5-field cron | `0 9 * * *` (9am daily) |
| **interval** | Milliseconds | `3600000` (every hour) |
| **once** | ISO 8601 timestamp | `2026-03-01T14:30:00Z` |

**Cron runs in configured timezone** (not UTC). Uses `TZ` env var, falls back to system timezone.

**Interval anchoring:** Intervals anchor to the *scheduled* time of previous run to prevent drift. Missed intervals are skipped to next future occurrence.

**Once:** After execution, `next_run` → null and status → `completed`.

## MCP tools

```
mcp__nanoclaw__schedule_task     — create a new task
mcp__nanoclaw__list_tasks        — list tasks (main sees all; others see own)
mcp__nanoclaw__pause_task        — disable without deleting
mcp__nanoclaw__resume_task       — re-enable paused task
mcp__nanoclaw__update_task       — change prompt or schedule
mcp__nanoclaw__cancel_task       — permanently delete (removes run history)
```

## Context modes

| Mode | Session | Use when |
|---|---|---|
| `isolated` (default) | Fresh session per run | Stateless checks, data fetching |
| `group` | Shared with group chat | Tasks needing conversation context |

## Task scripts (cost optimisation)

For tasks running more than ~2x per day, provide a bash `script` alongside the `prompt`. The script runs first; the agent only wakes if needed.

```json
{ "wakeAgent": true/false, "data": {...} }
```

Script must print this JSON to stdout. If `wakeAgent: false` → silent exit, no API call. If `wakeAgent: true` → data injected into prompt and agent runs.

**Test scripts before scheduling:**
```bash
bash -c 'echo "{\"wakeAgent\": true, \"data\": {}}"'
```

## Our standard schedule template

All teams follow this pattern:

| Schedule | Cron | Description |
|---|---|---|
| Daily self-review | `0 6 * * *` | CLAUDE.md review, improvements backlog, agents.json review (Fri/Sun) |
| Mon-Fri pipeline | `0 8 * * 1-5` | Main work pipeline (Mon includes weekly planning) |
| Friday wrap-up | `0 16 * * 5` | Week summary, outstanding items, agents.json review |
| Sunday health review | `0 8 * * 0` | Team health check, schedule review, agents.json review |

## Task privileges

| Operation | Main | Non-main |
|---|---|---|
| Schedule for self | ✓ | ✓ |
| Schedule for other groups | ✓ | ✗ |
| View all tasks | ✓ | Own only |
| Pause/resume/cancel own | ✓ | ✓ |
| Send message to other chats | ✓ | ✗ |

## Task lifecycle

1. Scheduler polls DB every 60s
2. Finds `next_run <= NOW()` and `status = 'active'`
3. Enqueues in GroupQueue (respects 5-container concurrency limit)
4. Container spawned with `isScheduledTask: true`
5. Agent executes prompt
6. Result forwarded to group chat (if `send_message` called)
7. Run logged to `task_run_logs`
8. `next_run` recalculated
9. Container closes after 10s grace period

## Querying task history

```sql
-- Last 10 runs for a task
SELECT * FROM task_run_logs WHERE task_id = 'abc123' ORDER BY run_at DESC LIMIT 10;

-- Recent failures
SELECT * FROM task_run_logs WHERE status = 'error' AND run_at > datetime('now', '-1 day');
```

## Best practices

1. **Use cron for wall-clock times** (`0 9 * * *` not `86400000`)
2. **Use scripts for frequent tasks** — saves API credits
3. **Start with `isolated` context** — add `group` only if needed
4. **Always check task list before claiming no schedule exists** — run `mcp__nanoclaw__list_tasks`
5. **Pause, don't cancel** — if you want to preserve run history
6. **Watch for Monday 8am conflicts** — Mon-Fri pipeline and Monday-specific tasks can fire simultaneously; absorb Monday-specific logic into the Mon-Fri task

## Related pages

- [NanoClaw overview](nanoclaw-overview.md)
- [Architecture](nanoclaw-architecture.md)
- [Groups](nanoclaw-groups.md)
