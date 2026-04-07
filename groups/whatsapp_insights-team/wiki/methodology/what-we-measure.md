---
title: What We Measure and Why
tags: [methodology, metrics, reporting]
updated: 2026-04-07
---

# What We Measure and Why

## Guiding Principle

We measure what's actionable for the content team and what's directly tied to traffic growth and monetisation in high-value markets. Total sessions is a vanity metric — it can be inflated by bots. We lead with quality signals in the right markets.

**High-value markets (HV):** United States, United Kingdom, Australia, Canada. All performance assessments prioritise these four markets. See [Traffic Quality Focus](#traffic-quality-focus) below.

---

## Core Metrics by Category

### Traffic Volume
| Metric | Source | Why We Track It |
|--------|--------|----------------|
| HV Sessions (US/UK/AU/CA) | GA4 | Primary traffic measure — excludes bot markets |
| Organic Sessions | GA4 | Isolates the channel we're optimising (search) |
| Total Sessions | GA4 | Secondary — context only; can be bot-inflated |
| New Users | GA4 | Audience acquisition signal |

### Traffic Quality
| Metric | Source | Why We Track It |
|--------|--------|----------------|
| Engagement Rate | GA4 | Quality filter — sessions >10s, 2+ pages, or conversion |
| Avg Session Duration | GA4 | Content depth signal; low duration = thin content or wrong audience |
| % Mobile Sessions | GA4 | UX context; affects ad RPM and content formatting decisions |

### Search Visibility
| Metric | Source | Why We Track It |
|--------|--------|----------------|
| GSC Clicks | GSC | Organic traffic actually delivered |
| GSC Impressions | GSC | Search visibility breadth |
| GSC CTR | GSC | Title/meta effectiveness at converting rankings to clicks |
| GSC Avg Position | GSC | Overall ranking quality |
| Ranking Keywords | GSC | Count of queries with impressions — content breadth signal |
| Search Visibility Score (SVS) | Derived (GSC) | Single index for cross-site comparison — see below |

### Content Performance
| Metric | Source | Why We Track It |
|--------|--------|----------------|
| Top 3 Landing Pages | GA4 | Which content drives entry — informs what to double down on |
| Top 5 GSC URLs | GSC | Which pages are ranking and getting clicks |
| Page-level CTR gaps | GSC | Pages with high impressions but low CTR = title optimisation opportunity |

### Audience (Ghost sites only)
| Metric | Source | Why We Track It |
|--------|--------|----------------|
| Total Members | Ghost | Audience size for newsletter/membership model |
| New Members Today/Week | Ghost | Growth momentum |
| Email Open Rate | Ghost | List health and content resonance |
| Email Click Rate | Ghost | Deeper engagement; intent signal |

---

## Search Visibility Score (SVS)

A composite 0–100 index derived from GSC data, updated weekly. Allows cross-site comparison regardless of traffic volume.

**Formula (3 components):**
- **Position Quality (40%):** Impression-weighted average position, scaled so position 1 = 100 and position 50 ≈ 2
- **Ranking Breadth (30%):** Log-scaled count of ranking keywords (queries with ≥1 impression), where 1,000 keywords = 100
- **CTR Efficiency (30%):** Actual CTR divided by expected CTR for that average position — above 1.0 means titles punch above their weight

Week 1 SVS baseline (Mar 30–Apr 6, 2026): The Birthday Best (70), Soul Sensa (64), Skate News Wire (62), Launch Point Golf (53), Indoor Cycling Tips (20), The Gaming Man (16), Aquasoul (5), Inquisitive Wonder (0), Safe To Play (0).

---

## How We Define Success by Site Type

### WordPress Content Sites (Birthday Best, Indoor Cycling Tips, Aquasoul, etc.)
Success = growing organic HV traffic with improving engagement
- Primary KPI: HV sessions MoM growth
- Secondary KPIs: Organic sessions, SVS improvement, top landing page diversification
- Monetisation signal: US/UK/CA traffic share; engagement rate in target markets

### Ghost Membership Site (Launch Point Golf)
Success = growing engaged US/UK/AU audience converting to members
- Primary KPI: Member count growth rate + email open rate
- Secondary KPIs: HV sessions, engagement rate per visit (high intent per visit matters more than volume)
- Each US visitor is worth more than 10 passive readers — quality trumps quantity here

---

## Traffic Quality Focus

Adam has confirmed (2026-04-06): **optimise exclusively for US/UK/AU/CA traffic.** Do not treat the following as positive signals:
- China/Singapore with 0–3% engagement and <2s session duration — consistent bot/click farm pattern across multiple sites
- Ireland traffic with <1s duration and >95% bounce — bot pattern identified on Skate News Wire
- Any traffic source where engagement rate is below 5% at scale

When reporting, always separate "real HV traffic" from "total sessions". If a site shows 500 sessions/month but 350 are from bot markets, report it as ~150 real sessions.

---

## Reporting Cadence

### Daily (3am automated)
- Data pull: append yesterday's GA4/GSC/Ghost row to Google Sheet
- No message to Adam unless pull fails

### Daily (8am, weekdays)
- Derek reviews data for significant changes
- Message Adam only if alert thresholds are crossed (see [Alert Thresholds](alert-thresholds.md))
- "Nothing to report" silence is the norm — don't send status updates for their own sake

### Weekly (Friday 4pm)
- Full performance digest to Adam and Raeleen
- Lead with what changed and what's actionable — not raw numbers
- Include: MoM traffic trend per site, SVS movement, top content movers, Ghost member update (LPG)
- Flag anything that needs Content Team attention

### Monthly
- Deeper benchmarking: site vs site, MoM trends, content ROI by article type
- Identify keyword opportunities (high impressions, low CTR)
- Update performance baselines page

---

## What We Don't Track (Yet)

- **Revenue/conversions:** No affiliate tracking events in GA4 currently. Worth adding outbound click events if Birthday Best has affiliate links.
- **Device detail beyond mobile%:** Not actionable at current traffic volumes for most sites.
- **Social traffic detail:** No active social strategy — revisit if launched.
- **Google Ads:** Future capability when campaigns run.

---

## Related Pages

- [Alert Thresholds](alert-thresholds.md)
- [Performance Baselines](../sites/performance-baselines.md)
- [Google Analytics (GA4)](../data-sources/google-analytics-ga4.md)
- [Google Search Console](../data-sources/google-search-console.md)
- [Ghost Admin API](../data-sources/ghost-admin-api.md)
