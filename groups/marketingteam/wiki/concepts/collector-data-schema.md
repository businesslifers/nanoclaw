---
type: concept
created: 2026-05-05
updated: 2026-05-05
sources:
  - sources/v1-conversations/2026-04-08-conversation-2312.md
related:
  - wiki/topics/reporting-pipeline.md
  - wiki/concepts/analyst-spec.md
  - wiki/topics/client-list.md
---

# Collector Data Schema

What `collector.mjs` produces each day.

## File locations
- **Per-client raw data:** `data/raw/YYYY-MM-DD/<client-id>.json` — one file per client per day
- **Status signal:** `data/collector-status.json` — run date, per-client success/failure, overall status (`complete` / `partial` / `failed`)
- **Log:** `data/collector.log`

## Time periods
Each run collects three periods for every client:
- `yesterday` — single-day snapshot for issue detection
- `currentMonthToDate` — 1st of month to yesterday
- `previousMonth` — previous complete month (MoM baseline)

## Google Ads data (all 3 periods)
- **Campaigns:** name, status, type, bidding strategy, daily budget
- **Metrics:** spend, impressions, clicks, CTR, avg CPC, conversion rate, top/abs top impression rate, search impression share, lost IS (budget & rank), conversions by action (name, category, count, value)
- **Search terms** (MTD, top 50 by primary conversions): term, match type, clicks, conversions
- **Ad copy** (MTD): headlines, descriptions, status, clicks, conversions
- **Disapproved/limited ads:** policy topic + constraint type

## GA4 data (all 3 periods)
- Sessions, users, new users
- Bounce rate, engagement rate, avg session duration, pages/session, page views
- Traffic sources (source/medium + sessions)
- Top landing pages (URL, sessions, bounce rate, engagement rate)
- Device breakdown
- Top countries
- Contact engagement events: form views/submits, phone clicks, email clicks — split by campaign/source

## Trigger signal
`collector-status.json` tells the Analyst:
- Which clients succeeded/failed
- Overall status: `complete` (all OK), `partial` (some failed), `failed` (all failed)
- On `partial`: Analyst flags missing clients in output
- On `failed`: Analyst is not triggered

## Service account requirements
`janet-marketing-agent@janet-492005.iam.gserviceaccount.com` needs:
- Google Ads: access granted at account level (manager access via Lifers PTY LTD or carpetone.com.au MCC)
- GA4: Viewer role on each property (must be added in GA4 Admin > Property Access Management per property)
