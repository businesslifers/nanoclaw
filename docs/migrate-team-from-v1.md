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
