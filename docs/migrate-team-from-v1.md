# v1 → v2 team-port history

This file tracks teams ported from the v1 install at `/home/admin/Agents/janet/` into this v2 install. Append a new section per port.

## Past ports

### LaunchMate — 2026-04-29 (port #1)

| Field | Value |
|---|---|
| v1 folder | `/home/admin/Agents/janet/groups/slack_launchmate/` |
| v1 channel | Slack — `slack:C0AQ3KTMBD4`, trigger `@Janet`, `requires_trigger=1` |
| v1 secrets | Filesystem-mounted: `groups/slack_launchmate/credentials/google-ads-config.json` + `google-ads-service-account.json` |
| v1 sub-agents | None in `agents.json` (file absent). `roles/` contained 3 role specs (analyst, collector, reporter) — pipeline stages, not separate agents |
| v1 npm deps | Per-team `package.json`: `@google-analytics/data@^5.2.1`, `google-ads-api@^23.0.0` (declared but unused — actual runtime imports `google-ads-node@23.0.0` + transitives) |
| v1 active schedules | 1 — daily 06:00 cron running collector → analyst → reporter pipeline |
| v2 parent folder | `groups/launchmate` (`agent_groups.id = ag-1777429834314-u4riyu`) |
| v2 channel | telegram — `messaging_groups.platform_id = telegram:-5055500128` (`mg-1777429771946-afqaze`), engage_mode `mention`, unknown_sender_policy `request_approval` |
| v2 mount path | None — credentials live inside the group folder at `/workspace/group/credentials/` (same path as v1) |
| Delegation model chosen | **Lane agents** — three lanes for ad-hoc delegation, but the daily cron pipeline still runs in the parent. User chose lanes for organizational visibility on the dashboard (not because the pipeline needed them). |
| v2 lanes | analyst (`ag-1777429950395-mfpkc5`), collector (`ag-1777429951298-sb2cr5`), reporter (`ag-1777429952193-oeprs7`) — all claude/sonnet, secrets cloned from parent |
| OneCLI | Pre-created agent, `mode=all`, 1 vault secret assigned (Anthropic) |

**Outstanding on the user:**
- Send `@janet please read sources/v1-scheduled-tasks.md and schedule each cron task listed there. Confirm each one back to me.` in the LaunchMate Telegram group to register the daily pipeline cron.
- Smoke-test by mentioning Janet in LaunchMate.
- Run the pipeline once manually (`@janet run the pipeline now`) to validate `google-ads-node` installs cleanly into the container and credentials work.

**Caveats:**
- The `.mjs` scripts hard-code `/workspace/group/node_modules/...` paths. v2's container runner should install `google-ads-node` (per `container.json packages.npm`) into that path on first session. If the imports fail, check container build logs.
- v1 `package.json` and `package-lock.json` are still in the group folder for reference but are no longer authoritative — `container.json packages.npm` is the source of truth in v2.
- Lane agents are isolated from the parent's filesystem. They can't read `data/raw/...` directly — the parent must paste relevant data into the `send_message` body. Their CLAUDE.role.md spells this out.

### ClientMate — 2026-05-01 (port #2)

| Field | Value |
|---|---|
| v1 folder | `/home/admin/Agents/janet/groups/slack_clientmate/` |
| v1 channel | Slack — `slack:C0APY2SDPSB`, trigger `@Janet`, `requires_trigger=0` (fired on every message) |
| v1 secrets | None filesystem-mounted. v1 `additionalMounts` was a cross-team data mount of `groups/slack_briefmate/clients` (read-only) — not credentials. |
| v1 sub-agents | None — no `agents.json` |
| v1 npm deps | None |
| v1 active schedules | 0 |
| v2 parent folder | `groups/clientmate` (`agent_groups.id = ag-1777607105027-isi0rv`) |
| v2 channel | telegram — `messaging_groups.platform_id = telegram:-5293085842` (`mg-1777607057297-8k2t6h`), engage_mode `pattern` `/./`, unknown_sender_policy `request_approval` |
| v2 mount path | None — copied briefmate's `clients/` (5 files: arrow-energy, leap-in, mbi, qld-capital, README) directly into `groups/clientmate/clients/` instead of mounting from briefmate (briefmate not yet ported). |
| Delegation model chosen | **N/A** — solo agent, no sub-agents in v1 |
| v2 lanes | None |
| OneCLI | Pre-created agent (`93208dd7-5ec0-4a1e-b7ca-da6cca7685d8`), `mode=selective`, cloned v1's exact set: 1 secret (Anthropic). ClickUp not assigned despite role-spec referencing `api.clickup.com` auto-injection — assign manually if/when needed. |

