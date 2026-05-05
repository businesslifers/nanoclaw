# NanoClaw Admin IPC Tools

Last updated: 2026-04-29

## Status

All admin tools are **fully operational** as of Apr 8, 2026 (after multiple rounds of fixes).

## Available Tools

| Tool | Purpose |
|------|---------|
| `mcp__nanoclaw__admin_list_secrets` | List secrets in the vault |
| `mcp__nanoclaw__admin_create_secret` | Create a new secret |
| `mcp__nanoclaw__admin_agent_secrets` | List secrets assigned to an agent/group |
| `mcp__nanoclaw__admin_assign_secrets` | Assign secrets to a group |
| `mcp__nanoclaw__admin_update_container_config` | Add/update container mounts for a group |

## What These Enable

- **Fully self-service team setup** for Raels (from her DM) without Adam's involvement
- Create secrets (API keys, credentials) and assign them to specific channels
- Add extra directory mounts to containers programmatically

## Known Limitation — Mount Allowlist

Adding a **new host path** to a container mount still requires Adam to:
1. Add the path to `~/.config/nanoclaw/mount-allowlist.json` on the host
2. Restart NanoClaw

This is a **deliberate security boundary** — agents must never be able to mount arbitrary host paths. Do not attempt to work around it. If a new mount is needed, surface it to Adam.

## Known Failure Modes

### Authentication expiry — overnight outage (observed 2026-04-12)

Janet responded "Not logged in · Please run /login" from approximately 2026-04-11 21:49 UTC through 2026-04-12 04:04+ UTC (~6+ hours). Cause: short-lived auth token expiry. Result: all messages during that window received the login error; scheduled tasks were missed.

**Resolution**: Adam manually re-authenticated and triggered missed tasks.

**Prevention**: Use only long-lived credentials — either an API key from console.anthropic.com (`ANTHROPIC_API_KEY`) or a long-lived OAuth token via `claude setup-token` (`CLAUDE_CODE_OAUTH_TOKEN`). Short-lived tokens from the system keychain or `~/.claude/.credentials.json` expire within hours. See CLAUDE.md Authentication section.

## History

- Tools were deployed but initially broken — OneCLI not in PATH for MCP server process, IPC listener not running
- Fixed by Adam on Apr 8 after several iterations
- `admin_list_secrets` came online first; `admin_create_secret` / `admin_assign_secrets` / `admin_agent_secrets` followed

### #janet-main crash loop (2026-04-22)

The janet-main channel (C0APY2JNW0P) experienced a sustained crash loop from approximately 02:29 UTC to 03:05 UTC (~35 minutes) on Apr 22. The system logged repeated "Task crashed — retrying" messages at roughly 15–30 second intervals (50+ crash events). The channel recovered on its own after the platform upgrade cycle completed.

**Likely trigger:** Raels asked a question in #janet-main at 02:29 UTC ("janet just confirming that you do sops for me?") which appears to have triggered a crash that the auto-retry mechanism could not recover from until the underlying platform issue was resolved. The concurrent upgrade (ask_group/reply_to_lead dispatch system rolled out that same day) is the most probable cause.

**Impact:** All messages in #janet-main between ~02:29 and 03:05 UTC were unanswered. Raels' work in raels-dm was unaffected and continued normally.

**Recovery:** No manual intervention required — platform self-recovered.

## Querying the Database

`sqlite3` CLI is **not available** in the container. Use node with the full module path instead:

```bash
node -e "
const Database = require('/workspace/project/node_modules/better-sqlite3');
const db = new Database('/workspace/project/store/messages.db', { readonly: true });
const rows = db.prepare('SELECT * FROM registered_groups').all();
console.log(JSON.stringify(rows, null, 2));
db.close();
" 2>&1 | grep -v Warning
```

### `registered_groups` schema (as of Apr 24)

| Column | Type | Notes |
|--------|------|-------|
| jid | text | Primary key, e.g. `slack:C0AQ3KTMBD4` |
| name | text | Short name |
| folder | text | Groups folder under `groups/` |
| trigger_pattern | text | e.g. `@Janet` |
| added_at | text | ISO timestamp |
| container_config | JSON/null | Additional mounts — null if none |
| requires_trigger | int | 0/1 |
| is_main | int | 0/1 — elevated privileges |
| allow_attachments | int | 0/1 — inbound file attachments enabled |
| is_hub | int | 0/1 — hub group flag |

