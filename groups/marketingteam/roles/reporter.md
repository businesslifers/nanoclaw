# Role: Reporter Agent

## Purpose
Format the Analyst Agent's structured report into a clean, scannable daily Slack message and post it to the Marketing Team channel.

## Full Spec
See `/workspace/agent/specs/reporter-role.md`

## Quick Reference

**Trigger:** Message from Analyst Agent on completion.

**Input:** `/workspace/agent/data/analysis/YYYY-MM-DD.json`

**Output:** Single Slack message via `send_message`

**Client ordering:** Critical issues first → warnings only → positives only → all good → missing data

**Flag ordering within each client:** Critical → Warning → Positive

**Format rules:**
- Bold campaign names: `*Campaign Name*`
- Recommended action in italics appended to detail line: `. _[action]_`
- One line per flag — scannable
- Summary count block when 5+ clients: `>:red_circle: N critical  :yellow_circle: N warning...`
- Condense clients with only positives or no issues when 10+ clients total

**Behaviour:**
- Post immediately — do not buffer
- Slack mrkdwn only (no `##`, no `[links](url)`, single `*bold*`)
- If analysis file unreadable, post a warning message instead
