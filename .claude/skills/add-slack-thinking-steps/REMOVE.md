# Remove: add-slack-thinking-steps

Reverses the install. Each step is independent and grep-guarded — skip any that no longer matches.

## 1. Delete the new files

```bash
rm -f src/channels/thinking-steps.ts \
      src/channels/thinking-steps.test.ts \
      container/agent-runner/src/providers/thinking-steps.test.ts
```

## 2. Revert the additive patches

Remove only the inserted lines (these files carry unrelated local drift — do **not** restore from a
branch wholesale):

- **`container/agent-runner/src/providers/types.ts`** — delete the `| { type: 'tool_step'; … }`
  member from the `ProviderEvent` union (and its doc comment).
- **`container/agent-runner/src/providers/claude.ts`** — delete the thinking-step helpers
  (`THINKING_STEP_SKIP_BUILTIN`, `NANOCLAW_TOOL_PREFIX`, `THINKING_STEP_SKIP_NANOCLAW`, `isThinkingStepSkipped`, `clampTitle`, `pathBasename`,
  `titleForTool`, `summarizeToolResult`, `decomposeToolSteps`), the `toolStepTitles` declaration, and
  the `decomposeToolSteps` loop inside `translateEvents`.
- **`container/agent-runner/src/poll-loop.ts`** — delete the `thinkingTurnId`/`sawThinkingStep`
  declarations, the `tool_step` branch, the `result`/`catch`/`finally` `writeThinkingComplete` calls,
  the `writeThinkingComplete` function, and the `case 'tool_step'` in `handleEvent`.
- **`src/channels/chat-sdk-bridge.ts`** — delete the `ThinkingStepsManager` import, the
  `const thinkingSteps = …` line, and the `if (message.kind === 'thinking_step') { … }` block in `deliver()`.
- **`src/delivery.ts`** — remove `&& msg.kind !== 'thinking_step'` from the post-delivery guard.

## 3. Rebuild + restart

```bash
pnpm run build
pnpm exec tsc -p container/agent-runner/tsconfig.json --noEmit
docker builder prune -f && ./container/build.sh
systemctl --user restart nanoclaw-v2-8aa0b4e2.service
```

## Verify

```bash
grep -rl "thinking_step\|ThinkingSteps\|decomposeToolSteps\|tool_step" src container/agent-runner/src || echo "clean"
pnpm run build && pnpm exec tsc -p container/agent-runner/tsconfig.json --noEmit
```

Any orphaned `thinking_step` rows already in a session's `outbound.db` are harmless: with the consumer
gone they fall through to the channel adapter as an unknown kind and are dropped.
