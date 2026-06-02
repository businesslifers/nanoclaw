---
title: Local search snapshot for a gym in a growth suburb
mate: research-local-market
schema_version: 1
last_reviewed: 2026-06-02
---

# Local search snapshot for a gym in a growth suburb

## Task

A 24-hour independent gym is located in Clyde North, Melbourne — a rapidly growing outer-suburban growth corridor. The gym suspects its local search visibility is weak relative to nearby chain competitors. Produce a local search snapshot only.

## Conditions to compare

1. Baseline model (no mate context)
2. Mate prompt only (no wiki, no references)
3. Mate prompt + wiki
4. Mate prompt + wiki + project context (store name, GBP URL, known that GBP was claimed 18 months ago but not actively managed, aware of two nearby Anytime Fitness locations)

## What good looks like

- Opening paragraph on GBP status: what can be assessed (claimed/unclaimed/incomplete, review count, last activity signal if visible, category assignment)
- At least five category + suburb query combinations assessed, covering variations such as: "gym Clyde North", "24 hour gym Clyde North", "gym near [adjacent suburb]", "personal trainer Clyde North", "gym [nearest shopping centre or landmark]"
- For each query: the store's estimated visible ranking position (or "not visible in local pack"), the top-ranking competitor name and position, and a gap note
- At least one finding that reflects the growth-corridor context — e.g. a query volume signal or a gap between the number of nearby residents and the number of visible gym results in local search
- Priority-order findings list at the close: the two or three most important local search issues, ranked by impact
- Directional recommendation on each priority finding — not a technical SEO brief, but enough that the finding points somewhere actionable
- Limitations are named if live search data could not be accessed — output is tagged `[limited access]` where appropriate

## What bad looks like

- GBP status section that says only "claim your Google Business Profile" without assessing the store's current status
- Fewer than five queries assessed
- Query combinations that are irrelevant (e.g. "gym Australia", "best gym Melbourne") rather than locally anchored
- Competitor rankings stated as definitive facts when they are inferred from limited signals (should be tagged `[estimate]` or `[verify]`)
- Priority findings that are generic SEO advice ("add photos to your GBP") rather than specific to this store's local competitive context
- No finding that references the growth-corridor or new-suburb context — the eval specifically includes Clyde North's growth status as a context signal the mate should pick up

## Notes

Clyde North is a real Melbourne outer-suburban growth area with rapid residential development. The eval tests whether the mate handles the local search output shape correctly — structured, query-by-query, with honest confidence calibration — rather than producing generic GBP optimisation advice. Graders should assess whether the growth-corridor context appears meaningfully in the output (e.g. noting that new-resident search behaviour in growth suburbs differs from established suburbs, or that competitors may not yet have saturated local pack rankings).
