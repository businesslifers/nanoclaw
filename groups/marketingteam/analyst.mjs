/**
 * Analyst Agent
 * Reads raw collected data, applies analysis rules, produces structured analysis JSON.
 * Triggered by the Collector Agent. Output consumed by the Reporter Agent.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

// ─── Config ───────────────────────────────────────────────────────────────────

const DATA_DIR = '/workspace/agent/data';
const LOG_FILE = `${DATA_DIR}/analyst.log`;

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try {
    const existing = existsSync(LOG_FILE) ? readFileSync(LOG_FILE, 'utf8') : '';
    writeFileSync(LOG_FILE, existing + line + '\n');
  } catch (_) {}
}

// ─── Date Helpers ─────────────────────────────────────────────────────────────

function daysBetween(startStr, endStr) {
  const msPerDay = 86400000;
  return Math.round((new Date(endStr) - new Date(startStr)) / msPerDay) + 1;
}

function datesBefore(dateStr, n) {
  // Return n date strings before dateStr (exclusive), newest first
  const dates = [];
  const d = new Date(dateStr);
  for (let i = 1; i <= n; i++) {
    const prev = new Date(d);
    prev.setDate(prev.getDate() - i);
    const pad = x => String(x).padStart(2, '0');
    dates.push(`${prev.getFullYear()}-${pad(prev.getMonth() + 1)}-${pad(prev.getDate())}`);
  }
  return dates;
}

function fmt2(n) { return parseFloat(Number(n).toFixed(2)); }
function fmtPct(n) { return Math.round(Number(n) * 100); }

// ─── Conversion Action Classification ────────────────────────────────────────

function classifyAction(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('calls from') || n.match(/^calls from (ads|smart)/)) return 'call_native';
  if (n.includes('submit')) return 'form_submit';
  if (n.includes('form') && (n.includes('view') || n.includes('load'))) return 'form_view';
  if (n.includes('phone') || n.includes('call')) return 'call_website';
  if (n.includes('email')) return 'email_click';
  if (n.includes('purchase') || n.includes('buy') || n.includes('checkout')) return 'purchase';
  return 'other';
}

// ─── History Loading ──────────────────────────────────────────────────────────

function loadHistory(clientId, runDate, maxDays = 7) {
  const prevDates = datesBefore(runDate, maxDays);
  const history = []; // [ { date, campaigns: { id -> { spend, clicks, ... } } } ]

  for (const date of prevDates) {
    const path = `${DATA_DIR}/raw/${date}/${clientId}.json`;
    if (!existsSync(path)) continue;
    try {
      const data = JSON.parse(readFileSync(path, 'utf8'));
      const campaigns = {};
      for (const c of (data.googleAds?.campaigns || [])) {
        const primaryConversions = (c.yesterday?.conversionActions || [])
          .filter(a => a.category === 'primary')
          .reduce((s, a) => s + (a.count || 0), 0);
        campaigns[c.id] = {
          status: c.status,
          spend: c.yesterday?.spend || 0,
          impressions: c.yesterday?.impressions || 0,
          clicks: c.yesterday?.clicks || 0,
          ctr: c.yesterday?.ctr || 0,
          avgCpc: c.yesterday?.avgCpc || 0,
          conversionRate: c.yesterday?.conversionRate || 0,
          conversions: primaryConversions,
          searchImprShare: c.yesterday?.searchImprShare || 0,
        };
      }
      history.push({ date, campaigns });
    } catch (err) {
      log(`  [history] Could not read ${path}: ${err.message}`);
    }
  }
  return history; // sorted newest first
}

// ─── Rolling Average ──────────────────────────────────────────────────────────

function rollingAvg(history, campaignId) {
  const vals = history
    .map(h => h.campaigns[campaignId])
    .filter(Boolean);

  if (vals.length === 0) return null;

  const avg = field => vals.reduce((s, v) => s + (v[field] || 0), 0) / vals.length;
  return {
    days: vals.length,
    spend: avg('spend'),
    impressions: avg('impressions'),
    clicks: avg('clicks'),
    ctr: avg('ctr'),
    avgCpc: avg('avgCpc'),
    conversionRate: avg('conversionRate'),
    conversions: avg('conversions'),
    searchImprShare: avg('searchImprShare'),
  };
}

// ─── Primary Conversions Extractor ───────────────────────────────────────────

function primaryConversions(conversionActions) {
  return (conversionActions || [])
    .filter(a => a.category === 'primary')
    .reduce((s, a) => s + (a.count || 0), 0);
}

// ─── Flag Builders ────────────────────────────────────────────────────────────

function flag(severity, scope, campaign, metric, detail, recommendedAction = null) {
  return {
    severity,
    scope,
    campaignId: campaign?.id || null,
    campaignName: campaign?.name || null,
    metric,
    detail,
    recommendedAction,
  };
}

// ─── Campaign-Level Analysis ──────────────────────────────────────────────────

function analyzeCampaign(campaign, history, clientName) {
  const flags = [];
  const yd = campaign.yesterday;
  const avg = rollingAvg(history, campaign.id);
  const historyNote = avg ? (avg.days < 3 ? ` (limited history — ${avg.days} day${avg.days === 1 ? '' : 's'} available)` : '') : '';

  const ydConversions = primaryConversions(yd.conversionActions);

  // ── Critical: unexpected pause ────────────────────────────────────────────
  if (campaign.status === 'PAUSED' || campaign.status === 'REMOVED') {
    const wasEnabled = history.some(h => h.campaigns[campaign.id]?.status === 'ENABLED');
    if (wasEnabled) {
      const lastEnabled = history.find(h => h.campaigns[campaign.id]?.status === 'ENABLED')?.date || 'recently';
      flags.push(flag('critical', 'campaign', campaign,
        'campaign_paused',
        `'${campaign.name}' is now ${campaign.status.toLowerCase()} — it was enabled as recently as ${lastEnabled}.`,
        'Confirm whether this pause was intentional. If not, re-enable the campaign immediately.'
      ));
    }
    return flags; // no further analysis on paused/removed campaigns
  }

  // ── Critical: all ads disapproved ─────────────────────────────────────────
  const disapproved = campaign.disapprovedAds || [];
  const totalAds = (campaign.ads || []).length;
  if (disapproved.length > 0 && totalAds > 0 && disapproved.length >= totalAds) {
    const topics = [...new Set(disapproved.flatMap(a => a.policyTopics?.map(p => p.topic) || []))].filter(Boolean);
    const topicStr = topics.length > 0 ? ` (${topics.slice(0, 3).join(', ')})` : '';
    flags.push(flag('critical', 'campaign', campaign,
      'ads_disapproved',
      `All ${disapproved.length} ad${disapproved.length > 1 ? 's' : ''} in '${campaign.name}' are disapproved${topicStr}. Campaign is effectively not serving.`,
      'Check destination URLs and ad content for policy violations.'
    ));
  }

  // ── Budget exhausted with high lost IS ───────────────────────────────────
  // Default: warning (client budget constraint — not Mettro-actionable on its own).
  // Escalate to critical only when performance is improving and budget is the limiting factor —
  // i.e. there is a genuine case to put to the client for a budget increase.
  if (campaign.dailyBudget > 0 && yd.spend >= campaign.dailyBudget * 0.98 && yd.lostISBudget > 0.25) {
    const ydCpa = ydConversions > 0 ? yd.spend / ydConversions : null;
    const avgCpa = avg && avg.conversions > 0 ? avg.spend / avg.conversions : null;
    const cpaImproving = ydCpa !== null && avgCpa !== null && (avgCpa - ydCpa) / avgCpa >= 0.10;
    const crImproving = avg && avg.conversionRate > 0 && yd.conversionRate > 0 &&
      (yd.conversionRate - avg.conversionRate) / avg.conversionRate >= 0.10;
    const hasConversions = avg && avg.conversions >= 1;
    const performanceStrong = hasConversions && (cpaImproving || crImproving);

    if (performanceStrong) {
      const perfNote = cpaImproving
        ? `CPA improved to $${fmt2(ydCpa)} vs $${fmt2(avgCpa)} avg`
        : `conversion rate improved to ${(yd.conversionRate * 100).toFixed(1)}% vs ${(avg.conversionRate * 100).toFixed(1)}% avg`;
      flags.push(flag('critical', 'campaign', campaign,
        'budget_exhausted',
        `'${campaign.name}' spent $${fmt2(yd.spend)} of its $${fmt2(campaign.dailyBudget)}/day budget and lost ${fmtPct(yd.lostISBudget)}% IS to budget — but performance is improving (${perfNote}).`,
        `Budget is capping a well-performing campaign. Strong case to present to the client for a budget increase.`
      ));
    } else {
      flags.push(flag('warning', 'campaign', campaign,
        'budget_exhausted',
        `'${campaign.name}' spent $${fmt2(yd.spend)} of its $${fmt2(campaign.dailyBudget)}/day budget and lost ${fmtPct(yd.lostISBudget)}% IS to budget — client budget constraint.`,
        `No action needed unless performance improves. Monitor CPA/conversion rate for a budget increase case.`
      ));
    }
  }

  // ── Warning: disapproved ads (not all) ───────────────────────────────────
  if (disapproved.length > 0 && disapproved.length < totalAds) {
    const topics = [...new Set(disapproved.flatMap(a => a.policyTopics?.map(p => p.topic) || []))].filter(Boolean);
    const topicStr = topics.length > 0 ? ` (${topics.slice(0, 3).join(', ')})` : '';
    flags.push(flag('warning', 'campaign', campaign,
      'ads_disapproved_partial',
      `${disapproved.length} ad${disapproved.length > 1 ? 's' : ''} in '${campaign.name}' ${disapproved.length > 1 ? 'are' : 'is'} disapproved${topicStr}.`,
      'Review and fix affected ads to restore full delivery.'
    ));
  }

  // ── Baseline-dependent flags ──────────────────────────────────────────────
  if (avg && avg.days >= 1) {

    // Warning: spend deviation >20%
    if (avg.spend > 0) {
      const deviation = (yd.spend - avg.spend) / avg.spend;
      if (Math.abs(deviation) > 0.20 && (yd.spend > 1 || avg.spend > 1)) {
        const dir = deviation > 0 ? 'above' : 'below';
        const pct = Math.abs(fmtPct(deviation));
        flags.push(flag('warning', 'campaign', campaign,
          'spend_deviation',
          `'${campaign.name}' spent $${fmt2(yd.spend)} yesterday — ${pct}% ${dir} its ${avg.days}-day average of $${fmt2(avg.spend)} (budget: $${fmt2(campaign.dailyBudget)}/day)${historyNote}.`,
          dir === 'below'
            ? 'Check for impression share losses or targeting restrictions limiting delivery.'
            : 'Review for unusual activity — check search term report for irrelevant traffic.'
        ));
      }
    }

    // Warning: CPC spike >25%
    if (avg.avgCpc > 0 && yd.avgCpc > 0) {
      const cpcChange = (yd.avgCpc - avg.avgCpc) / avg.avgCpc;
      if (cpcChange > 0.25) {
        flags.push(flag('warning', 'campaign', campaign,
          'cpc_spike',
          `'${campaign.name}' avg CPC was $${fmt2(yd.avgCpc)} yesterday — ${fmtPct(cpcChange)}% above its ${avg.days}-day average of $${fmt2(avg.avgCpc)}${historyNote}.`,
          'Check auction insights and search term report for increased competition or broad match expansion.'
        ));
      }
    }

    // Warning: conversion rate drop >25%
    if (avg.conversionRate > 0 && yd.conversionRate >= 0) {
      const crDrop = (avg.conversionRate - yd.conversionRate) / avg.conversionRate;
      if (crDrop > 0.25 && avg.conversions > 0.5) {
        flags.push(flag('warning', 'campaign', campaign,
          'conversion_rate_drop',
          `'${campaign.name}' conversion rate was ${(yd.conversionRate * 100).toFixed(1)}% yesterday — ${fmtPct(crDrop)}% below its ${avg.days}-day average of ${(avg.conversionRate * 100).toFixed(1)}%${historyNote}.`,
          'Check landing page for issues and review recent search term changes.'
        ));
      }
    }

    // Positive: conversion uptick >20%
    if (avg.conversions > 0.5 && ydConversions > avg.conversions * 1.20) {
      const pct = fmtPct((ydConversions - avg.conversions) / avg.conversions);
      flags.push(flag('positive', 'campaign', campaign,
        'conversion_uptick',
        `'${campaign.name}' recorded ${fmt2(ydConversions)} conversion${ydConversions !== 1 ? 's' : ''} yesterday — ${pct}% above its ${avg.days}-day average of ${fmt2(avg.conversions)}${historyNote}.`,
        null
      ));
    }

    // Positive: CPC efficiency improvement >15%
    if (avg.avgCpc > 0 && yd.avgCpc > 0) {
      const cpcImprovement = (avg.avgCpc - yd.avgCpc) / avg.avgCpc;
      if (cpcImprovement > 0.15 && yd.clicks > 5) {
        flags.push(flag('positive', 'campaign', campaign,
          'cpc_efficiency',
          `'${campaign.name}' avg CPC was $${fmt2(yd.avgCpc)} yesterday — ${fmtPct(cpcImprovement)}% more efficient than its ${avg.days}-day average of $${fmt2(avg.avgCpc)}${historyNote}.`,
          null
        ));
      }
    }
  }

  // Warning: lost IS budget >15% (skip if budget_exhausted critical already covers this)
  const alreadyFlaggedExhausted = flags.some(f => f.metric === 'budget_exhausted');
  if (yd.lostISBudget > 0.15 && campaign.type !== 'PERFORMANCE_MAX' && !alreadyFlaggedExhausted) {
    flags.push(flag('warning', 'campaign', campaign,
      'lost_is_budget',
      `'${campaign.name}' lost ${fmtPct(yd.lostISBudget)}% impression share to budget yesterday — campaign is underfunded.`,
      'Consider increasing the daily budget or tightening targeting to reduce wasted spend.'
    ));
  }

  // Warning: total lost IS >35% (budget + rank combined)
  if ((yd.lostISBudget + yd.lostISRank) > 0.35 && campaign.type !== 'PERFORMANCE_MAX') {
    const total = fmtPct(yd.lostISBudget + yd.lostISRank);
    const alreadyFlagged = flags.some(f => f.metric === 'lost_is_budget' || f.metric === 'budget_exhausted');
    if (!alreadyFlagged) {
      flags.push(flag('warning', 'campaign', campaign,
        'lost_is_combined',
        `'${campaign.name}' lost ${total}% total impression share yesterday (${fmtPct(yd.lostISBudget)}% budget, ${fmtPct(yd.lostISRank)}% rank).`,
        'Review budget and bidding strategy — significant auction visibility being lost.'
      ));
    }
  }

  return flags;
}

// ─── Account-Level Analysis ───────────────────────────────────────────────────

function buildAccountSummary(data, periods) {
  const campaigns = data.googleAds?.campaigns || [];
  const enabledCampaigns = campaigns.filter(c => c.status === 'ENABLED');

  // ── Yesterday totals ──────────────────────────────────────────────────────
  const ydSpend = campaigns.reduce((s, c) => s + (c.yesterday?.spend || 0), 0);
  const ydBudget = enabledCampaigns.reduce((s, c) => s + (c.dailyBudget || 0), 0);
  const ydImpressions = campaigns.reduce((s, c) => s + (c.yesterday?.impressions || 0), 0);
  const ydClicks = campaigns.reduce((s, c) => s + (c.yesterday?.clicks || 0), 0);
  const ydConversions = campaigns.reduce((s, c) => s + primaryConversions(c.yesterday?.conversionActions), 0);

  // Weighted impression share (search campaigns only)
  const searchCampaigns = campaigns.filter(c => c.type === 'SEARCH' && c.yesterday?.impressions > 0);
  const totalSearchImpr = searchCampaigns.reduce((s, c) => s + c.yesterday.impressions, 0);
  const wtdIS = totalSearchImpr > 0
    ? searchCampaigns.reduce((s, c) => s + c.yesterday.searchImprShare * c.yesterday.impressions, 0) / totalSearchImpr
    : null;
  const wtdLostBudget = totalSearchImpr > 0
    ? searchCampaigns.reduce((s, c) => s + c.yesterday.lostISBudget * c.yesterday.impressions, 0) / totalSearchImpr
    : null;
  const wtdLostRank = totalSearchImpr > 0
    ? searchCampaigns.reduce((s, c) => s + c.yesterday.lostISRank * c.yesterday.impressions, 0) / totalSearchImpr
    : null;

  // ── MTD totals ────────────────────────────────────────────────────────────
  const mtdSpend = campaigns.reduce((s, c) => s + (c.currentMonthToDate?.spend || 0), 0);
  const mtdConversions = campaigns.reduce((s, c) => s + primaryConversions(c.currentMonthToDate?.conversionActions), 0);
  const mtdDays = daysBetween(periods.currentMonthToDate.start, periods.currentMonthToDate.end);
  const mtdDailyAvgSpend = mtdDays > 0 ? mtdSpend / mtdDays : 0;
  const mtdDailyAvgConversions = mtdDays > 0 ? mtdConversions / mtdDays : 0;

  // ── Previous month totals ─────────────────────────────────────────────────
  const prevSpend = campaigns.reduce((s, c) => s + (c.previousMonth?.spend || 0), 0);
  const prevConversions = campaigns.reduce((s, c) => s + primaryConversions(c.previousMonth?.conversionActions), 0);
  const prevDays = daysBetween(periods.previousMonth.start, periods.previousMonth.end);
  const prevDailyAvgSpend = prevDays > 0 ? prevSpend / prevDays : 0;
  const prevDailyAvgConversions = prevDays > 0 ? prevConversions / prevDays : 0;

  const momSpendChange = prevDailyAvgSpend > 0 ? (mtdDailyAvgSpend - prevDailyAvgSpend) / prevDailyAvgSpend : null;
  const momConversionChange = prevDailyAvgConversions > 0 ? (mtdDailyAvgConversions - prevDailyAvgConversions) / prevDailyAvgConversions : null;

  // ── Previous month IS ──────────────────────────────────────────────────────
  const prevSearchCampaigns = campaigns.filter(c => c.type === 'SEARCH' && c.previousMonth?.impressions > 0);
  const prevTotalImpr = prevSearchCampaigns.reduce((s, c) => s + c.previousMonth.impressions, 0);
  const prevAvgIS = prevTotalImpr > 0
    ? prevSearchCampaigns.reduce((s, c) => s + c.previousMonth.searchImprShare * c.previousMonth.impressions, 0) / prevTotalImpr
    : null;

  // ── GA4 yesterday ─────────────────────────────────────────────────────────
  const ga4Yd = data.googleAnalytics?.yesterday;
  const paidSessions = (ga4Yd?.trafficSources || [])
    .filter(s => s.source === 'google' && s.medium === 'cpc')
    .reduce((s, t) => s + t.sessions, 0);
  const trackingHealthy = ydClicks > 0
    ? (paidSessions / ydClicks) >= 0.65
    : true;

  // ── Contact engagement (MTD from GA4 contactEvents) ───────────────────────
  const mtdContactEvents = data.googleAnalytics?.currentMonthToDate?.contactEvents || [];

  let formViews = 0, formSubmissions = 0, phoneClicks = 0, emailClicks = 0, nativeCallConversions = 0;
  let paidFormViews = 0, paidFormSubmissions = 0, paidPhoneClicks = 0;

  for (const evt of mtdContactEvents) {
    const cls = classifyAction(evt.eventName);
    const isPaid = evt.campaign && evt.campaign !== '(not set)' && evt.campaign !== '';
    const count = evt.count || 0;

    if (cls === 'form_view') { formViews += count; if (isPaid) paidFormViews += count; }
    if (cls === 'form_submit') { formSubmissions += count; if (isPaid) paidFormSubmissions += count; }
    if (cls === 'call_website') { phoneClicks += count; if (isPaid) paidPhoneClicks += count; }
    if (cls === 'email_click') { emailClicks += count; }
    if (cls === 'call_native') { nativeCallConversions += count; }
  }

  // Also pick up native call conversions from Ads data
  for (const c of campaigns) {
    for (const action of (c.currentMonthToDate?.conversionActions || [])) {
      if (classifyAction(action.name) === 'call_native') {
        nativeCallConversions += action.count || 0;
      }
    }
  }

  return {
    yesterday: {
      totalSpend: fmt2(ydSpend),
      totalBudget: fmt2(ydBudget),
      budgetUtilisation: ydBudget > 0 ? fmt2(ydSpend / ydBudget) : null,
      totalImpressions: ydImpressions,
      totalClicks: ydClicks,
      totalConversions: fmt2(ydConversions),
      avgCtr: ydImpressions > 0 ? parseFloat((ydClicks / ydImpressions).toFixed(4)) : 0,
      avgCpc: ydClicks > 0 ? fmt2(ydSpend / ydClicks) : 0,
      searchImprShare: wtdIS !== null ? parseFloat(wtdIS.toFixed(4)) : null,
      lostISBudget: wtdLostBudget !== null ? parseFloat(wtdLostBudget.toFixed(4)) : null,
      lostISRank: wtdLostRank !== null ? parseFloat(wtdLostRank.toFixed(4)) : null,
    },
    currentMonthToDate: {
      totalSpend: fmt2(mtdSpend),
      totalConversions: fmt2(mtdConversions),
      dailyAvgSpend: fmt2(mtdDailyAvgSpend),
      dailyAvgConversions: fmt2(mtdDailyAvgConversions),
    },
    previousMonth: {
      totalSpend: fmt2(prevSpend),
      totalConversions: fmt2(prevConversions),
      dailyAvgSpend: fmt2(prevDailyAvgSpend),
      dailyAvgConversions: fmt2(prevDailyAvgConversions),
    },
    momSpendChange: momSpendChange !== null ? parseFloat(momSpendChange.toFixed(4)) : null,
    momConversionChange: momConversionChange !== null ? parseFloat(momConversionChange.toFixed(4)) : null,
    prevMonthAvgIS: prevAvgIS !== null ? parseFloat(prevAvgIS.toFixed(4)) : null,
    contactEngagement: {
      source: 'ga4_mtd',
      formViews, formSubmissions,
      formSubmissionRate: formViews > 0 ? parseFloat((formSubmissions / formViews).toFixed(4)) : 0,
      phoneClicks, emailClicks, nativeCallConversions,
      paidFormViews, paidFormSubmissions, paidPhoneClicks,
    },
    ga4: {
      yesterday: {
        totalSessions: ga4Yd?.sessions || 0,
        paidSessions,
        engagementRate: ga4Yd?.engagementRate || 0,
        bounceRate: ga4Yd?.bounceRate || 0,
        avgSessionDuration: ga4Yd?.avgSessionDuration || 0,
      },
    },
    trackingHealthy,
  };
}

function analyzeAccount(data, summary, periods, history, clientName) {
  const flags = [];
  const campaigns = data.googleAds?.campaigns || [];
  const enabledCampaigns = campaigns.filter(c => c.status === 'ENABLED');

  // ── Critical: all campaigns paused/removed with no history of this ────────
  const activeCampaigns = campaigns.filter(c => c.status !== 'REMOVED');
  if (activeCampaigns.length > 0 && enabledCampaigns.length === 0) {
    const hadEnabled = history.some(h => Object.values(h.campaigns).some(c => c.status === 'ENABLED'));
    if (hadEnabled) {
      flags.push(flag('critical', 'account', null,
        'all_campaigns_paused',
        `All ${activeCampaigns.length} campaign${activeCampaigns.length > 1 ? 's' : ''} for ${clientName} are paused — this account has no active serving campaigns.`,
        'Check the Google Ads account immediately — verify this was intentional.'
      ));
    }
  }

  // ── Warning: MTD spend pace vs previous month ─────────────────────────────
  const { currentMonthToDate: mtd, previousMonth: prev, momSpendChange } = summary;
  if (momSpendChange !== null && prev.dailyAvgSpend > 0) {
    if (Math.abs(momSpendChange) > 0.30) {
      const dir = momSpendChange > 0 ? 'above' : 'below';
      const pct = Math.abs(fmtPct(momSpendChange));
      flags.push(flag('warning', 'account', null,
        'mtd_spend_pace',
        `${clientName}'s MTD daily average spend is $${fmt2(mtd.dailyAvgSpend)} — ${pct}% ${dir} last month's daily average of $${fmt2(prev.dailyAvgSpend)}.`,
        dir === 'above'
          ? 'Review campaign budgets — spend is significantly ahead of prior month pace.'
          : 'Check for paused campaigns or targeting issues — spend is significantly behind prior month pace.'
      ));
    }
  }

  // ── Warning: MTD conversions trailing previous month ─────────────────────
  if (summary.momConversionChange !== null && prev.dailyAvgConversions > 0) {
    if (summary.momConversionChange < -0.30) {
      const pct = Math.abs(fmtPct(summary.momConversionChange));
      flags.push(flag('warning', 'account', null,
        'mtd_conversions_trailing',
        `${clientName}'s MTD daily average conversions is ${fmt2(mtd.dailyAvgConversions)} — ${pct}% below last month's daily average of ${fmt2(prev.dailyAvgConversions)}.`,
        'Review conversion tracking and campaign performance — conversion volume is significantly down on prior month.'
      ));
    }
  }

  // ── Warning: GA4 tracking gap ─────────────────────────────────────────────
  const { totalClicks } = summary.yesterday;
  const { paidSessions } = summary.ga4.yesterday;
  if (totalClicks > 10 && !summary.trackingHealthy) {
    const ratio = totalClicks > 0 ? Math.round((paidSessions / totalClicks) * 100) : 0;
    flags.push(flag('warning', 'account', null,
      'tracking_gap',
      `${clientName}'s GA4 recorded ${paidSessions} paid sessions yesterday against ${totalClicks} Ads clicks (${ratio}% match rate). Conversions may be undercounted.`,
      'Verify the Google tag is firing correctly on all pages and that GA4 is linked to the Ads account.'
    ));
  }

  // ── Warning: high bounce rate on paid traffic ─────────────────────────────
  if (summary.ga4.yesterday.bounceRate > 0.70 && paidSessions > 10) {
    const pct = fmtPct(summary.ga4.yesterday.bounceRate);
    flags.push(flag('warning', 'account', null,
      'high_bounce_rate',
      `${clientName}'s paid traffic had a ${pct}% bounce rate yesterday (${paidSessions} paid sessions). Landing page quality may be poor.`,
      'Review paid landing pages — check page speed, mobile experience, and message match with ad copy.'
    ));
  }

  // ── Warning: contact engagement gap ──────────────────────────────────────
  const { contactEngagement } = summary;
  if (contactEngagement.paidFormViews > 20 && contactEngagement.paidFormSubmissions === 0) {
    const phoneNote = contactEngagement.paidPhoneClicks > 0
      ? ` Users may be preferring to call (${contactEngagement.paidPhoneClicks} phone clicks from paid traffic).`
      : '';
    flags.push(flag('warning', 'account', null,
      'form_engagement_gap',
      `${contactEngagement.paidFormViews} contact form views from paid sessions this month but 0 submissions.${phoneNote}`,
      'Review the contact form for friction — consider reducing required fields or adding a more prominent call option.'
    ));
  }

  // ── Warning: zero contact conversions from paid traffic ──────────────────
  const totalPaidContact = contactEngagement.paidFormSubmissions + contactEngagement.paidPhoneClicks + contactEngagement.nativeCallConversions;
  if (totalPaidContact === 0 && summary.currentMonthToDate.totalSpend > 50 && summary.ga4.yesterday.paidSessions > 0) {
    const mtdPaidSessions = summary.ga4.yesterday.paidSessions; // proxy
    flags.push(flag('warning', 'account', null,
      'zero_contact_conversions',
      `No contact actions recorded from paid traffic this month for ${clientName} (${fmt2(mtd.totalSpend)} spent MTD). Check conversion tracking setup.`,
      'Verify GA4 events are firing on contact interactions and that the service account has Viewer access to the GA4 property.'
    ));
  }

  // ── Positive: MTD conversion growth >20% ──────────────────────────────────
  if (summary.momConversionChange !== null && summary.momConversionChange > 0.20 && prev.dailyAvgConversions > 0) {
    const pct = fmtPct(summary.momConversionChange);
    flags.push(flag('positive', 'account', null,
      'mtd_conversion_growth',
      `${clientName}'s MTD daily average conversions is ${fmt2(mtd.dailyAvgConversions)} — ${pct}% ahead of last month's daily average of ${fmt2(prev.dailyAvgConversions)}.`,
      null
    ));
  }

  // ── Positive: impression share gain >10pp vs previous month ───────────────
  const currIS = summary.yesterday.searchImprShare;
  const prevIS = summary.prevMonthAvgIS;
  if (currIS !== null && prevIS !== null && (currIS - prevIS) > 0.10) {
    const gainPp = Math.round((currIS - prevIS) * 100);
    flags.push(flag('positive', 'account', null,
      'impression_share_gain',
      `${clientName}'s search impression share yesterday was ${fmtPct(currIS)}% — ${gainPp} percentage points above last month's average of ${fmtPct(prevIS)}%.`,
      null
    ));
  }

  return flags;
}

// ─── Analyse One Client ───────────────────────────────────────────────────────

function analyseClient(client, runDate, statusPeriods) {
  const path = `${DATA_DIR}/raw/${runDate}/${client.clientId}.json`;
  if (!existsSync(path)) {
    return { clientId: client.clientId, clientName: client.clientName, dataAvailable: false, flags: [], summary: null };
  }

  const data = JSON.parse(readFileSync(path, 'utf8'));
  const periods = data.meta?.periods || statusPeriods;
  const history = loadHistory(client.clientId, runDate);

  log(`  Analysing ${client.clientName} (${data.googleAds?.campaigns?.length || 0} campaigns, ${history.length} days history)...`);

  const summary = buildAccountSummary(data, periods);
  const flags = [];

  // Campaign-level flags
  for (const campaign of (data.googleAds?.campaigns || [])) {
    flags.push(...analyzeCampaign(campaign, history, client.clientName));
  }

  // Account-level flags
  flags.push(...analyzeAccount(data, summary, periods, history, client.clientName));

  return {
    clientId: client.clientId,
    clientName: client.clientName,
    dataAvailable: true,
    flags,
    summary,
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  log('=== Analyst run started ===');

  // Load collector status
  const statusPath = `${DATA_DIR}/collector-status.json`;
  if (!existsSync(statusPath)) {
    log('ERROR: collector-status.json not found — cannot run analysis');
    process.exit(1);
  }
  const status = JSON.parse(readFileSync(statusPath, 'utf8'));

  if (status.status === 'failed') {
    log('Collector status is "failed" — all accounts failed, not running analysis');
    process.exit(0);
  }

  const runDate = status.runDate;
  const periods = status.periods;
  log(`Run date: ${runDate}`);

  // Load client list
  const clients = JSON.parse(readFileSync('/workspace/agent/clients.json', 'utf8'));
  const activeClients = clients.filter(c => c.active !== false);

  // Mark which clients failed collection
  const failedIds = new Set(
    (status.accounts || []).filter(a => a.status === 'failed').map(a => a.clientId)
  );

  const results = [];
  let criticalCount = 0, warningCount = 0, positiveCount = 0;
  const missingData = [];

  for (const client of activeClients) {
    try {
      if (failedIds.has(client.clientId)) {
        results.push({ clientId: client.clientId, clientName: client.clientName, dataAvailable: false, flags: [], summary: null });
        missingData.push(client.clientId);
        log(`  Skipping ${client.clientName} — collection failed`);
        continue;
      }
      const result = analyseClient(client, runDate, periods);
      results.push(result);
      if (!result.dataAvailable) { missingData.push(client.clientId); continue; }
      for (const f of result.flags) {
        if (f.severity === 'critical') criticalCount++;
        else if (f.severity === 'warning') warningCount++;
        else if (f.severity === 'positive') positiveCount++;
      }
    } catch (err) {
      log(`  ERROR analysing ${client.clientName}: ${err.message}\n${err.stack}`);
      results.push({ clientId: client.clientId, clientName: client.clientName, dataAvailable: false, flags: [], summary: null });
      missingData.push(client.clientId);
    }
  }

  const overallStatus = criticalCount > 0 ? 'issues_found' : warningCount > 0 ? 'warnings_only' : 'all_clear';

  const output = {
    meta: {
      runDate,
      generatedAt: new Date().toISOString(),
      overallStatus,
      accountsAnalysed: results.filter(r => r.dataAvailable).length,
      accountsMissingData: missingData,
      daysOfHistoryAvailable: (() => {
        // Find max history available across any client
        const dirs = existsSync(`${DATA_DIR}/raw`) ? readdirSync(`${DATA_DIR}/raw`).filter(d => d !== runDate) : [];
        return Math.min(dirs.length, 7);
      })(),
      criticalCount,
      warningCount,
      positiveCount,
    },
    clients: results,
  };

  // Write analysis file
  mkdirSync(`${DATA_DIR}/analysis`, { recursive: true });
  const outPath = `${DATA_DIR}/analysis/${runDate}.json`;
  const json = JSON.stringify(output, null, 2);
  JSON.parse(json); // validate well-formed
  writeFileSync(outPath, json, 'utf8');

  log(`=== Analysis complete — ${criticalCount} critical, ${warningCount} warning, ${positiveCount} positive flags across ${results.filter(r => r.dataAvailable).length} clients ===`);
  log(`Output: ${outPath}`);
  log(`Triggering Reporter: "Analysis complete for ${runDate}. ${criticalCount} critical, ${warningCount} warning, ${positiveCount} positive flags across ${activeClients.length} clients. Proceed with report."`);
}

main().catch(err => {
  log(`FATAL: ${err.message}\n${err.stack}`);
  process.exit(1);
});
