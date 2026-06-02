---
title: Weekly status update from tracker state
mate: pm-project
schema_version: 1
last_reviewed: 2026-05-13
---

# Weekly status update from tracker state

## Task

Given a snapshot of the project tracker at end-of-week — *"Week 4 of 12 on the marketing-site rebuild. Brand exploration tasks complete and signed off (3 of 3). Information architecture draft delivered, awaiting feedback (overdue by 2 days against counterparty review window). Design system tasks in progress (2 of 5 complete, 1 blocked on IA sign-off, 2 not started). Developer environment set up; first component build started. Risks since last update: counterparty IA reviewer has been out sick three days; design system can't progress past 3 of 5 components until IA is signed off; conference date hasn't moved but the buffer has narrowed by 2 days. No new scope changes."* — produce the internal status update for the project decision-maker.

## Conditions to compare

1. Baseline model (no mate context)
2. Mate prompt only
3. Mate prompt + wiki
4. Mate fully loaded under a real claw with the project profile and counterparty relationship history available

## What good looks like

- Lead line states overall status in one short sentence: "At risk — IA sign-off delay is starting to compress design-system progress and the launch buffer." Not "things are progressing well" and not buried after the detail.
- The risk goes at the top with a proposed next step, not at the bottom. "Recommend a check-in with the marketing director to confirm whether the IA review can resume this week or needs a contingency — if it slips a further three days, design-system delivery and the launch buffer are exposed."
- "What was done" is bullet points with concrete items: brand exploration signed off (3 of 3); IA draft delivered; design system 2 of 5 complete; dev environment set up. Not "good progress on brand and design system this week".
- "What's next" names the work and the dependency: continue design system on the 2 components that aren't blocked; resume the blocked component the moment IA is signed off; first component build on the dev side.
- No restated history. The reader is assumed to remember the project; the update adds new information.
- Plain language, bullets over paragraphs, lead with the outcome.
- If the answer recommends escalating beyond the project decision-maker (e.g. to the CMO via the existing sign-off path), it names the threshold reason — not a default reflex.

## What bad looks like

- "Things are progressing well this week" or any variant of an empty lead line
- Risk buried at the bottom or softened to the point of disappearing ("we may need to keep an eye on the IA review")
- Re-summarises the project, the team, and what was done in weeks 1–3
- Long paragraphs of prose where a bullet list does the job
- No proposed next step on the risk — names it but does not say what to do about it
- Reports against memory ("brand should be wrapping up this week") rather than tracker state ("brand signed off, 3 of 3 complete")
- Buzzwords or padding ("we're well-positioned to continue delivering value")
- Recommends a counterparty-facing communication without flagging that it needs review before sending

## Notes

This eval tests three things: outcome-first writing under a soft pressure to soften bad news, the discipline of writing against current tracker state (not against memory of what should be happening), and the surface-don't-absorb reflex when a slipping dependency starts to expose a fixed-date commitment. A weak answer reads like a polite recap. A strong answer is a working document the decision-maker can act on in 30 seconds.
