---
title: Competitor presence map for a suburban pharmacy
mate: research-local-market
schema_version: 1
last_reviewed: 2026-06-02
---

# Competitor presence map for a suburban pharmacy

## Task

An independent pharmacy is located in Caringbah, Sydney. The owner wants to understand who they are competing with in the immediate area and whether any competitors have obvious gaps in their local presence. Produce a competitor presence map only — not a full local market brief.

## Conditions to compare

1. Baseline model (no mate context)
2. Mate prompt only (no wiki, no references)
3. Mate prompt + wiki
4. Mate prompt + wiki + project context (exact address, trading hours, current services offered, known nearby competitors by name)

## What good looks like

- Clear direct/adjacent competitor distinction: direct competitors are other pharmacies; adjacent competitors are supermarket pharmacy sections, health food stores, and bulk-billing GP clinics with dispensary services
- At least three direct competitors named with suburb (even if generic "Caringbah" where exact premises cannot be confirmed), brief positioning description, and local search presence note
- At least one adjacent competitor category identified with rationale for why it is relevant to an independent pharmacy
- At least one gap observation per competitor — e.g. a chain pharmacy with a weak GBP profile for after-hours queries, a competitor with no visible online booking for consultations
- The gap observations are specific to local search and local positioning, not generic industry observations ("chain pharmacies lack personal service" without evidence)
- Confidence calibrated appropriately — findings from web search / map listings are higher confidence than inferred from partial signals

## What bad looks like

- Listing national pharmacy chains without any local specificity (e.g. "Chemist Warehouse is a competitor" with no suburb, no local search finding, no gap observation)
- No distinction between direct and adjacent competitors
- Gap observations that are category truisms rather than findings specific to the local landscape
- Missing local search presence note for any named competitor
- Presenting competitor premises as confirmed when only inferred from search results (should be tagged `[verify]`)
- Format is a narrative essay rather than a structured list or table

## Notes

Caringbah is a real Sydney suburb. The eval tests whether the mate produces a structured, locally-grounded competitive map rather than a generic competitive analysis using national brand knowledge. Graders should assess whether gap observations are specific to the Caringbah/Sutherland Shire local context or are generic industry observations.
