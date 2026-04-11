---
name: add-admin-ipc
description: Add admin IPC commands so the main agent can manage secrets, groups, sessions, and container config without leaving the chat.
---

# Add Admin IPC Commands

Extends the IPC system with admin commands that let the main-group agent manage OneCLI secrets, registered groups, sessions, and container configuration. All admin commands are **main-group only** — requests from non-main groups are silently blocked with a warning log.

## What it adds

### Host-side admin IPC handlers (`src/ipc.ts`)

| Command | Purpose |
|---------|---------|
| `admin_update_container_config` | Update container mounts and timeout |
| `admin_get_container_config` | Read container config for a group |
| `admin_onecli_list_secrets` | List secrets in OneCLI vault |
| `admin_onecli_create_secret` | Register a new secret |
| `admin_onecli_agent_secrets` | Check which secrets an agent can access |
| `admin_onecli_assign_secrets` | Assign secrets to agents |
| `admin_onecli_delete_secret` | Remove a secret |
| `admin_onecli_update_secret` | Update a secret value |
| `admin_list_groups` | List all registered groups |
| `admin_delete_group` | Unregister a group |
| `admin_reset_session` | Clear a group's session (fresh conversation) |

### Container-side MCP tools (`container/agent-runner/src/ipc-mcp-stdio.ts`)

Adds MCP tool definitions that the container agent can call to issue admin IPC commands.

### Database (`src/db.ts`)

Adds `deleteRegisteredGroup(jid)` for group removal.

### Tests (`src/ipc-auth.test.ts`)

Authorization tests for all admin commands — verifies main-group access and non-main rejection.

## Prerequisites

- OneCLI must be installed for secret management commands to work (`onecli --help`)

## Phase 1: Pre-flight

Check if admin IPC is already applied:

```bash
grep -q 'admin_update_container_config' src/ipc.ts && echo "Already applied" || echo "Not applied"
```

If already applied, skip to Phase 3 (Verify).

## Phase 2: Apply

Merge the skill branch:

```bash
git fetch skills skill/add-admin-ipc
git merge skills/skill/add-admin-ipc
```

> **Note:** `skills` is the remote pointing to the private fork. Substitute your remote name if different.

### Resolve conflicts

If merging onto a codebase with `/add-request-queue` installed, the `src/ipc.ts` imports may conflict. Keep both sets of imports.

### Build and test

```bash
npm run build
npm test
```

## Phase 3: Verify

1. Start the service and send a message from the main group
2. The main agent should be able to use admin IPC tools (list secrets, list groups, etc.)
3. Verify non-main groups cannot execute admin commands (check logs for "Unauthorized" warnings)
