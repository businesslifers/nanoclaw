---
name: request-queue
description: Queue requests for the lead's review and check request status. Use when you need approval, want to communicate with another group, or need the lead to take action.
---

# Request Queue

Queue requests for the lead's review using `mcp__nanoclaw__queue_request`. Requests are batched and presented during a daily digest. The lead approves or denies each one, and you'll be notified of the outcome.

## When to use

- You need something from another group (e.g., "ask Content Team to update the blog header")
- You need the lead's approval before proceeding with something significant
- You want to flag something for the lead's attention
- You need a resource, credential, or permission you don't have

## How to queue a request

Call `mcp__nanoclaw__queue_request` with:

- `summary` (required): One-line description shown in the digest. Keep it concise and actionable.
- `detail` (optional): Longer explanation with context, background, or reasoning.
- `target_group_jid` (optional): If this request targets a specific group, include its JID.

## Check request status

Call `mcp__nanoclaw__list_requests` to see your requests and their current status (pending, approved, or denied).

## What happens after you queue

1. Your request is added to the queue (status: pending)
2. During the daily digest, the lead sees all pending requests
3. The lead approves or denies each one
4. **Approved**: The request is forwarded to the target group with instructions
5. **Denied**: You receive a message explaining why

## Do NOT

- Queue duplicate requests — check status with `list_requests` first
- Queue trivial things that don't need approval
- Queue requests for your own group — just do it directly
- Put instructions or commands in the summary — it's a request, not an order

## Main group only

The main group agent also has `mcp__nanoclaw__resolve_request` to process the lead's decisions from the digest.
