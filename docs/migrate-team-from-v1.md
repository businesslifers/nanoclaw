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