**Outstanding on the user:**
- If clientmate ever needs ClickUp, run `onecli agents set-secrets --id 93208dd7-5ec0-4a1e-b7ca-da6cca7685d8 --secret-ids 4032b812-87e2-4d65-b20e-60651d51fe51,1496e2b7-1981-4872-b0c8-91f82599e301` (Anthropic + ClickUp).
- Once `slack_briefmate` is ported in a future run, decide whether to switch clientmate's `clients/` from a local copy back to a mount of the v2 briefmate's directory (so edits in briefmate flow into clientmate). For now the two are decoupled.

**Caveats:**
- Role spec was edited: removed v1-only "Replying to Dispatches from Main" section (no parent in v2), Slack mrkdwn formatting block replaced with Telegram MarkdownV2 hints, "Slack sender" updated to "Telegram sender", `/workspace/global/wiki/` reference removed (v2 has no global wiki concept).
- `memory.md` carries the Janet (Good Place) personality. The role spec calls the agent "ClientMate" — these don't conflict, but the agent introduces itself as "clientmate" rather than as Janet. If the team prefers the assistant introduce itself as Janet, edit the opening of `CLAUDE.role.md`.
- Mettro voice rule "no em dashes" — verify the agent obeys this in real drafts; it used an em dash in its first greeting.

### Janet (adam-dm) — 2026-05-01 (port #3)

| Field | Value |
|---|---|
| v1 folder | `/home/admin/Agents/janet/groups/slack_adam_dm/` |
| v1 channel | Slack DM — `slack:D0APF375W9H`, trigger `@Janet`, `requires_trigger=0` (fired on every message), `is_main=1` |
| v1 secrets | Filesystem-mounted: `~/nanoclaw-secrets/wordpress/wp-sites.json` (host path, outside both v1 and v2 working dirs) |
| v1 sub-agents | None — no `agents.json` |
| v1 npm deps | None |
| v1 active schedules | 2 — weekly wiki-lint (`0 10 * * 0`), daily reflection (`0 6 * * *`) |
| v2 parent folder | `groups/dm-with-adam` (`agent_groups.id = ag-1777257359331-63ti7x`) — pre-existed; this port overlaid v1 content onto a skeleton v2 agent rather than creating a new one |
| v2 channel | telegram DM — `messaging_groups.platform_id = telegram:7466423983` (`mg-1777256921639-x18t1p`, name was `null`), engage_mode `pattern` `/./`, sender_scope `all`, ignored_message_policy `drop`, session_mode `shared` |
| v2 mount path | `~/nanoclaw-secrets/wordpress/` → `/workspace/extra/wordpress-creds/` (read-only) — same containerPath as v1 so role-spec references still resolve |
| Delegation model chosen | **N/A** — solo agent, no sub-agents in v1. (Janet routes to other agents like `briefmate`/`clientmate`/`launchmate` via `send_message to:` once those are ported.) |
| v2 lanes | None |
| OneCLI | Existing agent `ec3ec059-14df-4044-99ce-a8cc2741878a`, `mode=selective`, 1 secret assigned (Anthropic) — matches v1's `slack-adam-dm` agent's set. No new OneCLI work. |

