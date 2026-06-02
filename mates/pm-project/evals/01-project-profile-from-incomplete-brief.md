---
title: Project profile from an incomplete brief
mate: pm-project
schema_version: 1
last_reviewed: 2026-05-13
---

# Project profile from an incomplete brief

## Task

Given the following brief — *"New project starting next week: rebuild of the marketing site for an existing counterparty (mid-sized B2B SaaS, current site is on an outdated CMS, they want to move to a modern static-rendered stack). Three months. Budget is fixed. Team will include a brand designer, a digital designer, and two developers. Counterparty has worked with the team before, but the previous engagement was a small social campaign — no site-build history. Launch target lines up with their annual user conference. Stakeholder on their side is the marketing director, with sign-off going through the CMO for anything above an unspecified threshold."* — produce the project profile that will serve as the source of truth for the engagement.

The brief is deliberately incomplete. The profile must name what's missing as explicit open questions (with the decision-maker for each), not silently fill the gaps with plausible-sounding defaults.

## Conditions to compare

1. Baseline model (no mate context)
2. Mate prompt only
3. Mate prompt + wiki
4. Mate fully loaded under a real claw with the counterparty's relationship history available

## What good looks like

- Structured against the project-profile shape: project overview, team, counterparty, technical and platform context, project history, risks and open questions, flags and sensitivities. Sections present even when sparse, with the gap named rather than skipped silently.
- Deliverables block lists what's been promised explicitly (not summarised). If the brief doesn't name the deliverables specifically — and it doesn't — the profile names this as a blocker open question, not a guess.
- Open questions are specific, owned, and dated. "What does success look like at launch — is this a like-for-like rebuild on new infrastructure, or a content / IA redesign as well? Owner: marketing director. Needed by: kickoff." Not "TBD" or "to be confirmed".
- Risks are named with likelihood, impact, and a mitigation. Annual conference launch date is named as a fixed-deadline risk; outdated-CMS migration is named as a content-and-redirects risk; no prior site-build relationship with this counterparty is named as a calibration risk on review cadence and approval sign-offs.
- Sensitivities / flags name what's not in the brief but needs to be: the unspecified sign-off threshold above which the CMO needs to be looped in (named as a blocker open question, with the marketing director as the owner); the lack of prior site-build history with this counterparty as a relationship calibration risk worth flagging.
- Lead summary at the top states overall readiness in one or two sentences — "Profile draft is provisional; cannot proceed to task briefing until the deliverable list and sign-off threshold are confirmed in writing" — not buried.
- Plain language. No corporate-speak. No "we'll align on the deliverables" or "circle back on the threshold".

## What bad looks like

- Profile reads as a polished narrative summary of the brief rather than a structured working document
- Deliverable list invented from "what a marketing site rebuild usually includes" rather than flagged as a blocker open question
- Risks named in the abstract ("scope creep") without likelihood, impact, or mitigation
- Open questions phrased as "TBD" / "to be confirmed" with no owner and no date
- Sign-off threshold silently absorbed as "we'll figure it out as we go" rather than flagged as a blocker
- Annual-conference launch date treated as a soft deadline rather than a fixed-date risk
- Lead summary missing or buried under the section headings; reader has to read the whole profile to find out whether the project is ready to start
- Buzzwords or corporate-speak ("synergy", "unlock", "elevate", "ecosystem", "leverage")

## Notes

This eval tests the profile-before-plan reflex against a brief that is deliberately incomplete in load-bearing places. A weak answer fills the gaps and produces a confident-looking profile that the team would build a doomed plan from. A strong answer names the gaps explicitly as blockers, attributes each one to the right decision-maker, and refuses to proceed past kickoff until they're closed.
