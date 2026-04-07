---
title: Alert Thresholds
tags: [methodology, alerts, monitoring]
updated: 2026-04-07
---

# Alert Thresholds

When a threshold is crossed, send a brief message to Adam via `send_message`. Lead with what happened and why it might matter — not just the number.

**Default stance: stay silent.** Only message when something is genuinely actionable. A "nothing to report" message every day is noise that trains Adam to ignore Insights alerts.

---

## Traffic Alerts

### Threshold: Traffic drop >30% day-over-day (HV sessions)
**Applies to:** Sites with ≥50 daily HV sessions (currently: Birthday Best, Skate News Wire)
**Why this number:** Below 30%, normal variance (weekend effects, seasonal fluctuation) will cause false positives. Above 30% is statistically unusual for established traffic patterns.
**Caveat:** Don't alert on a single day. If a site drops 35% on Saturday vs Friday, check Sunday before alerting — it may be a weekend pattern, not a problem.
**What to include in alert:** Affected site, % change, which source (organic vs direct vs all), whether GSC impressions also dropped (ranking issue) or held (on-site/CTR issue).

### Threshold: Traffic spike >50% day-over-day (HV sessions)
**Applies to:** All sites
**Why this number:** Spikes are usually good news (viral content, backlink, social mention) but can also indicate tracking anomalies or spam bursts. 50% is the floor for "something unusual happened worth knowing."
**What to include in alert:** Affected site, % change, source of spike (organic? referral? direct?), top landing page for the day.

### Threshold: Monthly HV sessions decline >20% MoM
**Applies to:** All sites
**Why this number:** Day-to-day is noisy. Month-over-month >20% is a sustained trend, not variance. Compounds quickly — two months of 20% decline = 36% total loss.
**Exception:** New sites with <100 sessions/month are too volatile for this threshold — flag manually if pattern looks concerning.

---

## Ranking Alerts

### Threshold: GSC average position drops >5 positions week-over-week
**Applies to:** All sites
**Why this number:** A 1–2 position fluctuation is normal. A 5-position drop often signals a Google algorithm update, a competitor publishing competing content, or content decay on a high-traffic page.
**Caveat:** Average position can be skewed by new impressions at lower positions. Check if the drop is site-wide or concentrated on specific pages. Page-level drops are more actionable.
**What to include in alert:** Site, position before/after, whether site-wide or page-specific, any known external context (recent Google updates?).

### Threshold: High-value page drops out of top 20
**Applies to:** Pages currently ranking positions 1–20 with ≥100 weekly impressions
**Why this number:** Position 20 is roughly the last slot with meaningful click-through. Dropping below 20 often means near-zero clicks even with high impressions.
**What to include:** Page URL, previous position, new position, impressions before/after.

---

## Ghost / Email Alerts (Launch Point Golf only)

### Threshold: Email open rate drops below 30% for two consecutive sends
**Why this number:** Ghost's average open rate is ~45%. A single email at 30% may be an off-topic send. Two consecutive sends below 30% indicates list health deterioration or content-audience mismatch.
**What to include:** Open rates for last 2 sends, subject lines, any changes to send time or list targeting.

### Threshold: Member growth stalls for 3+ consecutive weeks (0 new members)
**Why this number:** Zero growth for one week could be a slow week. Three consecutive weeks of zero is a structural problem — either no traffic reaching the signup flow or the offer isn't compelling.
**What to include:** Member count at start and end of stall period, HV traffic trend during same period (to separate traffic problem from conversion problem).

### Threshold: Member churn spike (>10 cancellations in a week)
**Applies to:** When paid membership is active (not yet — LPG has 0 members as of Apr 2026)
**Why this number:** Meaningful churn event vs normal attrition.

---

## Data Quality Alerts

### Threshold: API pull fails for 2+ consecutive days
**Why:** A single-day failure may be transient. Two days means data gaps are forming in the sheet.
**What to do:** Check the error, fix the cause, alert Adam with what data is missing and the recovery plan.

### Threshold: Engagement rate drops to <5% across a whole site
**Why:** This indicates a likely bot traffic event, not a content problem. At <5% engagement, the "traffic" figures are meaningless and should not be reported as performance.
**What to include:** Site, date, engagement rate, which country is driving the low-engagement sessions.

---

## Thresholds We Deliberately Don't Have

**"No data to report" message:** We never send this. Silence means everything is normal.

**Alerts for low-traffic sites:** Sites with <50 HV sessions/day are too volatile for percentage-based alerts. Normal variance will constantly cross thresholds. Monitor manually in the weekly digest instead.

**Bot traffic alerts:** We document bot patterns in reports but don't alert in real-time. Bots don't constitute an actionable emergency — they're a persistent background noise issue handled by filtering in reporting.

---

## Related Pages

- [What We Measure](what-we-measure.md)
- [Performance Baselines](../sites/performance-baselines.md)
- [Google Analytics (GA4)](../data-sources/google-analytics-ga4.md)
- [Google Search Console](../data-sources/google-search-console.md)
