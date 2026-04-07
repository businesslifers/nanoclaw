---
tags: [nanoclaw, groups, isolation, registration]
source: https://docs.nanoclaw.dev/concepts/groups
updated: 2026-04-08
---

# NanoClaw — Groups & Isolation

## What is a group?

A group is:
- A group chat or 1:1 conversation on any connected channel (identified by `jid`)
- A dedicated folder under `groups/{name}/`
- An isolated Claude conversation session
- A set of permissions and mount configurations
- A separate IPC namespace

Groups are the **fundamental isolation boundary** in NanoClaw.

## Group types

### Main group (admin)

- Typically a self-chat or DM with the bot on the primary platform
- Full administrative privileges
- Can manage other groups, schedule tasks for any group
- Read-write access to project root (others get nothing)
- Folder always named `main`
- No trigger word required

### Non-main groups

- One per group chat / conversation
- Limited to their own context
- Cannot access other groups' data
- Cannot send messages to other chats
- Require trigger pattern (`@{ASSISTANT_NAME}`) unless disabled via `requiresTrigger: false`

## Registration

Groups must be registered before the agent will respond. Main group performs registration via the `register_group` IPC command.

### Data structure

```typescript
interface RegisteredGroup {
  name: string;               // Display name
  folder: string;             // Filesystem folder (alphanumeric + dash/underscore only)
  trigger: string;            // Trigger pattern regex
  added_at: string;           // ISO timestamp
  requiresTrigger?: boolean;  // Default: true (false for main)
  isMain?: boolean;
  containerConfig?: {
    timeout?: number;
    additionalMounts?: AdditionalMount[];
  };
}
```

Folder names **cannot be changed after registration**. Use descriptive names (e.g. `content-team` not `group1`).

## Isolation mechanisms

### 1. Filesystem

| Path | Main | Non-main |
|---|---|---|
| Own group folder | Read-write | Read-write |
| Project root | Read-only | Not mounted |
| SQLite DB (`store/`) | Read-write | Not mounted |
| Global memory (`groups/global/`) | Via project mount | Read-only mount |
| Other groups' folders | Via project root (ro) | Not accessible |
| Additional mounts | Configurable | Read-only (default) |

### 2. Session isolation

Each group has a separate Claude conversation session at `data/sessions/{group}/.claude/`. Groups cannot see each other's conversation history, file reads, or memory.

### 3. IPC namespace isolation

Each group's IPC directory (`data/ipc/{group}/`) is isolated. Groups cannot:
- Send messages on behalf of other groups
- Schedule tasks for other groups
- See other groups' task lists

### 4. Message cursor isolation

Per-group cursors track last-processed message. Crash recovery works independently per group.

## Global memory

`groups/global/CLAUDE.md`:
- Writable only by main group
- Read-only for all other groups
- Shared instructions and context available to all agents
- Useful for: shared business facts, cross-team instructions, user preferences

## Trigger pattern

Non-main groups activate on `@{ASSISTANT_NAME}` by default. Messages without trigger are stored in DB and included as context when trigger eventually arrives — they're not discarded.

Trigger checks:
1. Message content matches pattern
2. Sender is in the sender allowlist

`requiresTrigger: false` disables the check (useful for private/automated contexts).

## Additional mounts

```typescript
interface AdditionalMount {
  hostPath: string;         // Absolute path on host (or ~/ tilde notation)
  containerPath?: string;   // Relative path → mounted at /workspace/extra/{value}
  readonly?: boolean;       // Default: true
}
```

Example (our Insights Team):
```json
{
  "additionalMounts": [
    {
      "hostPath": "~/nanoclaw-secrets/insights",
      "containerPath": "insights-creds",
      "readonly": true
    }
  ]
}
```

This mounts as `/workspace/extra/insights-creds` inside the container.

Security validation:
- Checked against `~/.config/nanoclaw/mount-allowlist.json`
- Symlinks resolved before validation
- Blocked patterns: `.ssh`, `.env`, etc.
- `nonMainReadOnly` enforced for non-main groups

## Inter-group communication

**Groups cannot communicate directly.** Non-main groups cannot send messages to other chats. The pattern is:

1. Group A queues a request via `mcp__nanoclaw__queue_request`
2. Main Derek sees it in the 6pm digest
3. Adam approves
4. Main Derek schedules a task targeting Group B with `target_group_jid`
5. Group B receives the message

**Important:** `resolve_request` auto-forwards to the requester by default. If a request is *for* another team (e.g. "Insights for Content Team"), **manually forward** to the correct group — do not rely on auto-forwarding.

## Group lifecycle

**Creation:**
1. Main registers via `register_group` IPC
2. Folder + session + IPC dirs created
3. CLAUDE.md template copied
4. Skills synced
5. Added to DB

**Removal (manual):**
```sql
DELETE FROM registered_groups WHERE folder = '{folder}';
```
Then optionally remove `groups/{folder}/`, `data/sessions/{folder}/`, `data/ipc/{folder}/`.

## Our groups

| Group | Folder pattern | Notes |
|---|---|---|
| Main (Derek) | `main` | Admin, hub for inter-team comms |
| Content Team | `whatsapp_content-team` | 6 content sites, Ghost publishing |
| Ghost Team | `whatsapp_ghost-team` | Ghost CMS infra, themes |
| Insights Team | `whatsapp_insights-team` | GSC/GA4/Ghost analytics |

## Related pages

- [NanoClaw overview](nanoclaw-overview.md)
- [Architecture](nanoclaw-architecture.md)
- [Security model](nanoclaw-security.md)
