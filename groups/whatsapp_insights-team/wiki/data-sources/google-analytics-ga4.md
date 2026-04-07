---
title: Google Analytics 4 (GA4)
tags: [data-source, analytics, api]
updated: 2026-04-07
---

# Google Analytics 4 (GA4)

## What It Measures

GA4 tracks user behaviour *on-site* after they arrive — from whatever source brought them. It is the primary source of truth for traffic volume, engagement quality, audience geography, and content performance.

Unlike the older Universal Analytics, GA4 is event-based: every interaction (page view, scroll, click, form submission) is an event. This makes it more flexible but requires understanding which events are tracked by default vs custom.

## Key Metrics

| Metric | Definition | Why It Matters |
|--------|-----------|----------------|
| Sessions | A group of user interactions within a time window | Primary traffic volume measure |
| Users / Total Users | Unique visitors | Audience size |
| New Users | First-time visitors | Acquisition signal |
| Pageviews (screenPageViews) | Total pages viewed | Content consumption depth |
| Engagement Rate | % of sessions with >10s duration, 2+ pageviews, or conversion | Quality filter — removes bounces |
| Avg Session Duration | Mean time spent per session (seconds) | Engagement depth; varies by content type |
| Bounce Rate | Inverse of engagement rate | High bounce = low intent or poor content match |
| Sessions by Channel | Organic, Direct, Referral, Social, Email | Traffic source mix |
| Sessions by Country | Geographic origin | High-value market exposure (see [Traffic Quality Focus](../methodology/what-we-measure.md)) |
| Sessions by Device | Mobile, Desktop, Tablet | UX context; affects RPM for ad monetisation |
| Landing Page | First page of each session | Which content drives entry |

## What to Watch For

- **Engagement Rate <20%** — may indicate bot traffic, very thin content, or poor search intent match
- **Session duration <5s at scale** — almost certainly non-human traffic
- **China/Singapore with 0% engagement** — consistent signal of bot/crawler traffic across multiple sites in this network. Exclude from performance assessments. See [Traffic Quality Focus](../methodology/what-we-measure.md).
- **Organic sessions declining while total sessions hold** — often masks bot inflation. Track organic separately.
- **New users % dropping** — audience is returning but not growing; content is retaining but not acquiring

## API Access

- **Package:** `@google-analytics/data` npm package — use `BetaAnalyticsDataClient`
- **Auth:** Google Service Account JSON at path defined in `instance.json > credentials.paths.google_service_account` (base: `/workspace/extra/`)
- **Do NOT use** `google.analyticsdata` from the `googleapis` package for report queries — it has a different parameter serialisation that causes errors

```javascript
const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const analyticsClient = new BetaAnalyticsDataClient({ keyFilename: KEY_FILE });

const [res] = await analyticsClient.runReport({
  property: `properties/${site.ga4_property_id}`,
  dateRanges: [{ startDate: '2026-04-01', endDate: '2026-04-07' }],
  metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'engagementRate' }],
  dimensions: [{ name: 'country' }]  // optional
});
```

### Organic Sessions Filter

To isolate organic search traffic only:
```javascript
const [res] = await analyticsClient.runReport({
  property: `properties/${propertyId}`,
  dateRanges: [{ startDate: date, endDate: date }],
  dimensions: [{ name: 'sessionDefaultChannelGroup' }],
  metrics: [{ name: 'sessions' }]
});
const organicRow = res.rows?.find(r => r.dimensionValues[0].value === 'Organic Search');
```

## Property IDs

Read from `instance.json > sites[].ga4_property_id`. Current properties:

| Site | GA4 Property ID | Platform | History Available |
|------|----------------|----------|------------------|
| Launch Point Golf | 312678946 | Ghost | Apr 2025 |
| The Birthday Best | 344358315 | WordPress | Apr 2025 |
| Indoor Cycling Tips | 308545423 | WordPress | Apr 2025 |
| Aquasoul | 363708372 | WordPress | Apr 2025 |
| Soul Sensa | 363757463 | WordPress | Jan 2026 |
| The Gaming Man | 250046443 | WordPress | Jan 2026 |
| Inquisitive Wonder | 344351364 | WordPress | Jan 2026 |
| Safe To Play | 354504707 | WordPress | Apr 2025 |
| Skate News Wire | 308119473 | WordPress | Jan 2026 |

## High-Value Markets

Adam has confirmed we optimise exclusively for traffic from: **United States, United Kingdom, Australia, Canada**. When reporting on traffic performance, always segment by these markets. Total sessions figures are secondary. See [Traffic Quality Focus](../methodology/what-we-measure.md).

## npm Packages

Install in `/tmp` at start of each session (packages do not persist):
```bash
cd /tmp && npm install @google-analytics/data google-auth-library
```

## Related Pages

- [Google Search Console](google-search-console.md) — pre-click search performance
- [Ghost Admin API](ghost-admin-api.md) — member and email data for Ghost sites
- [What We Measure](../methodology/what-we-measure.md) — how GA4 fits into reporting
- [Alert Thresholds](../methodology/alert-thresholds.md) — when GA4 changes trigger alerts
- [Performance Baselines](../sites/performance-baselines.md) — site benchmarks
