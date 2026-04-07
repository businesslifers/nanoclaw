---
tags: [nanoclaw, agent-swarms, multi-agent]
source: https://docs.nanoclaw.dev/features/agent-swarms
updated: 2026-04-08
---

# NanoClaw — Agent Swarms

## Overview

Agent Swarms allow a single Claude agent to orchestrate multiple specialised sub-agents that collaborate on complex tasks. NanoClaw enables this by default in all agent containers.

> NanoClaw is the first personal AI assistant to support Agent Swarms. This is powered by Claude Code's experimental agent teams feature (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`).

## How it works

The main agent coordinates sub-agents automatically:

```
Main Agent (orchestrator)
  → Delegates tasks to sub-agents
  → Coordinates results
  → Responds to user

        ├── Sub-Agent 1 (Research)
        ├── Sub-Agent 2 (Analysis)
        └── Sub-Agent 3 (Writing)
```

Each sub-agent runs in its own Claude Code session with independent context but access to the same mounted filesystems.

## Coordination patterns

**Sequential:** Step 1 → wait → Step 2 → wait → Step 3

**Parallel:** Spawn multiple agents simultaneously → wait for all → synthesise

**Hierarchical:** Main agent spawns coordinator agents, which spawn their own workers

## Enabling

Enabled automatically via `settings.json` in each group container:
```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1",
    "CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD": "1",
    "CLAUDE_CODE_DISABLE_AUTO_MEMORY": "0"
  }
}
```

## Memory sharing

All agents in a swarm share access to:
- `/workspace/group/CLAUDE.md` — group memory
- `/workspace/project/CLAUDE.md` — project context (main channel only)
- `/workspace/global/CLAUDE.md` — read-only shared memory

## Container limits

Swarms respect `MAX_CONCURRENT_CONTAINERS` (default 5). Each sub-agent counts toward the limit. Increase if using swarms heavily:
```bash
export MAX_CONCURRENT_CONTAINERS=10
```

## Use cases

- **Research:** One agent searches, another analyses, third writes report
- **Content creation:** Research → draft → edit pipeline
- **Code review:** Style, functionality, security in parallel
- **Data aggregation:** Multiple sources processed simultaneously

## Related pages

- [NanoClaw overview](nanoclaw-overview.md)
- [Architecture](nanoclaw-architecture.md)
