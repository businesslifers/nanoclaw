---
name: add-reply-to-sender
description: Add reply-to-sender dispatch mechanism. Main agent can ask sub-groups questions and receive answers piped back into its active session. Replaces the request queue.
---

# Add Reply-to-Sender

This skill adds cross-group dispatch and reply functionality. The main agent gets `ask_group` to send questions to sub-groups, and sub-groups get `reply_to_lead` to send answers back.

## Phase 1: Pre-flight

### Check if already applied

Check if `container/skills/reply-to-sender/SKILL.md` exists. If it does, the skill is already installed — skip to Phase 3.

### Check if request queue exists

If `src/request-queue.ts` exists, the old request queue is still installed and will be removed as part of this skill.

## Phase 2: Apply Code Changes

### Ensure remote

```bash
git remote -v
```

If `skills` remote pointing to `https://github.com/businesslifers/nanoclaw.git` is missing, add it:

```bash
git remote add skills https://github.com/businesslifers/nanoclaw.git
```

### Merge the skill branch

```bash
git fetch skills skill/reply-to-sender
git merge skills/skill/reply-to-sender
```

If merge conflicts occur, resolve them preserving both sides' changes (per CUSTOMIZATIONS.md guidelines).

### Build

```bash
npm run build
```

### Run tests

```bash
npx vitest run
```

Ensure `src/customization-integrity.test.ts` passes.

## Phase 3: Verify

1. `container/skills/reply-to-sender/SKILL.md` exists
2. `src/request-queue.ts` does NOT exist (removed)
3. Build is clean: `npm run build`
4. Tests pass: `npx vitest run`
5. The main agent can see `ask_group` in its available tools
6. Sub-group agents can see `reply_to_lead` in their available tools (only functional when dispatched)

## Removal

To remove reply-to-sender:

1. Delete `container/skills/reply-to-sender/`
2. Remove dispatch MCP tools (`ask_group`, `reply_to_lead`) from `container/agent-runner/src/ipc-mcp-stdio.ts`
3. Remove `dispatches` table and functions from `src/db.ts`
4. Remove `ask_group`, `dispatch_reply` cases from `src/ipc.ts`
5. Remove auto-trigger tracking from `src/ipc.ts`
6. Remove dispatch wiring from `src/index.ts`
7. Remove entries from `CUSTOMIZATIONS.md`
8. Rebuild: `npm run build`
