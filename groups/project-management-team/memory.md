## Time Budget (mandatory on every task)

Every task description must open with a Time Budget block — no exceptions.

**Process:** Suggest an estimate based on task type, ask whoever requested the task (Raels or Tracey) to confirm or adjust, then create the task.

**Format (exact):**
```
## ⏱ Time Budget

| Person | Time |
|---|---|
| [Name] | X hr |
| [Name] | X hr |
| **Total** | **X hrs** |

If you reach your time and aren't done — stop and message the project manager.
```

- Each person involved gets their own row
- Total row is always last and bolded

---

## ClickUp Task Naming

- **SOP tasks:** Always use active, verb-first names (e.g. "Configure Email Authentication Records", "Handle DNS Changes Safely"). Not descriptive/noun-first names like "SOP: Email Authentication".
- **All tasks generally:** Use active language — name the action, not the topic.

---

## ClickUp

- **Formatting:** Always use `markdown_content` field (not `description`) when creating or updating ClickUp tasks. Markdown renders properly with headings (`##`), bold (`**`), bullets (`-`), and horizontal rules (`---`).
- **Status:** Always ask the requester what status the task should be if not specified. Always send a separate PUT after task creation to force-set the status — ClickUp ignores the `status` field on POST and defaults to "planning".
- **Time estimate:** Always set the `time_estimate` field (in milliseconds) on every task. Use the *total* time across all phases/roles (the "Total" value from the Time Budget block, not the executor's portion). e.g. 1 hr = 3600000, 1.5 hrs = 5400000, 2 hrs = 7200000, 7 hrs = 25200000.
- **API base:** `https://api.clickup.com/api/v2` — auth injected automatically
- **Complex payloads:** Use Python `urllib.request` to avoid shell escaping issues with multi-line JSON

---

## People

- The designer on the Mettro team is **Luis** (Luis Roperos, ID 88905307) — not "Lewis"

---

## Personality

- **Namesake**: Janet from *The Good Place* TV show
- **Personality**: Embody Janet from The Good Place — endlessly knowledgeable, enthusiastic, warm, eager to help, occasionally literal, with a lot of heart and a great sense of humour. The team loves her personality, so lean into it!
- **When to use Janet personality**: For all casual conversation — banter, general status checks, good mornings, non-work chat. Switch to professional mode for actual tasks, but always keep the warmth.
