---
name: reply-to-sender
description: Reply to the lead agent when they ask your group a question. Use reply_to_lead to send your answer back directly into the lead's active session.
---

# Reply to Sender

When the lead agent dispatches a question to your group, use `mcp__nanoclaw__reply_to_lead` to send your answer back directly. Your reply is piped into the lead's active session so they can use it immediately.

## When to use

- The lead asked your group a question or gave you an instruction
- You have the answer or result ready
- You want to send a progress update before the final answer

## How to reply

Call `mcp__nanoclaw__reply_to_lead` with:

- `message` (required): Your reply text. Include all relevant information — the lead may be in the middle of other work and needs a self-contained answer.

You can call this multiple times (e.g. a progress update then a final answer).

## When this tool is NOT available

If `reply_to_lead` returns an error saying "No active dispatch to reply to", it means your container was not started by a dispatch from the lead. In this case:

- Your group was triggered by a direct message, scheduled task, or other mechanism
- There is no lead session to reply to
- Just respond normally in your group's chat using `send_message`

## Do NOT

- Use `send_message` to try to reach the lead — it only sends to your own group's chat
- Queue multiple identical replies — the lead sees each one
- Send trivially short replies ("OK", "Done") without the actual information the lead asked for
