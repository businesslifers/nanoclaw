---
title: Google Search Console (GSC)
tags: [data-source, seo, api]
updated: 2026-04-07
---

# Google Search Console

## What It Measures

GSC reports on how Google's search engine sees and surfaces each site. It is the authoritative source for organic search performance data — everything that happens *before* a user clicks through to the site.

Key data available:
- **Queries** — what search terms are triggering impressions of the site
- **Pages** — which URLs are appearing in search results
- **Clicks** — how many times users clicked through from search results
- **Impressions** — how many times the site appeared in a search result (whether clicked or not)
- **CTR (Click-Through Rate)** — clicks ÷ impressions, expressed as a percentage
- **Average Position** — average ranking position across all queries that returned the site

## Metrics That Matter Most

| Metric | Why It Matters | Watch For |
|--------|---------------|-----------|
| Clicks | Real traffic delivered from search | Week-over-week trend |
| Impressions | Search visibility breadth — pages indexed and ranking | Growing = good, sudden drop = penalty risk |
| CTR | How well titles/meta descriptions convert rankings into clicks | Below expected for position = title optimisation opportunity |
| Avg Position | Overall ranking quality | Drops >5 positions = content decay or competitor move |
| Ranking Keywords | Count of queries with ≥1 impression | Steady growth = content is indexing; plateau = content gap |

## API Access

- **Service:** Google Search Console API v1 (via `googleapis` npm package)
- **Auth:** Google Service Account JSON at path defined in `instance.json > credentials.paths.google_service_account` (base: `/workspace/extra/`)
- **Scope:** `https://www.googleapis.com/auth/webmasters.readonly`
- **Key endpoint:** `searchanalytics.query` — returns aggregated performance data by date, query, page, country, device

```javascript
const { google } = require('googleapis');
const { GoogleAuth } = require('google-auth-library');
const auth = new GoogleAuth({ keyFile: KEY_FILE, scopes: ['https://www.googleapis.com/auth/webmasters.readonly'] });
const sc = google.searchconsole({ version: 'v1', auth });
const res = await sc.searchanalytics.query({
  siteUrl: site.gsc_property,
  requestBody: { startDate: '2026-04-01', endDate: '2026-04-07', dimensions: ['query'], rowLimit: 25 }
});
```

## GSC Property Format — Critical Note

GSC properties are registered in two formats. **Always use the exact `gsc_property` value from `instance.json`** — using the wrong format returns a permission error even when access is correctly granted:

- **URL prefix:** `https://example.com/` ← note trailing slash required
- **Domain property:** `sc-domain:example.com` ← used when property is verified via DNS

To list all accessible properties and verify correct format:
```javascript
const res = await sc.sites.list();
// res.data.siteEntry[].siteUrl gives exact format
```

## Connected Sites

See `instance.json > sites[].gsc_property` for the full list. Current sites:

| Site | GSC Property | Format |
|------|-------------|--------|
| Launch Point Golf | `https://launchpointgolf.com/` | URL prefix |
| The Birthday Best | `https://thebirthdaybest.com/` | URL prefix |
| Indoor Cycling Tips | `https://indoorcyclingtips.com/` | URL prefix |
| Aquasoul | `https://aquasoul.co/` | URL prefix |
| Soul Sensa | `https://soulsensa.com/` | URL prefix |
| The Gaming Man | `sc-domain:thegamingman.com` | Domain |
| Inquisitive Wonder | `sc-domain:inquisitivewonder.com` | Domain |
| Safe To Play | `https://safetoplay.com/` | URL prefix |
| Skate News Wire | `sc-domain:skatenewswire.com` | Domain |

## Known Limitations

- **Data lag:** GSC data is typically 2–3 days behind real-time. Do not use GSC for same-day or yesterday's data — use GA4 for that.
- **Sampling:** High-traffic sites may have query-level data sampled by Google.
- **Position averaging:** Average position is a mean across all queries — a single high-impression query at position 50 can skew the site-level average. Use impression-weighted position for accuracy.
- **Not real user data:** GSC measures search engine interactions, not user behaviour on-site. Pair with GA4 for the full picture.
- **Historical limit:** Data retained for ~16 months by Google.

## Related Pages

- [Google Analytics (GA4)](google-analytics-ga4.md) — on-site behaviour after the click
- [What We Measure](../methodology/what-we-measure.md) — how GSC metrics fit into our reporting framework
- [Alert Thresholds](../methodology/alert-thresholds.md) — when GSC changes trigger alerts
- [Performance Baselines](../sites/performance-baselines.md) — site-level benchmarks
