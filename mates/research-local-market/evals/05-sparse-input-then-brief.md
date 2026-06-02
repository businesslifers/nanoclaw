---
title: Sparse-input recovery — direction-required response followed by a brief
mate: research-local-market
schema_version: 1
last_reviewed: 2026-06-02
---

# Sparse-input recovery — direction-required response followed by a brief

## Task

This is a two-turn eval.

**Turn 1:** Give the mate only: "We have a hardware store in the western suburbs. Can you do a local market brief?"

**Turn 2:** Respond to the mate's questions with: "It's in Sunshine, Melbourne. We sell trade and DIY hardware — tools, timber, plumbing, electrical. There's a Bunnings about 3km away. We've been there 12 years and have strong trade customer relationships but weak walk-in retail traffic."

Assess both turns.

## Conditions to compare

1. Baseline model (no mate context) — both turns
2. Mate prompt only (no wiki, no references) — both turns
3. Mate prompt + wiki — both turns
4. Mate prompt + wiki + project context — both turns

## What good looks like

**Turn 1 (direction-required response):**
- The mate does not attempt a brief with the information given — it correctly identifies that "western suburbs" without a suburb name is insufficient
- Questions are numbered and each question names what the answer changes — not just "where is the store?" but "which suburb? — this determines the catchment demographics and competition map"
- The question set covers at minimum: specific suburb/address, store category detail (trade vs. DIY vs. both), and any known competitors
- Three to four questions maximum — not an exhaustive interrogation
- Tone is direct and practical, not apologetic

**Turn 2 (local market brief after answers):**
- Catchment summary reflects Sunshine's actual demographic character (working-class and multicultural western Melbourne, significant proportion of trade workers and tradespeople-adjacent households, lower median income than inner suburbs)
- At least one opportunity tied to the trade customer relationship specifically — e.g. a local tradie community surface, a trade account marketing approach, a nearby development pipeline that creates demand
- The Bunnings proximity is addressed in the opportunity set — either as a competitive gap finding or as a constraint that shapes deployment paths
- At least one opportunity tied to a demographic or development signal specific to Sunshine / the western growth corridor
- Community and sponsorship section reflects the suburb's actual community fabric — multicultural community groups, local footy clubs, trade associations — not generic inner-suburban assumptions
- Local search section notes whether trade-specific queries (e.g. "trade hardware Sunshine", "timber merchant Melbourne west") show a gap relative to the Bunnings presence

## What bad looks like

**Turn 1:**
- Attempting a brief with "western suburbs" as the geographic anchor without asking for specificity
- Asking more than five questions before beginning
- Questions that do not name what the answer changes

**Turn 2:**
- A brief that could apply to any suburb — no Sunshine-specific demographic or community signals
- No engagement with the Bunnings proximity as a competitive context
- Generic hardware store marketing advice ("target tradespeople on social media") without local specificity
- Demographic description of Sunshine that contradicts its actual character (e.g. framing it as an inner-urban creative-class suburb)
- Missing five-part opportunity structure

## Notes

This eval tests two distinct capabilities: (1) the direction-required response triggering correctly when inputs are genuinely insufficient; and (2) the brief quality when inputs are supplied. Sunshine is a real western Melbourne suburb with a well-documented demographic and cultural character. The trade-vs-retail tension and the Bunnings proximity are load-bearing signals that a high-quality brief should engage with, not sidestep. Graders should treat failure to engage with the Bunnings context as a meaningful gap.
