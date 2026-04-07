---
name: add-auto-compact
description: Add automatic context compaction for multi-turn piped conversations. Prevents unbounded token growth, escalating costs, and timeout crashes by compacting after configurable thresholds. Also fixes container timeout not resetting on IPC input.
---

# Add Auto-Compaction

Adds automatic context compaction to prevent unbounded token growth in multi-turn piped conversations. When a user has a rapid back-and-forth with the agent, each turn sends the full conversation history to the API, causing linear cost growth (~38K tokens/turn). This skill compacts the context after configurable thresholds.

Also fixes a bug where the container hard timeout does not reset when new messages are piped via IPC, causing containers to be killed while actively processing follow-up messages.

**Depends on:** `/add-compact` (must be applied first -- provides the `/compact` slash command infrastructure)

## Phase 1: Pre-flight

Check if auto-compaction is already applied:

```bash
grep -q 'COMPACTION_TOKEN_THRESHOLD' container/agent-runner/src/index.ts && echo "Already applied" || echo "Not applied"
```

If already applied, skip to Phase 3 (Verify).

Check that `/add-compact` has been applied (required dependency):

```bash
test -f src/session-commands.ts && echo "Compact skill present" || echo "ERROR: Run /add-compact first"
```

## Phase 2: Apply Code Changes

First, check which remote has the skill branch:

```bash
git branch -r | grep skill/auto-compact
```

If no remote has it, the `skills` remote needs to be added. Check if it exists:

```bash
git remote -v | grep skills || echo "skills remote not found"
```

If the `skills` remote is missing, add it:

```bash
git remote add skills https://github.com/businesslifers/nanoclaw.git
git fetch skills
```

Then merge the skill branch from whichever remote has it (typically `skills` for custom skills, or `upstream` if accepted upstream):

```bash
git fetch skills skill/auto-compact
git merge skills/skill/auto-compact
```

This adds:

### Agent-side (container/agent-runner/)

- **`src/index.ts`**: `runQuery()` now returns `usage: { inputTokens, costUsd }`. Query loop tracks cumulative input tokens and IPC turn count, triggering `/compact` when thresholds are exceeded.
- **`src/extensions.ts`**: `handleContainerSlashCommand()` now returns `{ handled: boolean; newSessionId?: string }` instead of `boolean`, allowing the caller to capture the post-compaction session ID.

### Host-side (src/)

- **`src/container-runner.ts`**: `onProcess` callback now passes `resetTimeout` function, allowing callers to reset the container hard timeout.
- **`src/group-queue.ts`**: Stores `resetTimeout` in `GroupState` via `registerProcess()`. Calls `state.resetTimeout?.()` in `sendMessage()` when piping IPC messages to active containers.
- **`src/index.ts`**: Passes `resetTimeout` through `onProcess` callbacks to `queue.registerProcess()`.
- **`src/task-scheduler.ts`**: Passes `resetTimeout` through `onProcess` callbacks.

### Configure thresholds

Add the compaction thresholds to `.env`. If they're not already present, append them:

```bash
grep -q 'COMPACTION_TOKEN_THRESHOLD' .env || cat >> .env << 'ENVEOF'

# Auto-compaction thresholds (tokens / IPC turns before compacting context)
COMPACTION_TOKEN_THRESHOLD=80000
COMPACTION_TURN_THRESHOLD=6
ENVEOF
```

Then ask the user if they want to adjust the defaults using AskUserQuestion:
- **Default (80K tokens / 6 turns)** — good balance of cost and context quality
- **Aggressive (50K tokens / 4 turns)** — lower cost, more frequent compaction
- **Conservative (120K tokens / 10 turns)** — richer context, higher cost

If they pick a non-default option, update the values in `.env` accordingly.

### Validate

```bash
npm test
npm run build
```

### Rebuild container

```bash
./container/build.sh
```

### Restart service

```bash
# macOS
launchctl kickstart -k gui/$(id -u)/com.nanoclaw

# Linux
systemctl --user restart nanoclaw
```

## Phase 3: Verify

### Integration Test

1. Start NanoClaw: `npm run dev`
2. Send 4-5 rapid back-and-forth messages to the agent in WhatsApp PM (or any main channel)
3. Monitor logs:
   ```bash
   # macOS
   log stream --predicate 'process == "node"' --level info

   # Linux
   journalctl --user -u nanoclaw -f
   ```
4. Verify:
   - Container logs show `Proactive compaction: <N> input tokens across <N> IPC turns` after threshold is exceeded
   - `Compact boundary observed` appears (confirms SDK compacted)
   - Subsequent turns return to ~30K input tokens (visible in usage output)
   - Conversation continues coherently after compaction (agent retains summarized context)
5. Test timeout reset:
   - Send a message that triggers a long-running agent task
   - While it's processing, send another message
   - Verify the container is not killed prematurely (no "Container timeout" in logs)

### Threshold Tuning

Both thresholds are configurable via environment variables:

| Variable | Default | Purpose |
|----------|---------|---------|
| `COMPACTION_TOKEN_THRESHOLD` | `80000` | Compact when cumulative input tokens exceed this value |
| `COMPACTION_TURN_THRESHOLD` | `6` | Compact after this many IPC turns regardless of token count |

Set these in your `.env` file or service configuration:

```bash
# Example: more aggressive compaction
COMPACTION_TOKEN_THRESHOLD=50000
COMPACTION_TURN_THRESHOLD=4

# Example: less aggressive compaction
COMPACTION_TOKEN_THRESHOLD=120000
COMPACTION_TURN_THRESHOLD=10
```

**Choosing thresholds:**
- Lower values = more frequent compaction = lower cost but agent loses fine-grained context more often
- Higher values = less compaction = richer context but higher cost and risk of rate limits
- The default of 80K was chosen based on real-world data: 75K tokens was still fast, 114K showed degradation, 150K+ caused rate limits and crashes

## What This Does

- Prevents unbounded context growth in multi-turn piped conversations
- Reduces per-message cost from linear growth to bounded (resets to ~30K after compaction)
- Prevents timeout crashes caused by rate-limited API calls on large contexts
- Fixes container timeout not resetting when IPC messages are piped in

## What This Does NOT Do

- No changes to single-turn behavior (first message in a container is unaffected)
- No changes to the 1M context window beta flag (still available for large single-turn tasks)
- No changes to the manual `/compact` command (still works independently)
- No changes to the container image or Dockerfile

## Troubleshooting

- **Compaction not triggering**: Check that `COMPACTION_TOKEN_THRESHOLD` is not set too high. The default of 80000 should trigger after 2-3 typical exchanges.
- **Agent seems forgetful after compaction**: This is expected -- compaction summarizes earlier turns. The full transcript is archived in `groups/{folder}/conversations/` by the PreCompact hook.
- **"compact_boundary was not observed"**: The SDK may not emit this in all versions. Compaction may still have succeeded. Check if subsequent turn token counts decreased.
