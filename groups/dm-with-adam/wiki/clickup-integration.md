# ClickUp Integration

Last updated: 2026-04-29

## Task Creation — Formatting Rule

**Always use `markdown_content` (not plain `content`) for ClickUp task descriptions and comments.**

ClickUp renders markdown in the task description field. Using the plain `content` field produces unformatted text that looks broken. Raels flagged this on Apr 20 — the fix was to switch to `markdown_content`.

### Correct pattern

```json
{
  "name": "Task Title — Active verb",
  "markdown_content": "## Overview\n\nBrief summary here.\n\n## What needs to happen\n\n- Step one\n- Step two\n\n## Notes\n\nAny extra context."
}
```

### Rules

- Use `##` headings for sections
- Use `-` bullet points for lists
- Use `**bold**` for emphasis
- Task titles should use active verbs (e.g. "Revise ebook for 2026" not "Ebook revision")
- No em dashes anywhere
- Use `markdown_content` in both task descriptions AND task comments
- **Always include the task link** in Slack when creating or modifying a task — Raels and Adam need it to navigate quickly

### Common mistakes

| Wrong | Right |
|-------|-------|
| `"content": "Overview\n\nStep one..."` | `"markdown_content": "## Overview\n\nStep one..."` |
| Plain paragraph walls of text | Structured with headings + bullets |
| Em dashes in task text | Commas or colons instead |
| Mentioning a task without including the URL | Always append the ClickUp link |
| Setting dates in UTC | Always use AEST/Brisbane time (UTC+10) |
| Not setting task status | Always set `status` — ask if not provided, default to "to do" |
| Not setting time estimate field | Always set `time_estimate` (milliseconds) to match Time Budget total |

## Task Status (mandatory — Apr 27)

**Always set the `status` field** when creating or updating a task. Raels flagged this multiple times on Apr 27 — tasks were being created without a status set.

- If the requester specifies a status: use it exactly
- If not specified: ask, or default to `"to do"`
- Common statuses: `to do`, `in progress`, `review`, `done`, `planning`

The ClickUp API uses lowercase status strings. Check the list's available statuses if unsure.

### "Planning" default bug (Apr 28)

ClickUp sometimes defaults tasks to "Planning" status even when a different status is set via the API. Raels confirmed this is a ClickUp quirk: "For some reason these tasks are still being set to Planning... You may need to do it and then do it again because, click up, stupid."

**Workaround:** After creating a task, verify the status via a GET request. If it shows "Planning" despite setting a different status, make a second PATCH request to explicitly update the status field again. In chat, confirm explicitly: "status confirmed as [X]" — Raels has flagged this issue three times across Apr 27–29 and still sees it happening.

## Time Estimate Field (mandatory — Apr 27)

**Always set the native `time_estimate` field** in addition to the Time Budget block in the description. Raels flagged Apr 27 that tasks were missing the correct hours.

- Value is in **milliseconds**: 1 hour = 3,600,000 ms
- Set to match the **Total hours** in the Time Budget block
- Example: Total 2 hrs → `"time_estimate": 7200000`

Both the description Time Budget block AND the native field must be present and consistent.

## Workspace Details

- **Workspace ID:** 9003245964
- **Lists used:** Mettro Admin, Mettro Sales, and client-specific lists
- **ClickUp wiki notebook:** https://app.clickup.com/9003245964/v/dc/8ca58cc-94596 (Raels' wiki mirror — per-group)

## Time Budget Block (mandatory — Apr 25)

Every ClickUp task description must open with a Time Budget block. This was instated by Raels on Apr 25 to address a persistent problem: remote team members (especially ESL) over-invest time on low-value tasks without realising there's a ceiling.

**Process:**
1. Before creating the task, suggest a time estimate based on task type
2. Ask the requester (whoever is asking — could be Raels or Tracey) to confirm or adjust
3. Insert the confirmed block at the very top of the description, before the Overview

**Format (copy exactly):**

```
⏱ Time Budget
Total: X hrs (includes briefing, doing, QA and review)
Your time to complete: X hrs
If you reach your time and aren't done — stop and message the project manager.
```

**Exception:** SOPs do not need a time estimate. Create and show immediately without asking.

**Why it works:** The executor's time (second line) is the only number the team member needs to care about. The total clarifies that QA and review time are already factored in, so they don't treat the total budget as entirely their own.

## Tasks for Remote Team Members

Remote team members (Luis, Archie, Luisa, Daina) don't always read full task descriptions carefully. Always include a concise **Overview** section at the top of any task description so the key "what and why" is immediately visible.

For Luis specifically: he is ESL — write in simple, succinct English. No Australian slang, idioms, or jargon. Be literal and specific.

## Sharing Large Text via ClickUp

When a user needs to share more text than Slack's character limit allows, the pattern is:
1. User creates a ClickUp task and pastes the content in the **comments** field (not description — description has its own limit)
2. User shares the task URL in Slack
3. Janet reads the task comments via the ClickUp API to get the full content

## See also

- [team.md](team.md) — ClickUp workspace ID, team roles
- [channel-architecture.md](channel-architecture.md) — which channels use ClickUp for task handoff
