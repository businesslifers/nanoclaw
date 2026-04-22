---
name: add-send-file
description: Add the send_file MCP tool so container agents can deliver photos, documents, and PDFs back to chat. Enforces hub-and-spoke authorization (main/hub groups can send anywhere; teams can only send to own chat + hubs).
---

# Add Send File

This skill adds a `send_file` MCP tool that lets the container agent push files (images, PDFs, generated documents) back into the chat channel. Authorization follows the same hub-and-spoke rule as `dispatch_group`: any group → own chat, main/hub → any registered group, team → hub allowed, team → team blocked. Cross-group deliveries auto-prefix the caption with `[File from <source_group>]` for human-visible provenance.

## Phase 1: Pre-flight

### Check if already applied

```bash
grep -l "'send_file'" container/agent-runner/src/ipc-mcp-stdio.ts 2>/dev/null && echo "Already applied" || echo "Not applied"
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
git fetch skills skill/send-file-mcp-tool
git merge skills/skill/send-file-mcp-tool
```

If there are merge conflicts on `package-lock.json`:

```bash
git checkout --theirs package-lock.json
git add package-lock.json
git merge --continue
```

The merge also touches `groups/main/CLAUDE.md` (adds a short "Sending Files" section documenting the hub-and-spoke rule for the main agent). If your main group's CLAUDE.md has local changes, reconcile both sides manually so you keep both your customizations and the sending-files guidance.

For any other conflict, read the conflicted file and reconcile both sides.

This adds:
- `send_file` MCP tool in `container/agent-runner/src/ipc-mcp-stdio.ts` — validates the file exists inside the container, then writes an IPC message with path + optional caption
- `send_file` IPC handler in `src/ipc.ts` — translates `/workspace/group/...` to host paths via `resolveGroupFolderPath`, enforces hub-and-spoke authorization, auto-prefixes cross-group captions, and calls `Channel.sendFile`
- Optional `sendFile(jid, filePath, caption?)` on the `Channel` interface in `src/types.ts` — channels that don't implement it are treated as "not supported" and the tool call returns an error
- `isHub?: boolean` on `RegisteredGroup` and the `is_hub INTEGER DEFAULT 0` column on `registered_groups` (with migration) in `src/db.ts`
- `folder` / `isMain` / `isHub` on `AvailableGroup` so the per-group snapshot respects team/hub visibility
- `sendFile` wiring in `src/index.ts` IPC deps and snapshot filtering in `writeGroupsSnapshot`
- A short "Sending Files" section in `groups/main/CLAUDE.md` documenting the authorization rule for agents

### Enable a group as a hub (optional)

The main group is an implicit hub. To flag an additional coordinator group (e.g. a COO group) as a hub:

```bash
sqlite3 store/messages.db "UPDATE registered_groups SET is_hub = 1 WHERE folder = '<group_folder>';"
```

Hubs can send files to any registered group; teams can only send to their own chat and hubs. Team → team direct sends are blocked server-side regardless of what the agent attempts.

### Validate code changes

```bash
npm run build
npm test
```

Build must be clean and tests must pass before proceeding.

## Phase 3: Verify

### Rebuild container and restart

The agent-runner image has changed, so rebuild:

```bash
./container/build.sh
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

### Test same-group delivery

1. Trigger the main agent and ask it to send a test image back — e.g. "save a screenshot to `/workspace/group/test.png` and send it to this chat via `send_file`."
2. The file should arrive on the channel with no `[File from ...]` prefix (same-group delivery).

### Test cross-group delivery from a hub

1. From the main group, ask the agent to dispatch a file to another registered team (use the team's JID from the groups snapshot).
2. The team's chat should receive the file with caption prefixed `[File from main]`.

### Confirm team → team is blocked

1. Trigger a non-hub team group's agent and ask it to send a file to a peer team's JID.
2. The `send_file` IPC handler must log `Unauthorized send_file ...` and the delivery must not occur.

## Troubleshooting

### Tool call returns "File not found"

The `send_file` tool runs inside the container, so paths must be absolute container paths (usually under `/workspace/group/...`). Host paths like `/home/adam/...` won't resolve.

### Channel doesn't support files

Only channels that implement `Channel.sendFile` can receive files. WhatsApp and Telegram are typical targets; other channels will reject the delivery. Check `src/channels/<channel>.ts` for the method.

### Cross-group delivery silently discarded

Check NanoClaw logs for `Unauthorized send_file`. Team groups can only send to their own chat + hubs. If an intermediate coordinator group should be able to fan files out, mark it `is_hub = 1` in the database.

### Teams can see peer-team JIDs in the snapshot

`writeGroupsSnapshot` is supposed to hide peer-team JIDs from team agents (visibility: main sees all, hubs see all registered, teams see own chat + hubs). If teams are still seeing peer JIDs, confirm `isMain` / `isHub` flags are set correctly and re-check the snapshot on disk under the team's group folder.

## Removal

1. Remove the `send_file` server.tool registration from `container/agent-runner/src/ipc-mcp-stdio.ts`.
2. Remove the `send_file` branch + authorization logic from `src/ipc.ts`.
3. Remove `sendFile` from the `Channel` interface in `src/types.ts` and any implementations in `src/channels/*`.
4. Drop `isHub` from `RegisteredGroup` / the `is_hub` column from `registered_groups` in `src/db.ts` (optional — leaving the column doesn't hurt).
5. Remove `isMain` / `isHub` from `AvailableGroup` and revert snapshot filtering in `writeGroupsSnapshot`.
6. Revert the "Sending Files" section in `groups/main/CLAUDE.md` if desired.
7. Rebuild: `./container/build.sh && npm run build && systemctl --user restart nanoclaw`.
