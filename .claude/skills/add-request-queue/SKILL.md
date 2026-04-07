---
name: add-request-queue
description: Add inter-group request queue. Sub-agents can queue requests for the lead's review, which are presented as a daily digest for approval or denial. Outcomes are relayed back to requesting groups.
---

# Add Request Queue

This skill adds a request queue system for inter-group communication via batched approval.

## Phase 1: Pre-flight

### Check if already applied

Check if `src/request-queue.ts` exists. If it does, skip to Phase 3 (Setup). The code changes are already in place.

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
git fetch skills skill/request-queue
git merge skills/skill/request-queue
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

Ensure `src/customization-integrity.test.ts` passes — it validates the request queue schema and IPC handling.

## Phase 3: Setup

### Create the digest scheduled task

Use `AskUserQuestion` to ask the user what time they'd like the daily digest. Default suggestion: 6 PM local time.

Then tell the user to message their main group with the instruction below, replacing `[TRIGGER]` with their trigger word and `[TIME]` with their chosen time (e.g. "6pm", "8am"):

---

**Message to send to your main group:**

> [TRIGGER] Schedule a daily task at [TIME] with context_mode "group" and the following prompt:
>
> Review the request queue. Read /workspace/ipc/current_requests.json for pending cross-group requests.
>
> If there are no pending requests, wrap your entire output in `<internal>` tags so nothing is sent — there is nothing to report.
>
> If there ARE pending requests, send a message using send_message with a numbered digest like this:
>
> **Request Queue** (N pending)
>
> 1. [req-xxx] From **Group Name**: "Short summary here"
>    Detail: Additional context if provided
>    Submitted: relative time ago
>
> 2. [req-yyy] From **Other Group**: "Another summary"
>    Submitted: relative time ago
>
> Then add: "Reply with your decisions — e.g. 'approve 1, deny 2 — theme isn't ready yet'"
>
> When I reply with decisions, process each one using resolve_request:
> - For approvals: set resolution to "approved", include my reason if given, and write a clear message to forward to the target group (or the requester if no target). The forwarded message should give the recipient enough context to act on the request.
> - For denials: set resolution to "denied" and include my reason. The requester will be automatically notified with the denial and reason.
>
> After processing all decisions, confirm what was done.

---

### Verify

1. The container skill at `container/skills/request-queue/SKILL.md` should exist
2. Run the build: `npm run build`
3. Test that a sub-group agent can see `queue_request` in its available tools
4. Check the scheduled task was created: ask the main group agent to `list_tasks`

## Design Rationale

**Why a queue instead of direct relay?** Direct agent-to-agent messaging could get noisy and bypass human oversight. The queue ensures the lead sees every cross-group request and can approve, deny, or redirect — keeping the human in the loop.

**Why a scheduled digest instead of real-time notifications?** Batching prevents interrupt fatigue. Most cross-group requests aren't urgent. The evening digest pattern lets the lead review everything at once and make informed decisions with full context.

**Why deny notifications?** Sub-agents need to know when and why requests are denied so they can adjust their approach, provide more context, or find alternative solutions. Silent denial would leave agents stuck waiting.

## Removal

To remove the request queue:

1. Revert the merge: `git revert --no-commit <merge-commit>..HEAD && git commit`
2. Or manually remove:
   - Delete `src/request-queue.ts`, `src/request-queue.test.ts`
   - Delete `container/skills/request-queue/`
   - Remove the `request_queue` table from `src/db.ts` createSchema
   - Remove `queue_request` and `resolve_request` cases from `src/ipc.ts`
   - Remove the three MCP tools from `container/agent-runner/src/ipc-mcp-stdio.ts`
   - Remove wiring from `src/index.ts`
   - Remove entries from `CUSTOMIZATIONS.md`
3. Rebuild: `npm run build`