**Outstanding on the user:**
- Send a smoke-test message in the Telegram DM (`telegram:7466423983`) to confirm the new container spawns with the wordpress-creds mount and the new role spec loads (Janet should sound like Janet from The Good Place + warm Mettro persona).
- Then ask Janet via Telegram: `please read sources/v1-scheduled-tasks.md and schedule each cron task listed there in Brisbane time. Confirm each one back to me.` — registers the v1 schedules. Two prompts inside that file: weekly wiki-lint + daily reflection.
- Verify Janet can read `/workspace/extra/wordpress-creds/wp-sites.json` (ask: `list the files under /workspace/extra/`).

**Caveats:**
- This was an **overlay onto an existing v2 agent**, not a fresh init. Skipped phase 6 (`init-group-agent.ts`) entirely. The v2 agent group + Telegram wiring + OneCLI agent all pre-existed from earlier setup. Phase 7 dropped v1 content (CLAUDE.md → CLAUDE.role.md, memory.md, wiki/) on top of skeleton v2 files. The v2 wiki was a 24K skeleton (just `index.md` + `log.md`); v1's 100K (17 files of real Mettro/team/clickup/admin content) replaced it wholesale.
- `CLAUDE.local.md` previously held v2-authored wiki guidance; replaced with `@./CLAUDE.role.md` + `@./memory.md` imports per the v2 convention. The role spec already covers wiki workflow, so no information was lost.
- Role spec was edited heavily: removed ~160 lines of v1 group-management (Managing Groups / Adding a Group / Sender Allowlist / Removing Group / Listing Groups — all host-managed in v2), replaced Slack mrkdwn formatting with Telegram MarkdownV2, replaced `ask_group`/`reply_to_lead` with `send_message to:`, removed `/workspace/global/wiki/` references (v2 has no global wiki), removed `target_group_jid` scheduling pattern (gone in v2), replaced `/workspace/project/store/messages.db` references in scheduled-task prompts (no host project mount in v2).
- `memory.md` rewrote the Slack channel architecture table as historical reference (kept JIDs in a "v1 era" section for archival, marked them as no-longer-live destinations) and added a current "Communication Channels (v2)" section pointing at Telegram + `send_message to:` routing.
- Conversations: copied v1's `conversations/` (4 files, 280K) to `groups/dm-with-adam/sources/v1-conversations/` as reference (not auto-loaded, agent grep'able on demand). Adam picked "copy as reference" over skip.
- The existing v2 wiki had a `[2026-05-01] lint | 0 issues found, 0 fixed` log entry written ~10 minutes before the port (clean empty scaffold); that log was overwritten by v1's richer log. No real wiki content was lost.
- `/workspace/group/` → `/workspace/agent/` sweep completed cleanly across all team files. `grep -rln /workspace/group groups/dm-with-adam | grep -vE '/(data|logs|conversations|v1-conversations)/'` returned `(clean)`.
- Stopped the running container (`nanoclaw-v2-dm-with-adam-1777609777989`) so the next inbound message spawns a fresh container with the new wordpress-creds mount + new role spec. Existing SDK conversation transcripts (244K of jsonl in `.claude-shared/projects/`) preserved — Adam's recent chat memory is intact, only the system prompt changes.

### BriefMate → Project Management Team — 2026-05-08 (port #4)

| Field | Value |
|---|---|
| v1 folder | `/home/admin/Agents/janet/groups/slack_briefmate/` |
| v1 channel | Slack — `slack:C0APY2JNW0P` (`#briefmate`), trigger `@Janet`, `requires_trigger=0` (fired on every message) |
| v1 secrets | None filesystem-mounted. v1 OneCLI agent `slack-briefmate` had Anthropic + ClickUp API (`api.clickup.com` Authorization injection) |
| v1 sub-agents | None — no `agents.json` |
| v1 npm deps | None — `container_config IS NULL` |
| v1 active schedules | 0 |
| v2 parent folder | `groups/project-management-team` (`agent_groups.id = ag-1778203406039-nhnh92`) — pre-existed; this port overlaid v1 content onto a skeleton v2 agent rather than creating a new one |
| v2 channel | Slack — `messaging_groups.platform_id = slack:C0B2E8Z2HQA` (`#project-management-team`, `mg-1778202109644-wu0hza`), engage_mode flipped from `mention-sticky` to `pattern` `/./` to match v1's "every message" behaviour, sender_scope `known`, ignored_message_policy `accumulate`, unknown_sender_policy `request_approval` |
| v2 mount path | None — no extra mounts (v1 had `container_config IS NULL`) |
| Delegation model chosen | **N/A** — solo agent, no sub-agents in v1 |
| v2 lanes | None |
| OneCLI | Existing agent `bc6000dd-0388-4273-87af-1ce91d3de956`, `mode=selective`, 2 secrets assigned (Anthropic + ClickUp API) — cloned from v1's exact set. v2 had only Anthropic before this port. |

