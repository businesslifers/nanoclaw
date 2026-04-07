# Customizations to Upstream NanoClaw

This documents every modification to upstream-shared files. After any merge from `upstream` or skill branches (`whatsapp`, `telegram`), verify each customization still exists. Run `npx vitest run src/customization-integrity.test.ts` as a quick automated check.

## Files We Own (no conflict risk)

These files don't exist upstream — merges can't overwrite them:

| File | Purpose |
|------|---------|
| `src/session-commands.ts` | `/compact` session command handling + `createCanSenderInteract` factory |
| `src/session-commands.test.ts` | Tests for session commands |
| `src/channels/whatsapp.ts` | WhatsApp channel (from `whatsapp` skill remote) |
| `src/channels/whatsapp.test.ts` | WhatsApp tests |
| `src/channels/telegram.ts` | Telegram channel (from `telegram` skill remote) |
| `src/image.ts` / `src/image.test.ts` | Image vision (from `whatsapp` skill) |
| `src/text-styles.ts` | Channel-specific text formatting |
| `src/whatsapp-auth.ts` | WhatsApp QR/pairing auth |
| `src/status-tracker.ts` / `src/status-tracker.test.ts` | Emoji status reactions |
| `container/agent-runner/src/extensions.ts` | Slash commands, agent defs, image loading (extracted from upstream index.ts) |
| `src/request-queue.ts` / `src/request-queue.test.ts` | Inter-group request queue snapshot writer and tests |
| `container/skills/request-queue/SKILL.md` | Container skill — agent instructions for request queue |
| `scripts/version-groups.sh` | Auto-commit group config changes |
| `groups/*/agents.json` | Per-group agent team definitions (Builder, Inspector, Mindy, etc.) — MUST be preserved across updates |

## Upstream-Shared Files (conflict risk)

### `src/db.ts`

| Customization | What to check after merge |
|---------------|--------------------------|
| `is_main` column in `registered_groups` | Schema has `is_main INTEGER DEFAULT 0`, ALTER TABLE migration exists, `setRegisteredGroup` writes it, `getRegisteredGroup`/`getAllRegisteredGroups` read it |
| `is_from_me` in message SELECTs | `getNewMessages` and `getMessagesSince` SELECT include `is_from_me` |
| `reactions` table | Schema, indexes, `storeReaction`, `getLatestMessage`, `getMessageFromMe`, `getMessagesByReaction` |
| Dashboard history queries | `getMessageContent` and `getBotReplyAfter` functions at bottom of file |
| `request_queue` table | Schema with indexes, `QueuedRequest` interface, `createRequest`, `getRequestById`, `getPendingRequests`, `getRequestsForGroup`, `getAllRequests`, `resolveRequest` |

### `src/index.ts`

| Customization | What to check after merge |
|---------------|--------------------------|
| Session command imports | `extractSessionCommand`, `handleSessionCommand`, `isSessionCommandAllowed`, `createCanSenderInteract` from `./session-commands.js` |
| Image imports | `parseImageReferences` from `./image.js` |
| `formatOutboundForChannel` | Imported from `./router.js` (not `formatOutbound` + `ChannelType`) |
| Session command interception in `processGroupMessages` | Block between `// --- Session command interception ---` markers, ~30 lines |
| Session command interception in `startMessageLoop` | Block between `// --- Session command interception ---` markers, ~25 lines |
| `runAgent` signature | Uses optional trailing `opts?: { imageAttachments? }` — NOT a positional param |
| StatusTracker integration | `markReceived`, `markThinking`, `markWorking`, `markAllDone`, `markAllFailed` calls |
| StatusTracker `isTrackedGroup` | Dep is `isTrackedGroup` (returns true for any registered group), NOT `isMainGroup` |
| Follow-up message prefix | Piped messages prefixed with `[FOLLOW-UP]` tag |

### `src/ipc.ts`

| Customization | What to check after merge |
|---------------|--------------------------|
| Send cooldown | `lastSendByGroup` Map, `SEND_COOLDOWN_MS`, key is `${sourceGroup}:${data.chatJid}` |
| Reaction handling | `data.emoji !== undefined` (NOT `data.emoji &&`) — empty string = removal |
| `taskId` passthrough | `schedule_task` case uses `data.taskId \|\| task-...` (prefers agent-generated ID) |
| StatusTracker deps | `statusHeartbeat`, `recoverPendingMessages` in IpcDeps |
| Status reaction IPC | `data.type === 'reaction'` branch with `deps.sendReaction` |
| Request queue IPC | `queue_request` and `resolve_request` cases in `processTaskIpc`, `onRequestsChanged` in `IpcDeps`, request-related fields in data type |

### `container/agent-runner/src/index.ts`

