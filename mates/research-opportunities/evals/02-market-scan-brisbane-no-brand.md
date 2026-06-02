---
title: Market scan for Brisbane with no brand specified
mate: research-opportunities
schema_version: 1
last_reviewed: 2026-05-17
---

# Market scan for Brisbane with no brand specified

## Task

Given the following brief — *"Produce a market scan for Brisbane right now. No brand, no specific category in mind — what are the dominant audience signals and commercial opportunities active in this market this quarter? Output is for use in new-business prospecting and strategic planning conversations, not a specific client brief."* — produce the market scan summary.

## Conditions to compare

1. Baseline model (no mate context)
2. Mate prompt only
3. Mate prompt + wiki
4. Mate fully loaded under a real claw with prior market scans for adjacent regions available

## What good looks like

- Opening market-context paragraph names what is observably happening in Brisbane this quarter — the economic, cultural, seasonal, or category-level moment shaping what people are buying, worrying about, or talking about. Grounded in observable VOC and search-intent signal, not a generic Australian summary.
- Three to eight opportunities in the standard five-part format.
- At least one opportunity from a non-obvious category (not just the predictable property / cost-of-living / cafes-and-hospitality lens), surfaced because the VOC signal actually exists there.
- Opportunities are specific to the Brisbane market — local community spaces, Brisbane-relevant review surfaces, location-specific search-intent signal — not a generic Australian scan with "Brisbane" pasted on top.
- Confidence varies across the set, with at least one explicitly low-confidence opportunity flagged as worth tracking rather than acting on now.
- Deployment paths suit the signal type — long-form for high-anxiety decisions, short-form video or paid for quick frustrations, location-aware creative for genuinely local moments.
- Buyer-language extract appended, organised by theme, with phrases that read as locally-grounded (idiom, references, weather and seasonal context) rather than generic Australian or imported US discourse.
- Geographic variation worth flagging is named — e.g. where the Brisbane signal differs from Sydney, Melbourne, or the broader national pattern.

## What bad looks like

- Market context is a generic Australian-economy summary that could be pasted into a Sydney or Melbourne scan unchanged
- Opportunities are the predictable property / cost-of-living / hospitality categories every market scan covers, with no signal from less obvious spaces
- VOC sources used are national or US-based, with the geographic mismatch unflagged
- The scan reads as a trends report — what is happening — rather than an opportunity set — what could be made about it
- All opportunities marked high-confidence, or no confidence rating applied
- Buyer-language extract composed of marketing voice rather than actual local discourse
- Padding the set to eight opportunities when fewer would have been stronger

## Notes

This eval tests open-input range: with no brand and no topic, does the mate find the signal that actually exists in this market, or does it default to a generic regional summary? The failure mode: a polished-looking document that any other Australian capital could swap its name onto.
