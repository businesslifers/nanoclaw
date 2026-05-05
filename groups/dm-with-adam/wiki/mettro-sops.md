# Mettro SOP Standards

Last updated: 2026-04-27

Standards for how SOPs are written, structured, and maintained at Mettro. Raels has strong opinions on SOP format — follow these exactly when creating or updating SOPs.

## SOP Structure Principles

### Split docs — never combine separate processes

When a process has distinct phases (e.g. staging setup vs production go-live), **create separate SOP documents** and cross-reference each other. Do not combine into a single long document. Raels confirmed Apr 25: "split the two and refer to the production one from the staging one and vice versa."

### Opening caveat — PM check

Every SOP must open with a prominent caveat (before the checklist):

> **⚠️ If you are unsure about any step, check with your project manager before proceeding.**

Make this visually prominent — bold or in a callout block. This is the most important line in the document.

### Checklist as record

Include a note at the top of the checklist that the team member should **document what they have done** using the checklist itself — checking off or noting as they go. This creates a record and forces engagement.

Example phrasing:
> *As you complete each step, tick it off. This checklist becomes your record of what was done.*

### Handle both new-setup and migration cases

SOPs must account for two scenarios:
- **New setup** — starting from scratch; steps like "match version to production" are not applicable
- **Migration / update** — working from an existing system

Add a note at the top indicating which scenario the SOP covers, or use conditional sections. Do not assume all readers are doing a migration.

## SOP Format Template

```markdown
# [Process Name] SOP

Last updated: [date]

> ⚠️ If you are unsure about any step, check with your project manager before proceeding.

## Overview

One or two sentences: what this SOP covers, when to use it, and what scenario it applies to (new setup vs migration).

*As you complete each step, tick it off. This checklist is your record of what was done.*

## Pre-requisites

- [ ] List anything that must be in place before starting

## Checklist

- [ ] Step 1
- [ ] Step 2
- [ ] Step 3

## See also

- Link to related SOP (e.g. staging → production)
- Link to relevant ClickUp task
```

## Where SOPs Live

- **ClickUp** — primary SOP location; stored in the Mettro SOP area (not inside specific project tasks)
- **Briefmate** — Janet in #briefmate creates and maintains SOPs; Raels reviews in that channel
- **Cross-reference ClickUp tasks** — always link the relevant task in the SOP and vice versa

## See also

- [clickup-integration.md](clickup-integration.md) — task formatting rules (Time Budget block, markdown_content)
- [team.md](team.md) — who creates/reviews SOPs
