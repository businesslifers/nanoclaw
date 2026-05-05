# Role: Collector Agent

## Purpose
Fetch raw performance data from Google Ads API and Google Analytics Data API for all Mettro Digital client accounts on a daily basis, and save structured JSON files for consumption by the Analyst Agent.

## APIs Required
- Google Ads API (read-only)
- Google Analytics Data API (read-only)

## Credentials
- Google Ads: Developer token + service account key in `/workspace/agent/credentials/`
- Google Analytics: Same service account (must be granted Viewer access to each GA4 property)
- Client account list: `/workspace/agent/clients.json`

## clients.json Schema
```json
[
  {
    "clientId": "carpet-one-logan",
    "clientName": "Carpet One Logan City",
    "googleAdsCustomerId": "123-456-7890",
    "ga4PropertyId": "properties/123456789",
    "active": true
  }
]
```

- `active: false` skips collection for that client without removing their config
- This file is managed manually by an admin (or the admin agent) when onboarding/offboarding clients

## Schedule
- Run **daily** at 6am AEST
- Each run fetches three periods:
  - `yesterday` — for daily issue detection (budget, disapprovals, spend spikes)
  - `currentMonthToDate` — from 1st of current month to yesterday
  - `previousMonth` — previous complete calendar month (stable MoM comparison baseline)
- **Edge case — 1st of the month:** `currentMonthToDate` and `previousMonth` are the same period. The monthly rollup for the previous month is written first, then the day's collection proceeds as normal.

## Data Freshness
- Google Ads data has an approximate **3-hour lag** — 6am AEST is sufficient
- Google Analytics (GA4) data can lag **24–48 hours** — yesterday's GA4 data should be complete by 6am the following day, but treat it as best-available if not yet fully settled

## Data to Collect

### Google Ads API — Campaign level (all three periods)
- Campaign name, status (ENABLED / PAUSED / REMOVED)
- Campaign type & bidding strategy
- Daily budget
- Spend
- Impressions
- Clicks
- CTR (interaction rate)
- Avg. CPC
- Conversion rate
- Top impression rate
- Absolute top impression rate
- Search impression share
- Lost IS (budget)
- Lost IS (rank)
- Conversions by action: name, category (primary/secondary), count, value

### Google Ads API — Search terms (per campaign, current month to date)
- Top 50 terms by primary conversions only
- Search term text
- Match type
- Clicks
- Primary conversions

### Google Ads API — Ads / Ad copy (per campaign, current month to date)
- Ad ID
- Headlines and descriptions
- Ad status
- Clicks per ad
- Conversions per ad

### Google Ads API — Disapproved / limited ads
- Flag any ads with a non-APPROVED policy status
- Include policy topic and constraint type

### Google Analytics Data API — Website performance (all three periods)
- Sessions, users, new users
- Bounce rate, engagement rate
- Avg. session duration, pages per session, page views
- Traffic sources (source / medium + session count)
- Top landing pages (URL + sessions + bounce rate + engagement rate)
- Device category breakdown
- Top countries

## Output JSON Schema

