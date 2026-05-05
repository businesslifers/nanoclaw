# Channel Architecture

Last updated: 2026-05-02

## v2 Channels (Telegram — active)

| Destination name | Platform | Purpose |
|-----------------|----------|---------|
| `telegram-mg-17772` | Telegram | Adam Jowett's DM — admin/main channel |
| `telegram-mg-17774` | Telegram | Marketing Team channel |

These are the live destinations in v2. Use `send_message(to: "telegram-mg-17772", ...)` to reach Adam, or `send_message(to: "telegram-mg-17774", ...)` for the marketing team.

---

## v1 Channels (Slack — historical reference only)

The following were active during the Slack era. No longer live destinations.

### Registered Channels

| Channel | Slack ID | JID | Type | Requires Trigger | Purpose |
|---------|----------|-----|------|-----------------|---------|
| adam-dm | D0APF375W9H | `slack:D0APF375W9H` | Main (admin) | No — all messages | Adam's private DM — admin control |
| raels-dm | D0APJ2CLK4M | `slack:D0APJ2CLK4M` | Main (admin) | No — all messages | Raels' private DM — admin control |
| janet-main | C0APZS039LL | `slack:C0APZS039LL` | Standard | No — all messages | General team channel (Raels + Tracey) |
| briefmate | C0APY2JNW0P | `slack:C0APY2JNW0P` | Standard | No — all messages | Client briefs, ClickUp tasks, SOPs |
| clientmate | C0APY2SDPSB | `slack:C0APY2SDPSB` | Standard | No — all messages | Client correspondence drafting |
| launchmate | C0AQ3KTMBD4 | `slack:C0AQ3KTMBD4` | Standard | **Yes — `@Janet` required** (updated Apr 13) | Marketing analytics (Google Ads, GA4) |
| crm | C0ASE9FTH9Q | `slack:C0ASE9FTH9Q` | Standard | No — all messages | CRM & contact intelligence agent (registered Apr 14) |
| emacs | — | `emacs:default` | Standard | No trigger | Emacs integration (no Slack ID) |

## Notes

- **Main channels** (adam-dm, raels-dm) have elevated privileges: can register groups, use admin IPC tools, schedule tasks for other groups
- **Standard channels** can only schedule tasks for themselves
- `pmmate` (C0AR7Q1CVMW) was in memory but is **not registered** in the DB as of Apr 10
- The old `slack_marketing-team` folder was removed and content migrated to `slack_launchmate`
- launchmate `requiresTrigger` changed from false → true on Apr 13 per Adam's request (preparing for additional members joining the channel)
- `#crm` registered Apr 14 by Adam at Raels' request; folder: `slack_crm`

## Cross-Mounts

| From | To | Path | Purpose |
|------|----|------|---------|
| briefmate `/workspace/agent/clients/` | clientmate `/workspace/extra/clients/` | `groups/slack_briefmate/clients` | ClientMate reads BriefMate client profiles |

## See also

- [team.md](team.md) — who uses which channels
- [admin-tools.md](admin-tools.md) — how to register/modify groups
