# Channel Architecture

Last updated: 2026-05-08

## Messaging-group ID format (read this first)

A v2 messaging group ID looks like `mg-1777957394563-jfn9s6` — literally `mg-` + a 13-digit Unix-millis timestamp + `-` + a 6-character random suffix. They are **not** short, not guessable, and not derivable from the channel name. Do not abbreviate (`slack-mg-17779` is wrong). Do not invent (`telegram-mg-17772` is wrong). If you don't have the ID in hand, say so — ask Adam, or note that you'd need to query the host. Same rule for `agent_groups.id` (`ag-...`) and `messaging_group_agents.id` (`mga-...`).

When you reference a destination conversationally, the channel name (`Adam's Slack DM`, `Marketing Team`) is fine — the underlying `mg-...` ID is only relevant for `send_message(to: ...)` calls, where you should use the registered destination *name* anyway, not the raw mg id.

## v2 Live Channels

| Destination | Channel | Platform ID | Messaging-group ID | Engage |
|---|---|---|---|---|
| Adam's Telegram DM | Telegram | `telegram:7466423983` | `mg-1777256921639-x18t1p` | every message |
| Adam's Slack DM | Slack | `slack:D0B16TLGLJ3` | `mg-1777957394563-jfn9s6` | mention-sticky (`@Janet`) |
| Marketing Team | Slack | `slack:C0B1LB9T26A` | `mg-1777957905683-uxjv20` | mention-sticky |
| CRM | Telegram | `telegram:-5116329515` | `mg-1777601737339-kdt2fr` | mention |
| ClientMate | Telegram | `telegram:-5293085842` | `mg-1777607057297-8k2t6h` | every message |
| CLI Agent | Local | `local` | `mg-1777255249930-a6z6ke` | every message |

Adam's DM with you (Janet) runs on **two channels in parallel** — Telegram is the original v2 wiring; Slack was added 2026-05-05 via `/add-slack`. Both go to the same agent group (`ag-1777257359331-63ti7x`, `dm-with-adam` folder), same memory, same wiki — so context follows you across whichever channel he writes on.

The Marketing Team Telegram wiring (`mg-1777429771946-afqaze` / `telegram:-5055500128`) was deleted 2026-05-08 when the team moved to Slack-only. Don't try to message it.

## Cross-agent destinations

`send_message(to: "<destination>", ...)` routes to whatever's registered in your `agent_destinations`. As of 2026-05-08, your destinations are channel-only — your Telegram DM, your Slack DM, and the Marketing Team Slack channel. Inter-agent destinations to `clientmate`, `marketingteam`, `crm`, `cli-with-adam` are **not** wired on this install (the agent groups exist; the destination rows do not). Don't guess names — fail closed and tell Adam if a delegation isn't reachable.

---

## v1 Channels (Slack — historical reference only)

The team ran on Slack until the v2 port. Slack channels and JIDs below are kept for reference only — they are not live destinations and should not be messaged. (Slack is back as a live v2 channel for Adam's DM and Marketing Team, but it's a different workspace; nothing in this v1 table maps to v2.)

| Channel | Slack ID | Type | Purpose |
|---------|----------|------|---------|
| adam-dm | D0APF375W9H | Main (admin) | Adam's private DM — admin control |
| raels-dm | D0APJ2CLK4M | Main (admin) | Raels' private DM — admin control |
| janet-main | C0APZS039LL | Standard | General team channel (Raels + Tracey) |
| briefmate | C0APY2JNW0P | Standard | Client briefs, ClickUp tasks, SOPs |
| clientmate | C0APY2SDPSB | Standard | Client correspondence drafting |
| launchmate | C0AQ3KTMBD4 | Standard, `@Janet` required | Marketing analytics — renamed `marketingteam` in v2 |
| crm | C0ASE9FTH9Q | Standard | CRM & contact intelligence |
| pmmate | C0AR7Q1CVMW | Standard | PM agent (was in memory but unregistered) |
| emacs | — | Standard | Emacs integration (no Slack ID) |

## See also

- [team.md](team.md) — who uses which channels
- [admin-tools.md](admin-tools.md) — how to register/modify groups
