---
name: add-slack-thinking-steps
description: Add Slack "thinking steps" — a live Block Kit task card that fills with the agent's tool calls (✓ done / ⟳ running / ✗ error) as it works, then finalizes to "Done" with the answer beneath. Auto-derived from the Claude SDK tool stream; no agent narration. Slack-only (graceful no-op elsewhere). Triggers on "thinking steps", "slack progress card", "show tool calls in slack".
---

# Slack thinking steps

Renders the agent's tool calls live in the Slack reply thread while it works. Steps are
**auto-derived** from the Claude Agent SDK message stream (no agent effort): each `tool_use`
becomes a task card (⟳ → ✓/✗), grouped into one collapsible "plan" message that updates in
place, then flips to "Done" when the turn ends.

**No package bump.** The installed `@chat-adapter/slack` already exposes `postObject`/`editObject`
(Slack → `chat.postMessage`/`chat.update`, ordinary `chat:write`) and the host renders the card
through them. Non-Slack adapters lack those methods, so the feature is a silent no-op there.

## Architecture (two halves)

- **Producer (container):** `container/agent-runner/src/providers/claude.ts` decomposes `tool_use`
  (start) / `tool_result` (end) blocks into `tool_step` provider events; `poll-loop.ts` writes them
  as `thinking_step` outbound rows (Slack channels only) plus a turn-end `complete` marker.
- **Consumer (host):** `src/channels/thinking-steps.ts` (`ThinkingStepsManager`) keeps a per-turn
  plan model and flushes it via `adapter.postObject`/`editObject` on a ~1.2s throttle (collapses a
  burst into one Slack call), caps the task list (~20, Block-Kit-limit safe), applies a noise gate
  (no card for trivial/fast turns), and finalizes on the `complete` marker (or a 5-min timeout).
  `chat-sdk-bridge.ts` routes `thinking_step` rows to it; `delivery.ts` excludes them from the
  status-tracker ✅/typing hook.

## Pre-flight (idempotent)

All of these present ⇒ already installed; stop. Each `grep` is the install guard for one edit:

```bash
test -f src/channels/thinking-steps.ts && echo "module: present"
grep -q "type: 'tool_step'"            container/agent-runner/src/providers/types.ts        && echo "types: present"
grep -q 'decomposeToolSteps'           container/agent-runner/src/providers/claude.ts       && echo "claude: present"
grep -q "kind: 'thinking_step'"        container/agent-runner/src/poll-loop.ts              && echo "poll-loop: present"
grep -q 'ThinkingStepsManager'         src/channels/chat-sdk-bridge.ts                      && echo "bridge: present"
grep -q "msg.kind !== 'thinking_step'" src/delivery.ts                                      && echo "delivery: present"
```

## Apply

### 1. New module + tests (copy from this skill's payload)

The new files ship in this skill's `resources/` (the install source of truth — no
branch fetch, never clobbers on a failed redirect). Copy them into place:

```bash
SKILL_DIR="$(dirname "$0")"   # or the dir containing this SKILL.md
cp "$SKILL_DIR/resources/src/channels/thinking-steps.ts"      src/channels/thinking-steps.ts
cp "$SKILL_DIR/resources/src/channels/thinking-steps.test.ts" src/channels/thinking-steps.test.ts
cp "$SKILL_DIR/resources/container/agent-runner/src/providers/thinking-steps.test.ts" \
   container/agent-runner/src/providers/thinking-steps.test.ts
```

(For distribution, keep `resources/` in sync with the working tree and dual-target per the
private-skills convention: skill payload → `origin/main` → `private/skill/add-slack-thinking-steps`.)

### 2. Additive patches to existing files (grep-guarded)

These five files carry local drift (the Codex file-delivery patch lives in three of them), so apply
**insertions**, never whole-file overwrites. Each insertion is guarded by its pre-flight `grep` —
skip any that already matches. Insert exactly:

- **`container/agent-runner/src/providers/types.ts`** — extend the `ProviderEvent` union (after the
  `{ type: 'file'; path: string }` member) with:
  ```ts
  | { type: 'tool_step'; toolId: string; title: string; status: 'in_progress' | 'complete' | 'error'; output?: string };
  ```

- **`container/agent-runner/src/providers/claude.ts`** — add the pure helpers and decomposition
  (`THINKING_STEP_SKIP_BUILTIN`, `NANOCLAW_TOOL_PREFIX`, `THINKING_STEP_SKIP_NANOCLAW`,
  `isThinkingStepSkipped`, `clampTitle`, `pathBasename`, `titleForTool`, `summarizeToolResult`, and the
  exported `decomposeToolSteps`) at module scope, and
  inside `translateEvents` (after the per-message `yield { type: 'activity' }` / the
  `task_notification` branch) add, exception-isolated:
  ```ts
  try {
    for (const ev of decomposeToolSteps(message, toolStepTitles)) yield ev;
  } catch (err) {
    log(`thinking-step decomposition error: ${err instanceof Error ? err.message : String(err)}`);
  }
  ```
  with `const toolStepTitles = new Map<string, string>();` declared just before `translateEvents`.

- **`container/agent-runner/src/poll-loop.ts`** — in `processQuery`, before the `for await` loop add
  `let thinkingTurnId = generateId(); let sawThinkingStep = false;`; add a `tool_step` branch that
  `writeMessageOut({ kind: 'thinking_step', … })` (gated `routing.channelType.startsWith('slack')`,
  content `{ op, turn, taskId, title, status, output }`, sets `sawThinkingStep = true`); at the top of
  the `result` branch and in the `catch`/`finally`, call a new `writeThinkingComplete(routing,
  thinkingTurnId)` when `sawThinkingStep` (then reset `sawThinkingStep`/`thinkingTurnId`); and a
  `case 'tool_step'` log line in `handleEvent`.