**Outstanding on the user:**
- Send a smoke-test message in `#project-management-team` Slack channel to confirm the fresh container spawns with the new role spec + wiki + clients/ access. Janet should sound like Janet from The Good Place (Mettro warm persona) and offer to help with client work / ClickUp tasks.
- Ask Janet to `read clients/arrow-energy.md and summarise it` to verify the clients folder loaded correctly.
- Ask Janet to `read wiki/index.md` to verify the v1 wiki overlaid cleanly (should show `concepts/clickup-api.md` listed).
- Test ClickUp auth by asking Janet to `fetch a ClickUp task` (any task URL) — verify the Authorization header injects without 401.

**Caveats:**
- This was an **overlay onto an existing v2 agent**, not a fresh init. Skipped phase 6 (`init-group-agent.ts`) entirely. The v2 agent group + Slack wiring + OneCLI agent all pre-existed from earlier setup (created 2026-05-08T01:23:26Z, ~11 hours before port). Phase 7 dropped v1 content (CLAUDE.md → CLAUDE.role.md, memory.md, wiki/, clients/, qa/, sources/) on top of skeleton v2 files. The v2 wiki was a Karpathy skeleton (just `index.md` + `log.md`); v1's wiki (entities/concepts/summaries directories with real ClickUp-api content) replaced it wholesale.
- Role spec was rebranded from "BriefMate" → "Project Management Team" throughout. Channel reference updated from `#briefmate` to `#project-management-team`. Slack mrkdwn formatting block kept (still on Slack — same channel platform). Removed v1-only sections: "Replying to Dispatches from Main" (no parent in v2), `ask_group`/`reply_to_lead` references (v2 uses `send_message`), `/workspace/global/wiki/` reference (no global wiki concept in v2), the `conversations/` reference replaced with `sources/v1-conversations/` to match the new path.
- `CLAUDE.local.md` previously empty (skeleton); replaced with `@./CLAUDE.role.md` + `@./memory.md` imports per the v2 convention.
- `memory.md` carried verbatim from v1 — Janet (Good Place) personality, ClickUp rules (markdown_content / status PUT / time_estimate ms), Time Budget mandatory format, People (Luis = designer ID 88905307). No channel-specific content needed reframing — clean copy.
- Conversations: copied v1's `conversations/` (3 files, 240K) to `groups/project-management-team/sources/v1-conversations/` as reference (not auto-loaded, agent grep'able on demand). User picked "Same + conversations as sources/v1-conversations/".
- `/workspace/group/` → `/workspace/agent/` sweep completed cleanly across all team files. `grep -rln /workspace/group groups/project-management-team | grep -vE '/(data|logs|conversations|v1-conversations)/'` returned `(clean)` after the sed sweep (caught one ref in `wiki/index.md`).
- Stopped the running container (`nanoclaw-v2-project-management-team-1778207741566`, Up 8 minutes) so the next inbound message spawns a fresh container with the new role spec + wiki + clients/. The existing session (`sess-1778207546383-yo0u0n`) had 2 inbound messages and 0 outbound — the agent had loaded the empty role spec and never managed to reply. Per phase 7e.bis Step 2, cleared the SDK session transcripts (`projects/-workspace-agent/*.jsonl`) AND the SDK PID pointer (`sessions/24.json`) to prevent stale-session resume errors. The 2 pending inbound messages remain in `messages_in` for the new container to pick up.
- v1 trigger pattern was `@Janet` with `requires_trigger=0` — meaning the field was a fallback hint, not a gate (every message processed). v2 wiring flipped from `mention-sticky` (skeleton default) to `pattern` `/./` to match v1 behaviour exactly. Channel is dedicated to the team so noise isn't a concern.
- ClickUp secret: v1 had Anthropic + ClickUp API; v2 only had Anthropic before port. Added ClickUp via `onecli agents set-secrets --secret-ids 4032b812...,1496e2b7...`. Without this, ClickUp API calls would have returned 401 — the team's main job depends on ClickUp.
- **Missing `agent_destinations` row blocked first smoke test.** First two test messages (`read clients/arrow-energy.md` / `read wiki/index.md`) reached the agent and produced correct answers, but the agent-runner logged `WARNING: agent output had no <message to="..."> blocks — nothing was sent` and dropped the reply into scratchpad. Cause: the v2 agent group existed before the port (skeleton from earlier `init-group-agent.ts` run) but its central `agent_destinations` row was never created, so `writeDestinations` projected an empty `destinations` table into `inbound.db`, the system prompt told the agent "you have no configured destinations," and `dispatchResultText`'s strict `<message to="...">` parser found nothing to route. Fix: inserted `agent_destinations(agent_group_id='ag-1778203406039-nhnh92', local_name='project-management-team', target_type='channel', target_id='mg-1778202109644-wu0hza')` via `createDestination`, called `writeDestinations` for the 3 active sessions, stopped both running containers so the next inbound rebuilds the system prompt. Smoke tests passed on retry. **Re-port detection (phase 2e) should grep `agent_destinations` for the candidate `agent_groups.id` — empty → fix before phase 10.**

