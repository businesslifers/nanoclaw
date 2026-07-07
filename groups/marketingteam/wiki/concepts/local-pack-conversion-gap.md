---
type: concept
created: 2026-07-06
updated: 2026-07-06
sources:
  - Jul 6 2026 all-account campaign audit (work item wi-1783313304338-u5rsif)
related:
  - wiki/concepts/analyst-spec.md
  - wiki/topics/reporting-pipeline.md
  - wiki/topics/client-list.md
---

# Local-pack / Local-listing conversion gap

## The pattern
Campaigns in the "Local 3-Pack Search" and "Google Local Listing PMax" formats routinely show **0 tracked conversions even while spending** in our pipeline. In the Jul 6 2026 audit, 5 of the 8 zero-conversion campaigns were one of these two formats, spanning 5 different accounts (Bundall, Logan City, Redcliffe, Rockhampton, Haus Of Rattan). That spread across accounts is the tell: it's a measurement gap, not five dead campaigns.

## Why it happens
Local-pack and local-listing formats optimise for **Google Business Profile actions** (calls straight from the listing, direction requests, listing clicks). Those actions sit **outside the 5 conversion actions the analyst classifies**: `call_native`, `call_website`, `form_submit`, `form_view`, `email_click` (see [Analyst Spec](analyst-spec.md)). If a GBP / local-action conversion isn't imported and mapped into the account, the traffic converts but registers as zero in our data.

## What to do before crying wolf
When a Local-pack or Local-listing campaign shows 0 conversions on real spend:
1. Check whether a GBP / local-action conversion action is even configured in that account.
2. If not, that's the fix (one setup job), not a targeting or creative problem.
3. Only treat it as genuine zero-performance once GBP conversions are confirmed to be importing.

Standard Search/PMax campaigns showing 0 conversions are more likely a true zero, though a quick GA4-import check is still worth doing.

## Contrast
This is distinct from a GA4 tracking gap (Ads clicks not appearing as GA4 sessions), which the analyst already flags as `tracking_gap`. This gap is specifically about GBP/local conversion actions never being mapped in, so the conversions never enter the data at all.