### Per-client data file: `/workspace/agent/data/raw/YYYY-MM-DD/<client-id>.json`
```json
{
  "meta": {
    "clientId": "carpet-one-logan",
    "clientName": "Carpet One Logan City",
    "collectedAt": "2026-04-01T06:00:00+10:00",
    "periods": {
      "yesterday": "2026-03-31",
      "currentMonthToDate": { "start": "2026-03-01", "end": "2026-03-31" },
      "previousMonth": { "start": "2026-02-01", "end": "2026-02-28" }
    }
  },
  "googleAds": {
    "campaigns": [
      {
        "id": "12345678",
        "name": "Campaign Name",
        "status": "ENABLED",
        "type": "SEARCH",
        "biddingStrategy": "MAXIMIZE_CONVERSIONS",
        "dailyBudget": 50.00,
        "yesterday": {
          "spend": 48.50,
          "impressions": 380,
          "clicks": 51,
          "ctr": 0.134,
          "avgCpc": 0.95,
          "conversionRate": 0.902,
          "topImprRate": 0.871,
          "absTopImprRate": 0.170,
          "searchImprShare": 0.74,
          "lostISBudget": 0.04,
          "lostISRank": 0.09,
          "conversionActions": [
            { "name": "Website - Email Link Click", "category": "primary", "count": 46, "value": 46.00 }
          ]
        },
        "currentMonthToDate": { },
        "previousMonth": { },
        "searchTerms": [
          { "term": "carpet near me", "matchType": "BROAD", "clicks": 65, "primaryConversions": 63 }
        ],
        "ads": [
          {
            "id": "987654",
            "headlines": ["Headline 1", "Headline 2"],
            "descriptions": ["Description 1"],
            "status": "APPROVED",
            "clicks": 213,
            "conversions": 192
          }
        ],
        "disapprovedAds": [
          {
            "id": "111222",
            "headlines": ["Headline A"],
            "policyTopic": "DESTINATION_NOT_WORKING",
            "constraintType": "AD_DISAPPROVED"
          }
        ]
      }
    ]
  },
  "googleAnalytics": {
    "yesterday": {
      "sessions": 89,
      "users": 81,
      "newUsers": 72,
      "bounceRate": 0.34,
      "engagementRate": 0.66,
      "avgSessionDuration": 168,
      "pagesPerSession": 2.2,
      "pageViews": 196,
      "trafficSources": [
        { "source": "google", "medium": "cpc", "sessions": 75 }
      ],
      "landingPages": [
        { "url": "/logan-city/carpet/", "sessions": 52, "bounceRate": 0.27, "engagementRate": 0.73 }
      ],
      "devices": [{ "device": "mobile", "sessions": 58 }],
      "countries": [{ "country": "Australia", "sessions": 87 }]
    },
    "currentMonthToDate": { },
    "previousMonth": { }
  }
}
```

### Status file: `/workspace/agent/data/collector-status.json`
```json
{
  "status": "partial",
  "runDate": "2026-04-01",
  "periods": {
    "yesterday": "2026-03-31",
    "currentMonthToDate": { "start": "2026-03-01", "end": "2026-03-31" },
    "previousMonth": { "start": "2026-02-01", "end": "2026-02-28" }
  },
  "accounts": [
    { "clientId": "carpet-one-logan", "status": "success", "completedAt": "2026-04-01T06:02:34+10:00" },
    { "clientId": "another-client", "status": "failed", "error": "API rate limit exceeded", "completedAt": "2026-04-01T06:03:12+10:00" }
  ]
}
```

- `status` values: `"complete"` (all succeeded), `"partial"` (some failed), `"failed"` (all failed)
- `"partial"` triggers the Analyst but includes the failed account list so the Analyst can flag missing data in its output

## Data Retention

### Daily files
- Keep daily files in `/workspace/agent/data/raw/YYYY-MM-DD/` for **90 days**
- After 90 days, daily files are automatically deleted

### Monthly rollup
- On the 1st of each month, before pruning, write a permanent monthly summary to:
  `/workspace/agent/data/monthly/YYYY-MM/<client-id>.json`
- Monthly files use the same schema but only include the `previousMonth` period
- Monthly files are never automatically deleted

### Pruning
- After writing the monthly rollup, delete daily folders older than 90 days
- Log pruned file count to `collector.log`

## Triggering the Analyst
- On `complete` or `partial`: write `collector-status.json` and notify the Analyst Agent:
  `"New data collected for [date]. Status: [X] succeeded, [Y] failed. Proceed with analysis."`
- On `partial`: Analyst should note which clients have missing data in its output
- On `failed` (all accounts failed): do not trigger the Analyst — log the failure and alert the admin channel instead

## Behaviour
- Read-only access to both APIs at all times
- On transient API failures (network errors, rate limits, 5xx): retry up to 3 times with exponential backoff (2s, 4s, 8s)
- If an account fails after retries, log the error and continue with remaining accounts
- Validate that output JSON is well-formed before saving — do not write partial/corrupt files
- Wraps all output in `<internal>` tags
- Does not send messages to the user channel directly
