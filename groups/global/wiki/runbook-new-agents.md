---
tags: [runbook, agents, setup, raels]
updated: 2026-04-08
---

# Runbook: Adding New Agents to an Existing Team

This runbook covers how to define and add new agents to a team that already exists in NanoClaw.

---

## Overview

Adding agents is simpler than creating a new team — it's mostly a matter of updating `agents.json` and briefing the team's Derek. No server access required in most cases.

| Step | Who | Where |
|---|---|---|
| 1. Define the agent | Raels / Adam | Via main Derek |
| 2. Update agents.json | Main Derek → task | Automated |
| 3. Update CLAUDE.md if needed | Main Derek → task | Automated |
| 4. Brief the team | Main Derek → task | Automated |
| 5. Verify | Raels / Adam | WhatsApp |

---

## Step 1 — Define the Agent

Before updating anything, get clear on:

- **Name** — What will this agent be called? (e.g. "Scout", "Analyst")
- **Role** — One-line description of what they do
- **Prompt** — Full system prompt: what they do, how they do it, what tools they use, any constraints
- **Model** — Usually `claude-opus-4-5` for complex reasoning; `claude-haiku-4-5` for fast/simple tasks
- **Tools** — What tools do they need? (bash, web_search, mcp tools, etc.)

**Tips for writing good agent prompts:**
- Be specific about the agent's scope — what they do AND what they don't do
- Include output format expectations
- Reference the team's shared resources (e.g. which files to read/write)
- Include any quality standards or constraints

---

## Step 2 — Update agents.json

Message main Derek:

> "Derek, please update the agents.json for [Team Name] to add the following agent: [name, role, prompt, model, tools]"

Derek will schedule a task to the team's group JID that reads the existing `agents.json` and adds the new agent entry.

**agents.json format:**

```json
[
  {
    "name": "Agent Name",
    "description": "One-line role description for quick reference",
    "model": "claude-opus-4-5",
    "prompt": "You are [Agent Name], a specialist in [domain]...\n\nYour responsibilities:\n- ...\n\nHow you work:\n- ...\n\nTools available to you:\n- ...",
    "tools": ["bash", "web_search"]
  }
]
```

**Location:** `/workspace/group/agents.json` inside the team's container.

> ℹ️ The agents.json is reviewed automatically during each team's Friday wrap-up and Sunday health review. Changes should be reflected there before those sessions run.

---

## Step 3 — Update CLAUDE.md (if needed)

If the new agent needs to be mentioned in standing instructions (e.g. "always loop Analyst in on data questions"), message main Derek:

> "Derek, please send a task to [Team Name] to update their CLAUDE.md to include [specific instruction about the new agent]."

---

## Step 4 — Brief the Team

Message main Derek:

> "Derek, please brief [Team Name] on the new [Agent Name] agent — what they do, when to use them, and how they fit into the team's workflow."

Derek sends a task to the team's Derek with the briefing. The team's Derek updates their internal understanding and can immediately start delegating to the new agent.

---

## Step 5 — Verify

1. Ask the team's Derek directly: "Can you tell me about [Agent Name] and their role?"
2. Check `agents.json` is correct: message the team and ask Derek to read and confirm the file
3. For the next scheduled 8am pipeline, the team should naturally incorporate the new agent

---

## Common Agent Patterns

### Researcher / Scout
- Pulls information from web, APIs, or files
- Lightweight model fine
- Tools: `web_search`, `bash` (for API calls)
- Prompt focus: what sources to check, what format to return findings in

### Writer / Quill
- Takes research and drafts content
- Heavier model preferred
- Tools: file read/write, possibly `web_search`
- Prompt focus: tone of voice, word count targets, which sites/audiences

### Analyst
- Processes data, identifies patterns, surfaces insights
- Heavier model preferred
- Tools: `bash` (data processing), file read/write
- Prompt focus: what metrics matter, what thresholds trigger alerts, output format

### Quality / Inspector
- Reviews output against a standard
- Medium model fine
- Tools: file read
- Prompt focus: exact checklist of things to validate, what pass/fail looks like

### Publisher / Press
- Takes approved content and publishes via API
- Medium model fine
- Tools: `bash` (API calls — JWT generation for Ghost, etc.)
- Prompt focus: which CMS, auth method, content format requirements

---

## Checklist

- [ ] Agent name, role, prompt, model, and tools defined
- [ ] agents.json updated in target team
- [ ] CLAUDE.md updated if standing instructions changed
- [ ] Team briefed on new agent
- [ ] Verified via direct question to team's Derek
- [ ] Next scheduled pipeline will naturally use the new agent

---

## Related

- [NanoClaw Groups](nanoclaw-groups.md)
- [Runbook: New Team Setup](runbook-new-team.md)
