---
tags: [nanoclaw, platform, overview]
source: https://docs.nanoclaw.dev
updated: 2026-04-08
---

# NanoClaw — Overview

NanoClaw is a lightweight, open-source (MIT) personal AI assistant that runs Claude agents in isolated containers and connects to messaging platforms. It prioritises security, simplicity, and full user ownership over feature richness.

> **Current version**: v1.2.52 (2026-04-05)

## Philosophy

| Principle | What it means |
|---|---|
| Small enough to understand | ~43.7k tokens total; one process, a handful of files |
| Secure by isolation | True container isolation — not just permission checks |
| Built for the individual | Fork it; Claude Code modifies it to your exact needs |
| Skills over features | New capabilities via skills (git branches), not codebase bloat |
| AI-native setup | Claude Code guides setup, diagnosis, and customisation |

## Key features

- **Container isolation** — agents run in Linux containers (Apple Container on macOS, Docker elsewhere); only explicitly-mounted paths are visible
- **Multi-messenger** — WhatsApp, Telegram, Discord, Slack, Gmail (each added via skill)
- **Isolated group contexts** — each group has its own CLAUDE.md, filesystem, and session
- **Agent Swarms** — Claude Code experimental multi-agent orchestration enabled by default
- **Scheduled tasks** — cron, interval, or one-time tasks that run Claude and optionally message back
- **Wiki knowledge base** — per-group persistent wiki via `/add-karpathy-llm-wiki` (v1.2.50+)
- **OneCLI credential vault** — credentials never enter containers; injected at gateway level

## Core architecture (in brief)

```
Channel (WA/TG/DC/Slack/Gmail)
  → SQLite message store
    → 2s polling loop
      → Group Queue (concurrency limit 5)
        → Container (Claude Agent SDK)
          → Response back via channel
```

- **Single Node.js process** — no microservices
- **SQLite** — per-group message queue, task store, session state
- **IPC via filesystem** — containers write JSON to `data/ipc/` for host to action
- **Task Scheduler** — polls DB every 60s for due tasks

## Key source files

| File | Purpose |
|---|---|
| `src/index.ts` | Orchestrator: state, message loop, agent invocation |
| `src/channels/*.ts` | Channel adapters |
| `src/ipc.ts` | IPC watcher and task processing |
| `src/router.ts` | Message formatting and outbound routing |
| `src/group-queue.ts` | Per-group queue with global concurrency limit |
| `src/container-runner.ts` | Spawns streaming agent containers |
| `src/task-scheduler.ts` | Scheduled task runner |
| `src/db.ts` | SQLite operations |

## Our setup

We run NanoClaw with the following groups:
- **Main** — Derek (this instance); admin, hub-and-spoke coordinator
- **Content Team** (`whatsapp_content-team`) — content production for 6 sites
- **Ghost Team** (`whatsapp_ghost-team`) — Ghost CMS infrastructure
- **Insights Team** (`whatsapp_insights-team`) — GSC/GA4/Ghost analytics

All credential access is via OneCLI Agent Vault. No credentials in git or workspace files.

## Related pages

- [Architecture deep dive](nanoclaw-architecture.md)
- [Groups & isolation](nanoclaw-groups.md)
- [Security model](nanoclaw-security.md)
- [Scheduled tasks](nanoclaw-tasks.md)
- [Agent Swarms](nanoclaw-agent-swarms.md)
- [Changelog](nanoclaw-changelog.md)