| Customization | What to check after merge |
|---------------|--------------------------|
| Extensions import | `handleContainerSlashCommand`, `loadAgentDefinitions`, `loadImageBlocks`, `ContentBlock` types from `./extensions.js` |
| Slash command call | `slashResult = await handleContainerSlashCommand({...}); if (slashResult.handled) return;` in `main()` |
| Agent definitions call | `const agents = loadAgentDefinitions(log);` in `runQuery()` |
| Image blocks call | `loadImageBlocks(containerInput.imageAttachments, log)` in `runQuery()` |
| Parallel AI MCP servers | `parallel-search` and `parallel-task` HTTP MCP server configs |
| `betas` option | `betas: ['context-1m-2025-08-07']` in SDK query options |
| `agents` spread | `...(agents ? { agents } : {})` in SDK query options |
| Allowed tools | Includes `mcp__parallel-search__*`, `mcp__parallel-task__*` |
| `runQuery()` usage return | Returns `usage: { inputTokens, costUsd }` alongside existing return fields |
| Auto-compaction in query loop | Tracks `cumulativeInputTokens`/`ipcTurnCount`, triggers `/compact` when thresholds exceeded (env: `COMPACTION_TOKEN_THRESHOLD`, `COMPACTION_TURN_THRESHOLD`) |
| `includePartialMessages` streaming | `includePartialMessages: true` in query options, `stream_event` handler logs tool names and thinking status to stderr |

### `container/agent-runner/src/extensions.ts`

| Customization | What to check after merge |
|---------------|--------------------------|
| `handleContainerSlashCommand` return type | Returns `{ handled: boolean; newSessionId?: string }` instead of `boolean` |

### `container/agent-runner/src/ipc-mcp-stdio.ts`

| Customization | What to check after merge |
|---------------|--------------------------|
| `send_message` description | Mentions sub-agents and TeamCreate |
| `taskId` generation | `schedule_task` generates `taskId` locally and returns it to agent |
| `react_to_message` tool | Entire tool definition for emoji reactions |
| `schedule_task` script param | `script` parameter in schedule_task schema |
| Request queue MCP tools | `queue_request`, `list_requests`, `resolve_request` tool definitions |

### `src/types.ts`

| Customization | What to check after merge |
|---------------|--------------------------|
| `thread_id` field | Optional `thread_id?: string` on `NewMessage` |

### `src/router.ts`

| Customization | What to check after merge |
|---------------|--------------------------|
| `formatOutboundForChannel` | Helper that wraps `formatOutbound` with channel type cast |

### `src/config.ts`

| Customization | What to check after merge |
|---------------|--------------------------|
| Compaction threshold config | `COMPACTION_TOKEN_THRESHOLD` and `COMPACTION_TURN_THRESHOLD` read from `.env` via `readEnvFile`, exported as strings with defaults `'80000'` and `'6'` |
| Trigger pattern anchor | `buildTriggerPattern` uses `\b` (word boundary) instead of `^` (start anchor), so `@Derek` triggers anywhere in the message, not just at the start |

### `src/group-queue.ts`

| Customization | What to check after merge |
|---------------|--------------------------|
| `statusTracker` integration | `groupFolder` field on GroupState, passed to status tracker |
| `resetTimeout` on IPC input | `resetTimeout` field on GroupState, stored in `registerProcess()`, called in `sendMessage()` |

### `src/container-runner.ts`

| Customization | What to check after merge |
|---------------|--------------------------|
| OneCLI SDK integration | `onecli.applyContainerConfig()` call in `buildContainerArgs()` with `agent: agentIdentifier` |
| `OLLAMA_ADMIN_TOOLS` env | Forwarded to container as `OLLAMA_ADMIN_TOOLS=true` when config is set |
| Compaction threshold env | `COMPACTION_TOKEN_THRESHOLD` and `COMPACTION_TURN_THRESHOLD` forwarded to container via `-e` flags |
| Usage output in `ContainerOutput` | `usage` field with `inputTokens`, `outputTokens`, `cacheReadInputTokens`, `cacheCreationInputTokens`, `costUsd` |
| Image attachments in `ContainerInput` | `imageAttachments` field passed through to container |
| `resetTimeout` via `onProcess` | `onProcess` callback includes `resetTimeout` param, called after timeout is defined |
| `onStderr` callback | Optional `onStderr` param on `runContainerAgent` for live agent activity tracking |

### `src/index.ts` (additional)

| Customization | What to check after merge |
|---------------|--------------------------|
| `ensureOneCLIAgent()` | Called in `loadState()` for existing groups and in `registerGroup()` for new ones |
| Dashboard startup | `startDashboard(deps)` called in `main()`, `dashboardServer?.close()` in shutdown |
| Usage logging | `logUsage()` called in `wrappedOnOutput` when container reports usage |
| `onStderr` wiring | `onStderr` callback passed to `runContainerAgent` feeding `statusTracker.setActivity()` |
| Request queue imports | `getAllRequests` from `./db.js`, `writeRequestsSnapshot` from `./request-queue.js` |
| Request queue wiring | `writeRequestsSnapshot` call in `runAgent()`, `onRequestsChanged` callback in `startIpcWatcher` deps |

## Post-Merge Checklist

After any merge from upstream or skill branches:

1. `npm run build` — must be clean
2. `npx vitest run` — all tests must pass
3. `npx vitest run src/customization-integrity.test.ts` — **critical** — catches silent regressions
4. Scan this file's tables against the merged diff
5. If a skill branch conflicts with our customizations, resolve by keeping both sides' changes
