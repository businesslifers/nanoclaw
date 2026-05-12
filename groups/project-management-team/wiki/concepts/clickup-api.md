# ClickUp API — Formatting & Usage

## Required Task Format — Every Task, Every Time

Every ClickUp task must have all four of these:

### 1. Task Name
Start with an action verb: **Plan**, **Build**, **Review**, **Write**, etc.
> ✅ "Plan Carpet One Member Surveys"
> ❌ "Work with Liam to create surveys for Carpet One members"

### 2. Formatted Description (`markdown_content`)
Use proper markdown with `##` section headers. The **Time Budget block must come first** — no exceptions. Do NOT include a Due Date section (due date is set as a field, not in the description).

```markdown
## ⏱ Time Budget

| Person | Time |
|---|---|
| [Name] | X hr |
| [Name] | X hr |
| **Total** | **X hrs** |

If you reach your time and aren't done — stop and message the project manager.

---

## Overview
[One paragraph describing the purpose and scope of the task.]

## Objectives
- [What needs to be done — bullet list]
- [Each discrete deliverable or action]
```

### 3. Time Estimate
Always set `time_estimate` in milliseconds (see table below). Use the Total value from the Time Budget block.

### 4. Status — Always Set to "to do" (unless told otherwise)
Default status for all new tasks is **to do**. Always force-set via PUT after creation (ClickUp ignores status on POST).

---

## Task Description Formatting

**Always use `markdown_content`** (not `description`) to write formatted task content.

- `description` — plain text only, no rendering
- `markdown_content` — renders as rich text in ClickUp UI (headings, bold, bullets, dividers)

### Supported Markdown

```
## Heading
**bold**
_italic_
- bullet
---  (horizontal rule / divider)
```

### Status — Always Set to "to do", Always Force-Set via PUT

**Default status for all tasks is "to do"** unless the requester specifies otherwise.

**After creating any task:** always send a separate PUT to force-set the status. ClickUp ignores the `status` field on POST and defaults to the list's first status ("planning" in most Mettro lists). The PUT is required every time.

```python
# Step 1 — create task
payload = json.dumps({
    "name": "Task title",
    "markdown_content": "## Section\n\nContent here..."
}).encode('utf-8')

req = urllib.request.Request(
    "https://api.clickup.com/api/v2/list/LIST_ID/task",
    data=payload,
    headers={"Content-Type": "application/json"},
    method="POST"
)
with urllib.request.urlopen(req) as resp:
    result = json.loads(resp.read())
    task_id = result['id']

# Step 2 — force-set status (always do this)
payload2 = json.dumps({"status": "to do"}).encode('utf-8')
req2 = urllib.request.Request(
    f"https://api.clickup.com/api/v2/task/{task_id}",
    data=payload2,
    headers={"Content-Type": "application/json"},
    method="PUT"
)
with urllib.request.urlopen(req2) as resp2:
    pass
```

### Updating a Task (PUT)

```python
payload = json.dumps({
    "markdown_content": "## Updated content..."
}).encode('utf-8')

req = urllib.request.Request(
    "https://api.clickup.com/api/v2/task/TASK_ID",
    data=payload,
    headers={"Content-Type": "application/json"},
    method="PUT"
)
```

> Note: `markdown_content` confirmed working on POST (task creation). PUT behaviour may differ — test if in doubt.

## Time Estimate Field

Always set `time_estimate` (milliseconds) on every task. Use the *total* time across all phases/roles (the "Total" value from the Time Budget block, not the executor's portion).

| Time | Milliseconds |
|---|---|
| 30 min | 1800000 |
| 1 hr | 3600000 |
| 1.5 hrs | 5400000 |
| 2 hrs | 7200000 |
| 3 hrs | 10800000 |
| 4 hrs | 14400000 |
| 5 hrs | 18000000 |
| 7 hrs | 25200000 |

Include in the POST payload:

```python
payload = json.dumps({
    "name": "Task title",
    "markdown_content": "...",
    "time_estimate": 3600000
}).encode('utf-8')
```

## Auth

Authorization header is injected automatically for all `api.clickup.com` requests. No key needed in code.

## Workspace

- **Workspace ID:** 9003245964
- **API base:** `https://api.clickup.com/api/v2`

## Complex Payloads

Use Python `urllib.request` (not curl) for multi-line descriptions to avoid shell escaping issues.

## Key List IDs

| List | ID |
|---|---|
| Business Lifers > businesslifers.com | 901602099087 |
| Arrow Energy Support | 901610574349 |
| Launchpoint Golf > launchpointgolf.com | 901602099164 |
| Mettro Repo > Mettro AI | 901614510925 |
