# LaunchMate Daily Report Format

Last updated: 2026-04-17

## Status

Approved format as of Apr 9, 2026. Adam confirmed: *"perfect, remember this as our format going forward for now"*

## Structure

```
:bar_chart: _Google Ads — [Day DD Mon]_

>:red_circle: [n] critical   :large_yellow_circle: [n] warning   :large_green_circle: [n] positive   [n] accounts

_:red_circle: Needs action today_
• _[Client]_ ([Campaign]) — [specific issue e.g. $X/$Y budget, Z% IS lost]
• ...

:large_yellow_circle: _[Category]_ — [n] campaigns
• [concise detail per campaign]
• ...

:large_yellow_circle: _[Category]_ — [n] flags
• [detail]
• ...

:large_green_circle: _Positives_
• [Client] — [positive metric]
• ...

:clock6: _[HH:MM]am AEST — Ask @Janet about a specific account for detail._
```

## Key Principles

- **Grouped by category, not by client** — avoids repetitive "same advice for every campaign" problem
- **Critical (red) first** — campaigns over budget or with major impression share loss that need action today
- **Yellow grouped by type** — impression share, spend (MTD pace + anomalies), conversions (MTD vs prior month), tracking & ad quality
- **Positives last** — CPC efficiency wins etc.
- **Footer timestamp** — always show time posted and invite follow-up questions

## What NOT to do

- Do not list every campaign individually with the same recommendation — group by action type
- Do not use `:yellow_circle:` — use `:large_yellow_circle:` (see [slack-formatting.md](slack-formatting.md))
- Do not make the message so long it becomes unreadable — summarise counts, name specific clients only for critical issues

## Critical Flag Rules — Approved Update (Apr 14)

Adam approved a change to how budget/IS loss is classified. The old rule flagged any campaign at ≥98% spend with >25% lostISBudget as critical — but most of these cases are due to **client budget constraints**, which are not actionable.

**New rule (approved Apr 14):**

| Condition | Severity |
|-----------|----------|
| Spend ≥ 98% budget AND lostISBudget > 25% AND CPA/ROAS is **NOT** improving | Warning only — budget-constrained, nothing actionable |
| Spend ≥ 98% budget AND lostISBudget > 25% AND CPA/ROAS **IS** improving | **Critical** — budget is limiting performance gains; recommend increase |

Rationale: If efficiency metrics are flat or declining, capping spend is fine. If they're improving, uncapped budget would improve results — that's actionable and critical.

✅ The `analyst-role.md` spec was updated on Apr 16 at 08:00 via scheduled task.

## Disapproved Ad Reporting — Best Practice (Apr 16)

When the daily report flags a disapproved ad, Adam's workflow is to immediately ask:
1. Which specific ad is it? (name/headline)
2. Can you generate a direct link to it in the Ads UI?
3. What is the policy reason/status?

**Improvement:** When flagging disapproved ads, the analyst should include the specific ad headline and policy topic directly in the report flag detail — not just the count. This avoids the multi-step follow-up.

Example detail format:
> "'Carpet - Search - Branded' — ad "Get Carpet Fitted Today" disapproved: DESTINATION_NOT_WORKING. Ad group: Branded Generic."

**Google Ads API access: read-only** (as of Apr 2026). Janet can query and report but cannot pause, edit, or create ads/ad groups. Adam is aware; write access is a future consideration.

**Direct ad links:** Janet cannot currently generate deep-links into the Google Ads UI to a specific ad. The API does not return UI URLs — Adam must navigate via the Ads interface using the ad ID and campaign name provided.

## Ad-hoc Data Queries (Adam's Pattern)

Adam regularly requests campaign data for specific date ranges outside of the daily report. Established pattern (Apr 20):

- **Format:** "Look at [Client] for [date range] and tell me [metrics], broken down by campaign"
- **Common metrics:** contact page hits, contact form submissions, calls from ads
- **Always break down by campaign** — never give aggregate-only totals
- Adam typically says "remember learnings from previous requests like this" — this means: follow the same structure, use the same metrics naming, and retain any preferences from prior queries in the LaunchMate channel context
- QLD Capital is the most frequent subject for these ad-hoc queries

## Client Status — Paused Accounts

| Client | Status | Since | Notes |
|--------|--------|-------|-------|
| QLD Capital | **Paused** | 2026-04-24 | All ads paused "until further notice." Adam actioned in ads interface. Exclude from daily anomaly flags — paused spend/conversion drops are expected. Still include in report only if there are tracking or approval issues requiring attention. |

## Evolution Notes

- **Apr 8 v1**: Initial report posted as a flat per-campaign list — Adam flagged as hard to read, `:yellow_circle:` not rendering
- **Apr 8 v2**: Grouped by severity/category — Adam approved this format
- **Apr 14**: Critical flag rule for budget/IS updated — budget-constrained campaigns are warning-only unless efficiency metrics are improving
- **Apr 16**: Disapproved ad detail standard raised — include ad headline + policy reason in report, not just count; confirmed read-only API access

## See also

- [slack-formatting.md](slack-formatting.md) — emoji and mrkdwn rules
- [channel-architecture.md](channel-architecture.md) — LaunchMate channel details
