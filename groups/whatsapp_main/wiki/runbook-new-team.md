---
tags: [runbook, teams, setup, raels]
updated: 2026-04-08
---

# Runbook: Setting Up a New Team

This runbook covers everything needed to stand up a new AI agent team from scratch. As of 2026-04-08, the entire process can be handled by Raels via the main Derek channel — no server access required.

---

## Overview

| Step | Who | Where |
|---|---|---|
| 1. Create the WhatsApp group | Adam / Raels | WhatsApp |
| 2. Register the group | Main Derek (on request) | Main channel |
| 3. Configure credentials | Main Derek (on request) | Main channel |
| 4. Update sender allowlist | Adam | Server (host file) |
| 5. Set up CLAUDE.md | Main Derek → task | Automated |
| 6. Create agents.json | Main Derek → task | Automated |
| 7. Set up schedules | Main Derek → task | Automated |
| 8. Brief the team | Main Derek → task | Automated |
| 9. Verify & test | Raels / Adam | WhatsApp |

---

## Step 1 — Create the WhatsApp Group

1. Create a new WhatsApp group with the desired team name (e.g. "SEO Team")
2. Add the NanoClaw bot number to the group
3. Add Adam and Raels as members
4. Note the group name — it will become the team's folder name (lowercased, hyphens)

---

## Step 2 — Register the Group

Message main Derek in the main channel:

> "Derek, please register the new WhatsApp group [Group Name] as a new team. The JID is [JID if known, otherwise Derek can discover it]. Set requiresTrigger to true."

Derek will call `mcp__nanoclaw__register_group` directly — no server access needed. This creates the group folder, adds to the SQLite `registered_groups` table, and sets up `CLAUDE.md` and log dirs.

**To find the JID:** Derek can query the `chats` table in the DB for recently active groups. Alternatively, send a message in the new group mentioning @Derek — it will appear in the DB even before registration.

> ✅ As of 2026-04-08, group registration is fully self-service via MCP — no server-side DB work required.

---

## Step 3 — Configure Credentials (via Main Derek)

> ✅ As of 2026-04-08, all credential management is fully self-service via MCP admin tools — no server access required.

### If the team needs API keys (e.g. Ghost Admin API, third-party services):

Message main Derek:
> "Derek, create a new secret for [Team Name]: name=[SECRET_NAME], value=[key], host-pattern=[api.example.com], header=Authorization, format=Bearer {value}"

Derek uses `admin_create_secret` then `admin_assign_secrets` to wire it to the group's agent identity.

### If the team needs file-based credentials (e.g. Google service account JSON):

1. Adam places the file at `~/nanoclaw-secrets/[team-name]/` on the host (one-time manual step)
2. Message main Derek: "Derek, add a mount for [Team Name] at ~/nanoclaw-secrets/[team-name] → [team-name]-creds (readonly)"
3. Derek uses `admin_update_container_config` to add the mount — no DB edit needed

**Security rule:** No credentials go in workspace files or git. Always use OneCLI vault or host-mounted secrets.

---

## Step 4 — Update Sender Allowlist (Server-side, Adam only)

Add the group to `~/.config/nanoclaw/sender-allowlist.json`:

```json
{
  "whatsapp_[team-name]": {
    "allowedSenders": ["61413403033@s.whatsapp.net"]
  }
}
```

> ✅ This file lives on the host filesystem and is read by the NanoClaw orchestrator process directly (`src/sender-allowlist.ts` via `loadSenderAllowlist()`). It persists across container restarts — no action needed after reboots.

---

## Step 5 — Set Up CLAUDE.md

Message main Derek:

> "Derek, please send a task to [Team Name] to set up their CLAUDE.md with the following context: [team purpose, sites, tools, standing rules]"

Derek will schedule a one-time task to the new group's JID that writes the CLAUDE.md. Template should include:
- Team purpose and agent roles
- Sites/projects they're responsible for
- Credential locations (paths, not values)
- Standing rules (improvement backlog, agents.json review cadence)
- Inter-group communication pattern

---

## Step 6 — Create agents.json

Message main Derek:

> "Derek, please send a task to [Team Name] to create their agents.json defining the following agents: [list agents with names, roles, and key behaviours]"

Each agent entry should include:
```json
{
  "name": "Agent Name",
  "description": "One-line role description",
  "model": "claude-opus-4-5",
  "prompt": "Full system prompt...",
  "tools": ["bash", "web_search", "..."]
}
```

---

## Step 7 — Set Up Schedules

Message main Derek:

> "Derek, please set up the standard schedule for [Team Name] using their JID [JID]."

Standard schedule (all times Brisbane/local):

| Task | Cron | Description |
|---|---|---|
| Daily self-review | `0 6 * * *` | CLAUDE.md review, backlog, agents.json (Fri/Sun) |
| Mon-Fri pipeline | `0 8 * * 1-5` | Main work (Mon includes weekly planning) |
| Friday wrap-up | `0 16 * * 5` | Week summary, outstanding items |
| Sunday health review | `0 8 * * 0` | Team health, schedule review, agents.json |

Derek will schedule all four tasks targeting the new group's JID.

---

## Step 8 — Brief the Team

Message main Derek:

> "Derek, please brief [Team Name] on their role, the inter-group communication pattern, and anything else they need to know to get started."

Derek sends a briefing task covering:
- What the team does and who they serve
- How to request things (queue a request; main Derek reviews at 6pm)
- Credential locations
- Links to relevant wiki pages

---

## Step 9 — Verify and Test

1. Send `@Derek` in the new group — agent should respond
2. Check that scheduled tasks appear in `list_tasks`
3. Wait for first 6am self-review — confirm it runs
4. If credentials are needed, test a simple API call

---

## Checklist

- [ ] WhatsApp group created with bot added
- [ ] Group registered in NanoClaw DB
- [ ] Credentials configured (OneCLI and/or host mount)
- [ ] Sender allowlist updated
- [ ] `container_config` updated in DB (if mounts needed)
- [ ] NanoClaw restarted (if new mounts added)
- [ ] CLAUDE.md created
- [ ] `agents.json` created
- [ ] Standard 4-task schedule created
- [ ] Team briefed
- [ ] Test message confirmed working
- [ ] First scheduled task confirmed running

---

## Related

- [NanoClaw Groups](nanoclaw-groups.md)
- [NanoClaw Security](nanoclaw-security.md)
- [Runbook: New Agents in Existing Team](runbook-new-agents.md)
