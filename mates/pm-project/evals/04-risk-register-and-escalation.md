---
title: Risk register entry and escalation note
mate: pm-project
schema_version: 1
last_reviewed: 2026-05-13
---

# Risk register entry and escalation note

## Task

Given the following situation — *"Mid-project on a 12-week build. The lead developer has just flagged that a third-party integration the brief depends on has changed its authentication model and that the previously-scoped approach no longer works on the platform's current version. They estimate a workaround is possible but will cost 1–2 weeks of dev time the plan doesn't have. The launch is fixed against an external date. Counterparty has not been told."* — produce the new risk register entry and the escalation note to the project decision-maker.

The output is two artifacts: a single-row risk register entry (description, likelihood, impact, owner, mitigation, current status) and a short internal escalation note. Do not draft anything counterparty-facing yet — that decision belongs to the project decision-maker.

## Conditions to compare

1. Baseline model (no mate context)
2. Mate prompt only
3. Mate prompt + wiki
4. Mate fully loaded under a real claw with the project profile, plan, and counterparty history available

## What good looks like

- Risk register entry is concrete and specific: description names the integration, the auth-model change, and the current scoped approach that no longer works. Likelihood and impact are stated (likelihood: confirmed — this is no longer a risk, it's an issue; impact: 1–2 weeks of dev time against a fixed-date launch with no buffer). Owner is named (lead developer for the technical workaround; the project decision-maker for the scope / timeline call). Mitigation lists the workaround approach and the alternatives (drop the integration from launch, defer to phase 2, negotiate the deadline). Current status named (open — escalation in flight).
- Escalation note leads with the outcome: "Issue, not a risk: the [integration] no longer supports the scoped approach. Workaround costs 1–2 weeks dev we don't have. Decision needed on response within 24–48 hours to protect the launch date."
- Names the three viable responses with the trade-off each accepts, briefly: (1) absorb the workaround — only viable if other deliverables can be deferred or the launch date moves; (2) drop the integration from launch and defer to phase 2; (3) launch with a degraded path on the integration (named explicitly — what "degraded" looks like). Recommendation stated with the reason.
- Names what the mate cannot answer without the decision-maker's input: whether the counterparty has flexibility on the integration being live at launch, whether the launch date itself has any flex, whether the budget has room for the workaround dev time.
- Flags that the counterparty has not been told and that the decision on when and how to tell them is part of the escalation — the mate does not unilaterally draft the counterparty message yet, but names it as the next step once the decision is made.
- Plain language. No softening ("might affect the timeline slightly").

## What bad looks like

- "Risk: integration may be affected." Vague, no impact, no specific deliverable named.
- Categorises the situation as a risk instead of as an issue (it has already occurred — the integration has already changed; likelihood is confirmed).
- Drafts the counterparty-facing message before the decision is made
- Picks a response unilaterally and presents it as the path forward without surfacing the alternatives
- Buries the recommendation under the analysis or omits it entirely
- Misses the 24–48 hour decision urgency or doesn't name it
- Recommends absorbing the workaround into the plan without naming what it pushes out
- Softens the language so that the decision-maker can't tell whether the launch date is genuinely at risk

## Notes

This eval tests the surface-don't-absorb reflex at the moment it's most tempting to absorb — a technical issue with a known workaround, where the project manager could plausibly "just slot it in". A weak answer either over-rotates (panic) or under-rotates (absorb), and in either case denies the decision-maker the call they need to make. A strong answer is short, names the issue as an issue, names the decision needed, lists the viable responses with their costs, and waits for the call.