---

### Raels' Janet (`dm-with-raeleen`) — 2026-05-08 (port #5)

| Field | Value |
|---|---|
| v1 folder | `/home/admin/Agents/janet/groups/slack_raels_dm/` |
| v1 channel | Slack — `slack:D0APJ2CLK4M` (Raels' Slack DM), trigger `@Janet`, `requires_trigger=0` (fired on every message) |
| v1 secrets | One filesystem-mounted credential dir: `~/nanoclaw-secrets/wordpress` → `wordpress-creds`. v1 OneCLI agent had Anthropic + ClickUp API. |
| v1 sub-agents | None — no `agents.json` |
| v1 npm deps | None |
| v1 active schedules | 0 |
| v2 parent folder | `groups/dm-with-raeleen` (`agent_groups.id = ag-1778215787818-bncghq`, name "Janet") — pre-existed, scaffolded from `dm-with-adam` per the per-person Janet pattern (commit `12a2106`) |
| v2 channel | Slack — `messaging_groups.platform_id = slack:D0B1JV7GJH3` (Raels' *current* Slack DM in this v2 install, `mg-1778215735145-qty9u2`), engage_mode `mention-sticky` (left as-is, intentional for DM), session_mode `shared` |
| v2 mount path | `/workspace/extra/wordpress-creds` (re-mounted same `containerPath` from v1 — Raels uses WP creds in this DM) |
| Delegation model chosen | **N/A** — solo agent, no sub-agents in v1 |
| v2 lanes | None |
| OneCLI | Existing agent `ca4aa329-535f-46db-a505-0ecb287523c6` already had identical secret set (Anthropic + ClickUp) to v1 twin `aea2cbac-...`. No changes. |

**Outstanding on the user:**
- Send a smoke-test `@Janet hi` in Raels' Slack DM to confirm the fresh container spawns with the new wiki + role spec + WP mount.
- Ask Janet to `read wiki/index.md` to verify the v1 wiki overlaid cleanly (should show 4 entities, 3 concepts, 2 topics).
- Ask Janet to `ls /workspace/extra/wordpress-creds/` to verify the WP mount.
- Ask Janet about a Mettro client (e.g. La Petite Boudoir, Queensland Capital) to verify she pulls from the wiki entity pages.

**Caveats:**
- **Overlay onto existing scaffolded agent**, not a fresh init. The v2 agent was deliberately created from `dm-with-adam` as the seed for the per-person Janet pattern (validated 2026-05-08 per memory entry `feedback_per_person_janet_pattern`). The existing v2 `CLAUDE.role.md` (12.6KB) was already v2-correct (`/workspace/agent/` paths, `send_message` model, Slack mrkdwn, inter-agent relay rule for Adam ↔ Raels) — clobbering with v1's 17KB CLAUDE.md would have *regressed* the agent (v1 had `/workspace/group/`, `register_group`, `ask_group`, `target_group_jid`, `available_groups.json`). Strategy: PRESERVE existing v2 role spec + memory; MERGE v1's missing standing rules into the existing `Standing Rules` section.
- **Standing rules merged from v1** (4 new entries appended): "Never assign tasks to Adam"; "ClickUp content format depends on the endpoint" (markdown_content for tasks, content for doc pages, comment array for comments); "ClickUp doc pages — no top-level heading"; "ClickUp wiki mirror to Mettro Knowledge Base" (Doc ID `8ca58cc-94596`).
- **Wiki overlay**: v2 had only Karpathy skeleton stubs. v1 wiki (13 pages — 4 entities, 3 concepts, 2 summaries) replaced it wholesale. Renamed `summaries/` → `topics/` to match v2 role spec's expected directory naming; updated `wiki/index.md` references accordingly.
- **`/workspace/group/` → `/workspace/agent/` sweep** caught two refs in `wiki/topics/{content-team-spec.md, crm-spec.md}` after the rename. Final grep returned `(clean)`.
- **Sources/ overlay**: copied v1 `sources/` (case studies + `mettro-content-guidelines/`), all top-level `*.docx` (PPC kits, email kits, sales pages, story pages, packages — 12 files), `case-study-*.txt`, `mettro-sitemap.md`, `postmate-brief.md`, `drive_files/` (17 marketing files), `drive_screenshot.png` into `groups/dm-with-raeleen/sources/`.
- **`people.md`** copied to team root (referenced unprefixed in v1 standing rules; Mettro people facts incl. "Adam doesn't action ClickUp tasks").
- **Conversations**: copied v1 `conversations/` (14 files, 5.3MB, last May 7) to `groups/dm-with-raeleen/sources/v1-conversations/` as reference per operator pick. Not auto-loaded; grep'able on demand. Caveat: transcripts are Slack mrkdwn — same channel as v2, so no formatting drift risk.
- **Memory.md preserved** — existing v2 `memory.md` (4.1KB, full Mettro context: team roster, admin roles, current channels, historical channel reference table, secrets vault) was already richer than v1's `memory.md` (508 bytes — just Janet personality blurb, already covered in v2 memory.md `## Identity` section). No merge needed.
- **CLAUDE.local.md untouched** — already had the correct bare-imports skeleton (`@./CLAUDE.role.md` + `@./memory.md`), which is what the merge strategy preserved.
- **`agent_destinations` already correct** (per phase 2e re-port checklist): `adam` → `ag-1777257359331-63ti7x` for the inter-Janet relay + `slack-mg-17782` self-channel destination. Both rows present, no insert needed (briefmate port #4 hit this; this one was clean because the per-person Janet pattern wired destinations explicitly via `init-group-agent.ts` 2026-05-08T04:49:47Z).
- **Wiring audit (phase 6a)**: exactly one `messaging_group_agents` row on `mg-1778215735145-qty9u2` for our agent. Clean.
- **Container restart**: stopped running `nanoclaw-v2-dm-with-raeleen-1778216713978` (Up 34 minutes). Did NOT clear SDK session transcripts — the agent hadn't done meaningful pre-port work that needed wiping; a plain restart suffices. Next inbound respawns with new role spec + WP mount.
- **Phase 9 no-op**: 0 active scheduled tasks in v1.
- **Phase 10f no-op**: DM agent has no team scripts.
