---
name: add-status-tracker
description: Add emoji status lifecycle tracking and reaction support. Automatically reacts to messages with progress emoji (received → thinking → working → done/failed), heartbeat monitoring, crash recovery, and the react_to_message MCP tool.
---

# Add Status Tracker

This skill adds automatic emoji status tracking and reaction support to NanoClaw. Every inbound message gets progress emoji (👀→🤔→⚙️→✅/❌) showing processing state.

## Phase 1: Pre-flight

### Check if already applied

```bash
test -f src/status-tracker.ts && echo "Already applied" || echo "Not applied"
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
git fetch skills skill/status-tracker
git merge skills/skill/status-tracker
```

If there are merge conflicts on `package-lock.json`:

```bash
git checkout --theirs package-lock.json
git add package-lock.json
git merge --continue
```

For any other conflict, read the conflicted file and reconcile both sides manually.

This adds:
- `src/status-tracker.ts` — StatusTracker class with emoji lifecycle state machine, persistence, heartbeat, and recovery
- `src/status-tracker.test.ts` — Unit tests (38 tests)
- Reaction support in `src/db.ts` (reactions table, storeReaction, getMessageFromMe, getLatestMessage, getMessagesByReaction)
- Status tracking in `src/index.ts` (markReceived/markThinking/markWorking/markDone/markFailed calls, onStderr activity tracking)
- IPC reaction handling in `src/ipc.ts` (heartbeat, recovery, reaction routing)
- `resetTimeout` in `src/group-queue.ts` (container timeout reset on IPC input)
- `onStderr` callback in `src/container-runner.ts` (agent activity forwarding)
- `react_to_message` MCP tool in `container/agent-runner/src/ipc-mcp-stdio.ts`
- `sendReaction` and `reactToLatestMessage` on Channel interface in `src/types.ts`

### Validate code changes

```bash
npm run build
npx vitest run src/status-tracker.test.ts
```

Build must be clean and tests must pass before proceeding.

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

### Test status tracking

1. Send a message to a registered group
2. Watch for emoji reactions appearing on the message:
   - 👀 = received
   - 🤔 = thinking (container spawning)
   - ⚙️ = working (first output seen)
   - ✅ = done / ❌ = failed

### Test agent reactions

Ask the agent to react to a message. It should use the `react_to_message` MCP tool.

## Removal

1. Delete `src/status-tracker.ts` and `src/status-tracker.test.ts`
2. Remove StatusTracker imports and all `statusTracker.*` calls from `src/index.ts`
3. Remove `statusHeartbeat`, `recoverPendingMessages`, `sendReaction` from `src/ipc.ts`
4. Remove `resetTimeout` from `src/group-queue.ts`
5. Remove `react_to_message` tool from `container/agent-runner/src/ipc-mcp-stdio.ts`
6. Remove reactions table/functions from `src/db.ts`
7. Remove `sendReaction`/`reactToLatestMessage` from `src/types.ts`
8. Remove `onStderr` from `src/container-runner.ts`
9. Rebuild: `npm run build && systemctl --user restart nanoclaw`
