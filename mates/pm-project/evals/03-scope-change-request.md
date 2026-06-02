---
title: Scope-change response to a counterparty request
mate: pm-project
schema_version: 1
last_reviewed: 2026-05-13
---

# Scope-change response to a counterparty request

## Task

Given the following request — *"Week 6 of the 12-week marketing-site rebuild. The counterparty's marketing director has emailed asking, casually, whether the team can 'add a customer-stories section with five case studies' before launch. Original deliverable list defines the launch site as having a static homepage, product pages, an about page, a contact page, and a blog template — no customer-stories section, no case-study content. Counterparty has not flagged any change in budget or timeline. Annual conference launch date is fixed (six weeks away). Design system is on track, dev work is on track, content production is on track against the agreed scope."* — produce the response.

## Conditions to compare

1. Baseline model (no mate context)
2. Mate prompt only
3. Mate prompt + wiki
4. Mate fully loaded under a real claw with the project profile, deliverable list, and counterparty relationship history available

## What good looks like

- Output is two parts: (a) an internal change-request record for the project decision-maker, and (b) a draft response to the counterparty marketing director, written for review before sending. The mate does not reply to the counterparty unilaterally.
- The change request names what's actually being requested in concrete terms: a customer-stories section, five case studies. Lists what's missing to scope it (case-study content authored by whom; design pattern decided where; photography and approvals; cross-link points across the site).
- States the impact on timeline (against a fixed conference launch six weeks out), the impact on cost (against a fixed budget), and the impact on team capacity (named by role: digital designer time on the new section, content time to produce or commission five case studies, dev time to build the pattern). Numbers can be ranges with `[verify]` tags where the mate doesn't have the data.
- Names the three viable responses with the trade-off each accepts: (1) absorb within launch — only viable if content already exists, otherwise it pushes another deliverable or the launch date; (2) defer past launch as a phase-2 deliverable; (3) launch with a placeholder pattern and one short story, fill the rest post-launch. Recommendation is stated with the reason.
- Draft counterparty response is plain, warm, and direct. Acknowledges the request, names that it's outside the original scope, names that the team wants to scope it properly rather than answer on the spot, asks the right disambiguating questions (do they have the case-study content; do they need it before launch or can it land in a phase 2; what's the relative priority against the existing deliverables). Does not commit to delivering it before launch.
- Tone matches the counterparty: this is a long-time-relationship marketing director, not a stranger, so the tone is collaborative — but firm on the scope-change being a decision, not an addition.

## What bad looks like

- "Yes, we can do that" — silent absorption with no impact analysis
- "No, that's out of scope" — refusal without naming the path forward or the trade-offs
- Replies directly to the counterparty without going through the project decision-maker's review
- Impact analysis is vague ("this will likely affect timeline and budget") with no specific deliverables named as the trade-off
- Change request omits one of the three impact dimensions (timeline / cost / capacity)
- Treats the request as urgent and unilaterally reshuffles the existing plan to fit it in
- Tone is corporate or hedging ("we'd be delighted to explore the possibility of...") rather than direct
- No disambiguating questions — assumes what "customer stories" means without confirming

## Notes

This eval tests the scope-change-is-a-decision reflex under a soft, friendly request from someone the team has a good relationship with — the easiest moment to absorb scope and the most expensive moment to do so. A weak answer says yes (or sometimes no) and locks the project into a margin-eroding outcome the decision-maker never approved. A strong answer surfaces the call with the trade-offs named and waits for the decision.
