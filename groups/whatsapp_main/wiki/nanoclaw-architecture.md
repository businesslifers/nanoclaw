---
tags: [nanoclaw, architecture, internals]
source: https://docs.nanoclaw.dev/concepts/architecture
updated: 2026-04-08
---

# NanoClaw — Architecture

## High-level data flow

```
Incoming message (WhatsApp / Telegram / Discord / Slack / Gmail)
  → Channel Adapter  (self-registers via factory pattern)
  → SQLite DB        (storeMessage)
  → Router           (polls every 2s, checks trigger pattern)
  → Group Queue      (respects MAX_CONCURRENT_CONTAINERS = 5)
  → Container Runner (Docker/Apple Container)
  → Claude Agent SDK (streaming)
  → Response         (routed back via originating channel)
```

Follow-up messages while a container is already active are **piped directly** via IPC file rather than spawning a new container.

Scheduled tasks enter via the Task Scheduler (polls DB every 60s) and join the same Group Queue.

## Components

### Channel Factory

Uses a registry pattern. Each channel self-registers on startup. Missing credentials → warning + skip. All channels implement a common `Channel` interface so the rest of the system is channel-agnostic.

### Message Router (`src/index.ts`)

- Polls SQLite every 2 seconds
- Filters to registered groups only
- Checks trigger pattern (`@{ASSISTANT_NAME}`)
- Maintains per-group cursor state
- Routes to Group Queue

Main group does **not** require a trigger word — all messages processed.

### Group Queue (`src/group-queue.ts`)

- Max 5 concurrent containers (configurable via `MAX_CONCURRENT_CONTAINERS`)
- Per-group state tracking (active, idle, pending)
- Retry logic: exponential backoff, 5s base, up to 5 retries
- Idle timeout: 30 minutes (containers stay alive for follow-ups)
- Priority: pending tasks before pending messages

### Container Runner (`src/container-runner.ts`)

Lifecycle:
1. Build volume mounts based on group privileges
2. Spawn container (`docker run --rm`)
3. Pass prompt + metadata via stdin JSON
4. Stream stdout/stderr
5. Parse output markers (`---NANOCLAW_OUTPUT_START---` / `---NANOCLAW_OUTPUT_END---`)
6. Auto-cleanup on exit

Timeouts:
- Hard timeout: `CONTAINER_TIMEOUT` (default 30 min)
- Activity-based reset on streaming output
- Grace: at least `IDLE_TIMEOUT + 30s`

Logs: `groups/{name}/logs/container-{timestamp}.log`

### Task Scheduler (`src/task-scheduler.ts`)

- Polls DB every 60 seconds
- Schedule types: **cron**, **interval** (ms), **once** (ISO timestamp)
- Tasks run in group context with full agent capabilities
- Results sent to group chat or silently
- Auto-closes container 10s after producing output

### IPC Watcher (`src/ipc.ts`)

Watches `data/ipc/{group}/messages/*.json` and `data/ipc/{group}/tasks/*.json`.

Available operations:
- `send_message` — send to own group chat (non-main groups cannot target other chats)
- `schedule_task`, `pause_task`, `resume_task`, `cancel_task`, `update_task`
- `register_group`, `refresh_groups` — **main group only**

Atomic writes (`.tmp` → rename) prevent race conditions. Per-group IPC namespace prevents cross-group privilege escalation.

### Database (`store/messages.db`)

Tables:
| Table | Contents |
|---|---|
| `messages` | All messages; sender, timestamp, is_from_me, reply context |
| `chats` | Chat metadata (name, last activity, channel, is_group) |
| `sessions` | Claude session IDs per group folder |
| `registered_groups` | Active groups; folder, trigger, container_config, is_main |
| `router_state` | Message cursors and last-processed timestamps |
| `scheduled_tasks` | Task definitions; schedule, context_mode, status |
| `task_run_logs` | Execution history; duration, results |

Query cap: `MAX_MESSAGES_PER_PROMPT` (default 10) per invocation.

## Session management

- Stored at `data/sessions/{group}/.claude/`
- Auto-compact at **165k tokens** (v1.2.48+)
- Settings per group:
  - `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` — enable sub-agent orchestration
  - `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1` — load CLAUDE.md from all mounts
  - `CLAUDE_CODE_DISABLE_AUTO_MEMORY=0` — enable persistent memory

## Container image

- Base: `node:22-slim`
- Browser: Chromium + all deps
- Tools: `agent-browser` CLI, `curl`, `git`
- Runtime: `@anthropic-ai/claude-code`
- User: `node` (uid 1000, non-root)
- Working directory: `/workspace/group`

## Filesystem layout

```
nanoclaw/
├── src/                     # Host process source
├── container/
│   ├── Dockerfile
│   ├── agent-runner/        # TypeScript SDK wrapper
│   └── skills/              # Shared skills (synced to groups on startup)
├── groups/
│   ├── main/
│   │   ├── CLAUDE.md
│   │   └── logs/
│   └── {group-name}/
├── data/
│   ├── sessions/{group}/
│   │   ├── .claude/settings.json
│   │   └── agent-runner-src/  # Per-group writable copy; recompiled on startup
│   └── ipc/{group}/
│       ├── messages/
│       ├── tasks/
│       └── input/
└── store/
    ├── messages.db
    └── auth/
```

## Startup sequence

1. Container system check (Docker running, orphan cleanup)
2. DB init (create tables if needed)
3. State loading (cursors, sessions, registered groups)
4. OneCLI Agent Vault sync (non-blocking)
5. Remote Control restore
6. Shutdown handlers registered
7. Channel connections
8. Subsystems: scheduler (60s), IPC watcher (1s), message loop (2s)
9. Crash recovery (unprocessed messages)
10. Ready

## Graceful shutdown

On SIGTERM/SIGINT:
- GroupQueue stops accepting new work
- Active containers are **detached** (not killed) — prevents data loss
- Channels disconnect
- Exit code 0

## Related pages

- [NanoClaw overview](nanoclaw-overview.md)
- [Groups & isolation](nanoclaw-groups.md)
- [Security model](nanoclaw-security.md)
- [Scheduled tasks](nanoclaw-tasks.md)