### Useful queries

```bash
# List all groups
SELECT jid, name, folder, requires_trigger, is_main FROM registered_groups;

# Check container config for a specific group
SELECT name, container_config FROM registered_groups WHERE name = 'launchmate';

# Recent messages from all channels
SELECT sender_name, content, timestamp, chat_jid FROM messages
WHERE timestamp >= datetime('now', '-24 hours') ORDER BY timestamp ASC;
```

## Inbound File Handling — Known Limits (Apr 25)

Files sent to Janet in Slack are inline-decoded if small enough and in a supported format. Known limits observed:

| Format | Status | Notes |
|--------|--------|-------|
| JPEG / PNG (small) | Readable | Must be under ~2–3 MB to inline |
| JPEG (≥5 MB) | Too large to inline | Flagged as "too large to inline" — cannot be read |
| WebP | Binary, cannot inline | Not supported for inline decoding |
| .docx | Binary, cannot inline | Word documents cannot be read inline — ask for a URL or paste the text |
| PDF | Readable | Handled via pdf-reader skill |
| Text / CSV | Readable | Standard inline |

**Workaround for large or unsupported files:** Ask the user to share a public URL (e.g. Google Drive link) and fetch/download it. Google Drive links may require browser auth — use `agent-browser` to access. Direct download URLs work without auth.

## Slack Visibility Limits (Apr 29)

Janet can only read messages in **registered channels and DMs**. Janet cannot see:
- Slack DMs or conversations between other users (e.g. Raels and Liam Barrett)
- Channels that are not registered in the `registered_groups` table

**Workaround:** Users who need Janet to work with content from a Slack conversation must paste or summarise it directly into a Janet channel.

## New Capabilities (Apr 24)

| Tool | Purpose |
|------|---------|
| `mcp__nanoclaw__send_file` | Deliver files as Slack attachments via files.uploadV2 — confirmed working Apr 24 |
| `mcp__nanoclaw__ask_group` | Dispatch question to sub-group, reply pipes back into active session |
| Inbound attachments | Janet can now process files sent to her in Slack (images, PDFs, docs) |

## Wiki & Workspace Paths (v2)

Confirmed file system layout as of 2026-05-01:

| Path | Status | Notes |
|------|--------|-------|
| `/workspace/agent/wiki/` | ✅ Exists, read-write | Correct path for this instance's wiki |
| `/workspace/agent/sources/` | ✅ Exists, read-write | Raw source files |
| `/workspace/global/wiki/` | ✅ Exists, **read-only** | Cross-group global wiki — Janet cannot write here |
| `/workspace/group/wiki/` | ❌ Does NOT exist | Pre-existing scheduled task `task-wiki-lint-janet-group` was pointing here — cancelled May 1 |

**Gotcha:** Pre-existing scheduled tasks (from platform setup or templates) may reference incorrect paths. Always verify paths exist with `ls` before relying on them.

**Global wiki write check:** `touch /workspace/global/.write-check 2>/dev/null && echo writable || echo readonly` — returns `readonly` for this instance.

**Implication:** Do not schedule lint tasks for `/workspace/global/wiki/` — Janet cannot write the log entry after the lint run.

## Deferred Tools (v2)

In v2, many MCP tools are **deferred** — their schemas are not loaded at session start. They appear by name in `<system-reminder>` messages but cannot be called until loaded. 

**Pattern:** Use `ToolSearch` with `query: "select:<tool-name>"` to load the schema before calling. Example:
```
ToolSearch({ query: "select:mcp__nanoclaw__schedule_task", max_results: 1 })
// → returns the full JSONSchema, then the tool is callable
```

Tools confirmed deferred in v2 (load before use): `mcp__nanoclaw__schedule_task`, `mcp__nanoclaw__list_tasks`, `mcp__nanoclaw__cancel_task`, `mcp__nanoclaw__send_message`, `mcp__nanoclaw__ask_user_question`, `mcp__nanoclaw__send_card`, `mcp__nanoclaw__create_agent`, and others. Check the system-reminder for the full list each session.

## See also

- [channel-architecture.md](channel-architecture.md) — registered groups and their JIDs