- **`src/channels/chat-sdk-bridge.ts`** — `import { ThinkingStepsManager, type ThinkingStep } from './thinking-steps.js';`,
  `const thinkingSteps = new ThinkingStepsManager();` in the closure, and at the top of `deliver()`
  (after `tid`/`content`):
  ```ts
  if (message.kind === 'thinking_step') {
    thinkingSteps.onStep(adapter, tid, content as unknown as ThinkingStep);
    return;
  }
  ```

- **`src/delivery.ts`** — in the post-delivery hook, extend the guard:
  ```ts
  if (msg.kind !== 'system' && msg.kind !== 'thinking_step' && msg.channel_type !== 'agent') {
  ```

> If `private/channels` doesn't yet carry these, the authoritative copies are this install's working
> tree — diff against it. The exact source for every insertion is in the working tree at the paths above.

### 3. Build + typecheck

```bash
pnpm run build                                                   # host → dist/ (bridge, delivery, session-db)
pnpm exec tsc -p container/agent-runner/tsconfig.json --noEmit   # container tree typechecks
```

**No image rebuild is needed for this change.** The host mounts `container/agent-runner/src`
read-only into each agent container at `/app/src` at spawn time (`container-runner.ts`), so the
producer change (claude.ts / poll-loop.ts / types.ts) goes live on the **next container spawn** — it
is NOT baked into the image. Only rebuild (`docker builder prune -f && ./container/build.sh`) if you
changed container *dependencies*, which this skill does not.

### 4. Restart the host

The bridge / delivery / session-db changes are **host** code (compiled into `dist/`); the running host
only loads them on restart. First confirm nothing is mid-turn (a SIGTERM mid-turn drops the user's
reply), then restart the v2 unit:

```bash
pnpm exec tsx scripts/q.ts data/v2.db "SELECT count(*) FROM sessions"   # sanity
# verify no in-flight inbound rows / low container CPU before restarting
systemctl --user restart nanoclaw-v2-8aa0b4e2.service   # this install's unit (NOT nanoclaw.service)
```

## Validate

```bash
pnpm exec vitest run src/channels/thinking-steps.test.ts
cd container/agent-runner && bun test src/providers/thinking-steps.test.ts
```

End-to-end: in a Slack thread wired to a Claude group, send a prompt that forces tools — e.g.
*"read package.json, run `ls`, then summarize."* Expect a card that gains "Read package.json"
(⟳→✓), "Ran `ls`" (✓), flips to **Done**, with the answer beneath. Tail `logs/nanoclaw.log` for
`chat.postMessage (plan)` / `chat.update (plan)` and the absence of `ratelimited` / `too_many_blocks`.
A single-tool / instant turn should produce **no** card. The same prompt in a non-Slack group should
produce a normal answer with no card and no errors.

## Configuration

- **Kill-switch:** set `NANOCLAW_THINKING_STEPS=0` in the host environment to disable rendering
  (the container still writes rows; the host drops them). Unset / any other value = on.
- **Tuning** (constants in `src/channels/thinking-steps.ts`): `FLUSH_INTERVAL_MS` (throttle),
  `MAX_VISIBLE_TASKS` (block cap), `MIN_TASKS_BEFORE_CARD` / `MIN_ELAPSED_BEFORE_CARD_MS` (noise gate),
  `TURN_TIMEOUT_MS` (abandoned-turn finalize).
- **Skipped tools** (noise) in `claude.ts`: `THINKING_STEP_SKIP_BUILTIN` (exact builtin names, e.g.
  `TodoWrite`) and `THINKING_STEP_SKIP_NANOCLAW` (the agent's own `mcp__nanoclaw__` tool leaf-names).
  Builtins match by exact name; nanoclaw tools by the exact `mcp__nanoclaw__` prefix — **not** by leaf
  name, so a same-named tool from another MCP server (e.g. `mcp__clickup__send_message`) still shows.

## Troubleshooting

- **No card appears:** confirm the channel is Slack (producer gates on `channelType.startsWith('slack')`),
  the host was restarted (loads the bridge change), and the agent container was respawned *after* the
  source edit (it mounts `container/agent-runner/src` fresh each spawn — kill any long-lived container so
  it picks up the new producer code). A single-/zero-tool turn intentionally shows no card.
- **Card never flips to Done:** the `complete` marker didn't arrive (container died mid-turn) — the
  5-min `TURN_TIMEOUT_MS` finalizes it to "Stopped". **Exception — a host restart mid-turn:** the
  per-turn state (incl. its timeout) lives only in memory, so a card posted just before a restart can
  orphan on "Working…" permanently (the already-delivered rows aren't re-read). Rare and cosmetic; the
  next turn in that thread evicts/replaces it. The user's actual reply is unaffected.
- **Also covers** the `*-team` / multi-agent-per-channel caveat: the card manager assumes one active
  session per Slack thread. Don't wire two agent groups to one channel concurrently or their cards will
  evict each other (the install policy — team channels get dedicated agents — already prevents this).
- **`ratelimited` / `too_many_blocks` in logs:** raise `FLUSH_INTERVAL_MS` / lower `MAX_VISIBLE_TASKS`.

## Removal

See [REMOVE.md](REMOVE.md).
