---
name: local-pack-conversion-gap
description: Zero-conversion readings on "Local 3-Pack"/"Local Listing" campaign formats are often a classification gap, not true zero performance.
metadata:
  type: concept
---

# Local-pack / local-listing conversion classification gap

Campaigns of type "Local 3-Pack Search" or "Google Local Listing PMax" optimize for
Google Business Profile actions — direction requests, calls from the listing, etc.
Those actions frequently aren't mapped into the five conversion actions this role
tracks (`call_native`, `call_website`, `form_submit`, `form_view`, `email_click`).

**Why this matters:** a 0-conversion figure on this campaign format is more likely a
missing/unmapped GBP conversion action than a genuinely dead campaign. Don't
flag these the same way as a 0-conv Search/PMax campaign of a standard product
keyword type, where a true zero is more plausible.

**How to apply:** when auditing, group zero-conv campaigns by format before judging
severity. If most of the zero-conv cluster is local-pack/local-listing format, lead
with "check whether a GBP/local-action conversion is configured" rather than treating
it as a performance failure. Still worth a same-day check — just a different check
(tracking setup, not ad quality).

**First observed:** 2026-07-06 audit across Carpet One (Bundall, Logan City,
Redcliffe, Rockhampton) + Haus Of Rattan — 5 of 8 zero-conv enabled campaigns were
local-pack/local-listing format, spanning 5 different accounts. See [[flag-severities]]
for standard warning thresholds this doesn't override, just recontextualizes.
