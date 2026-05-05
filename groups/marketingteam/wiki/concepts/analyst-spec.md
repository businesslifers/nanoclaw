---
type: concept
created: 2026-05-05
updated: 2026-05-05
sources:
  - sources/v1-conversations/2026-04-08-conversation-2312.md
related:
  - wiki/topics/reporting-pipeline.md
  - wiki/concepts/collector-data-schema.md
---

# Analyst Spec

Rules and output format for `analyst.mjs` — the interpretation layer of the daily pipeline.

## Primary role
Turn raw numbers into signals. The Collector produces facts; the Analyst produces meaning. Every `detail` and `recommendedAction` string must be fully-formed, human-readable, and ready to post verbatim — the Reporter does zero interpretation.

## Inputs
- `data/raw/YYYY-MM-DD/<client-id>.json` — today's per-client files
- `collector-status.json` — run date, per-client success/failure, overall status
- Last 7 daily directories — rolling average baselines
- Monthly rollup files — MoM comparisons

## Analysis rules

### 🔴 Critical
- Unexpected campaign pause
- All ads disapproved
- Budget exhausted (spend ≥98% + lost IS >25%)
- Possible account suspension

### 🟡 Warning
- Spend >20% off 7-day average
- Lost impression share >35%
- CPC spike >25%
- Conversion rate drop >25%
- Any disapproved ads
- GA4 tracking gap (<65% of Ads clicks showing in GA4 sessions)
- High bounce rate on paid traffic (>70%)
- MTD pace >30% off prior month

### 🟢 Positive
- Conversions up >20%
- CPC down >15%
- Impression share gain >10pp
- Strong MTD growth

## Conversion action classification
Analyst classifies conversion actions by type regardless of how each client named them:

| Type | Detection |
|---|---|
| `call_native` | Google Ads call extension / call-only ad conversions |
| `call_website` | GA4 phone click events (click on tel: link) |
| `form_submit` | GA4 form submission events |
| `form_view` | GA4 form view/start events |
| `email_click` | GA4 email link click events |

## Contact engagement analysis
Run every client, every day (MTD, account-level). Fields written to `summary.contactEngagement`:
- Form views and submissions (paid vs organic split)
- Phone clicks (paid vs organic)
- Email clicks
- Native calls (call extension conversions)
- **Form engagement gap flag**: high form views with near-zero submissions
- **Zero contact flag**: paid traffic with no contact events of any type

## Output schema
`analysis/YYYY-MM-DD.json`:
```json
{
  "clients": [
    {
      "clientId": "...",
      "dataAvailable": true,
      "flags": [
        {
          "severity": "critical|warning|positive",
          "scope": "account|campaign",
          "campaign": "Campaign Name or null",
          "metric": "spend|cpc|...",
          "detail": "Fully-formed human-readable sentence.",
          "recommendedAction": "Fully-formed recommended action sentence."
        }
      ],
      "summary": {
        "spend": ...,
        "budgetUtilisation": ...,
        "conversions": ...,
        "impressionShare": ...,
        "momChanges": { ... },
        "contactEngagement": { ... }
      }
    }
  ]
}
```

## Design decisions
- **Client ordering**: Reporter decides (Analyst does not pre-sort)
- **Detail strings**: Analyst writes them fully-formed; Reporter posts verbatim
- **`summary` block**: Reserved for future use (e.g. metrics digest); Reporter does not use it for flag formatting
