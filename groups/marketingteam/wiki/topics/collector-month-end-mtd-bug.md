---
type: topic
created: 2026-07-03
updated: 2026-07-03
related:
  - wiki/topics/reporting-pipeline.md
  - wiki/concepts/collector-data-schema.md
  - wiki/topics/google-ads-proxy-h2-break.md
---

# Collector month-end MTD date bug (recurring, OPEN)

Active, recurring bug in `collector.mjs`. On the **last day of any month**, the collector computes the month-to-date (MTD) range with the start set to the *next* month's 1st while the end is still the current day, so start > end. GA4 rejects the range and every account fails.

## Symptom
On the last calendar day of the month, all 7 accounts fail with:
```
GA4 API error: start_date must be less than or equal to end_date.
start_date = 2026-07-01 and end_date = 2026-06-30
```
Collector logs `0 succeeded, 7 failed`, status `failed`; the analyst is not triggered and no report is produced. The Google Ads pulls themselves are fine — it's only the GA4 MTD period that breaks.

## Root cause
The MTD start-date logic rolls to the following month on the last day instead of staying pinned to the 1st of the current month. End date (yesterday/today) stays in the current month, producing an inverted range.

## Confirmed occurrences
- **2026-05-31** — first observed. Self-cleared Jun 1.
- **2026-06-30** — recurred exactly as predicted in the Jun 26 lint. Self-cleared Jul 1 (7/7 clean run).

Pattern: fails on the month's last day only, self-clears on the 1st. Will keep recurring every month-end until the date logic is fixed. Next expected trigger: **2026-07-31**.

## Fix
Pin MTD start to the 1st of the *current* month regardless of the run day (don't derive it by adding to the month when computing the next period). One-line date-logic fix in `collector.mjs`; not yet coded as of Jul 3 2026.

## Runbook (until fixed)
When the collector reports `0 succeeded, 7 failed` on a month's last day with the `start_date must be <= end_date` error, this is the known bug, not a new outage. Post the standard pipeline-failure warning, note it's the month-end MTD bug, and expect it to self-clear on the 1st. No admin action needed beyond the eventual code fix.

## History note
This was previously tracked only as a "Related open issue" footnote on [google-ads-proxy-h2-break.md](google-ads-proxy-h2-break.md) — a separate, RESOLVED incident (the stale `login-customer-id` header). Split out to its own page in the Jul 3 lint so an active recurring bug isn't buried inside a closed, unrelated one.
