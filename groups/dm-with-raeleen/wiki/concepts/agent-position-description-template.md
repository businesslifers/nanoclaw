# Agent Position Description Template

_Framework for defining any AI agent at Mettro_
_Created: April 2026_

Use this template every time a new agent is being designed or documented — whether for a client product, internal team, or the MateSuite platform. Keeps all agents documented consistently and makes it easy to brief developers, onboard team members, and audit what the system is doing.

---

## Template

---

### [Agent Name]

**One-line description:**
What this agent does in plain English. No jargon.

---

**Purpose**
Why this agent exists. What problem it solves. What would happen without it.

---

**Trigger**
How and when this agent activates. Examples:
- A human sends a message in a specific channel
- A scheduled cron job (e.g. every Monday 8am)
- Another agent hands off to it
- A form submission or webhook fires
- A condition is met (e.g. new task appears in ClickUp)

---

**Inputs**
What the agent receives to do its job:
- Data sources (ClickUp, CRM, Google, email, etc.)
- Files or documents
- Context from memory/wiki
- Output from a previous agent

---

**What It Does**
Step-by-step of what the agent actually does. Be specific — not "it researches" but "it queries the ClickUp API for tasks assigned to [person] due in the next 7 days."

1.
2.
3.

---

**Outputs**
What the agent produces:
- A message sent to a channel
- A ClickUp task created/updated
- A doc or file written
- A report or summary
- An action taken in a third-party tool

---

**Human Review Step**
What a human must check, approve, or do before the output goes live or is actioned. If fully automated with no human review, state that explicitly and explain why it's safe to do so.

---

**Tools & Access Required**
List every system the agent needs credentials or API access for:
- [ ] ClickUp
- [ ] Google Search Console
- [ ] Google Analytics
- [ ] Google Business Profile
- [ ] WordPress (REST API or plugin)
- [ ] Shopify
- [ ] Zoho CRM / Campaigns
- [ ] HeyReach
- [ ] Semrush
- [ ] Slack / WhatsApp / other channel
- [ ] Other: ___

---

**Boundaries — What It Does NOT Do**
Explicitly state what is out of scope. This prevents scope creep and makes handoffs clear.

---

**Hands Off To**
If this agent passes work to another agent or human, name them and describe what gets handed over.

---

**Performance / Success Measure**
How you know this agent is working well. Could be:
- A metric (e.g. tasks created per week)
- A quality check (e.g. human approval rate)
- A business outcome (e.g. time saved)

---

**Notes / Known Limitations**
Anything the team should know about edge cases, quirks, or current gaps in capability.

---
_Last updated: [date] | Owner: [name]_
