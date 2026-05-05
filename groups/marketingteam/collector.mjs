/**
 * Collector Agent
 * Fetches Google Ads + GA4 data for all active clients and saves structured JSON.
 * Run daily at 6am AEST. Output consumed by the Analyst Agent.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'fs';
import { join } from 'path';
import { JWT } from '/workspace/agent/node_modules/google-auth-library/build/src/index.js';
import { grpc } from '/workspace/agent/node_modules/google-gax/build/src/index.js';
import { GoogleAdsServiceClient } from '/workspace/agent/node_modules/google-ads-node/build/src/index.js';

// ─── Config ──────────────────────────────────────────────────────────────────

const CONFIG = JSON.parse(readFileSync('/workspace/agent/credentials/google-ads-config.json', 'utf8'));
const KEY_DATA = JSON.parse(readFileSync(CONFIG.serviceAccountKeyFile, 'utf8'));
const CLIENTS = JSON.parse(readFileSync('/workspace/agent/clients.json', 'utf8'));

const DATA_DIR = '/workspace/agent/data';
const LOG_FILE = `${DATA_DIR}/collector.log`;

// ─── Logging ─────────────────────────────────────────────────────────────────

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try {
    const existing = existsSync(LOG_FILE) ? readFileSync(LOG_FILE, 'utf8') : '';
    writeFileSync(LOG_FILE, existing + line + '\n');
  } catch (_) {}
}

// ─── Date Periods ────────────────────────────────────────────────────────────

function getDatePeriods(now = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  const mtdStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const mtdEnd = yesterday;

  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const prevMonthStart = new Date(prevMonthEnd.getFullYear(), prevMonthEnd.getMonth(), 1);

  return {
    yesterday: fmt(yesterday),
    currentMonthToDate: {
      start: fmt(mtdStart),
      end: fmt(mtdEnd),
    },
    previousMonth: {
      start: fmt(prevMonthStart),
      end: fmt(prevMonthEnd),
    },
    isFirstOfMonth: now.getDate() === 1,
  };
}

// ─── Retry ───────────────────────────────────────────────────────────────────

async function withRetry(fn, label, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries) throw err;
      const delay = Math.pow(2, attempt) * 1000;
      log(`  [retry] ${label} — attempt ${attempt} failed: ${err.message}. Retrying in ${delay / 1000}s...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

// ─── Google Ads Client ───────────────────────────────────────────────────────

// google-gax 5.x's createFromGoogleCredential bridge silently drops auth from
// google-auth-library@10.x JWTs. We fetch the bearer token explicitly and
// attach it as gRPC metadata per-call. Tokens last ~1h, longer than a run.
let ADS_BEARER_TOKEN = null;

async function createAdsClient() {
  const jwtClient = new JWT({
    email: KEY_DATA.client_email,
    key: KEY_DATA.private_key,
    scopes: ['https://www.googleapis.com/auth/adwords'],
  });
  const { access_token } = await jwtClient.authorize();
  ADS_BEARER_TOKEN = access_token;
  return new GoogleAdsServiceClient({ sslCreds: grpc.credentials.createSsl() });
}

async function queryAds(adsClient, customerId, query) {
  const rows = [];
  const stream = adsClient.searchStream(
    { customer_id: customerId, query },
    {
      otherArgs: {
        headers: {
          'developer-token': CONFIG.developerToken,
          authorization: `Bearer ${ADS_BEARER_TOKEN}`,
        },
      },
    }
  );
  for await (const page of stream) {
    for (const row of (page.results || [])) {
      rows.push(row);
    }
  }
  return rows;
}

// ─── Google Ads — Campaign Performance ───────────────────────────────────────

async function fetchCampaignPerformance(adsClient, customerId, startDate, endDate) {
  const query = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.advertising_channel_type,
      campaign.bidding_strategy_type,
      campaign_budget.amount_micros,
      metrics.cost_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.interaction_rate,
      metrics.average_cpc,
      metrics.conversions_from_interactions_rate,
      metrics.search_top_impression_share,
      metrics.search_absolute_top_impression_share,
      metrics.search_impression_share,
      metrics.search_budget_lost_impression_share,
      metrics.search_rank_lost_impression_share
    FROM campaign
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      AND campaign.status != 'REMOVED'
    ORDER BY campaign.name
  `;
  const rows = await queryAds(adsClient, customerId, query);

  // Group by campaign
  const campaigns = {};
  for (const row of rows) {
    const id = String(row.campaign?.id);
    if (!campaigns[id]) {
      campaigns[id] = {
        id,
        name: row.campaign?.name || '',
        status: row.campaign?.status || '',
        type: row.campaign?.advertising_channel_type || '',
        biddingStrategy: row.campaign?.bidding_strategy_type || '',
        dailyBudget: (row.campaign_budget?.amount_micros || 0) / 1_000_000,
        spend: 0, impressions: 0, clicks: 0, ctr: 0, avgCpc: 0,
        conversionRate: 0, topImprRate: 0, absTopImprRate: 0,
        searchImprShare: 0, lostISBudget: 0, lostISRank: 0,
      };
    }
    const c = campaigns[id];
    c.spend += (row.metrics?.cost_micros || 0) / 1_000_000;
    c.impressions += Number(row.metrics?.impressions || 0);
    c.clicks += Number(row.metrics?.clicks || 0);
    // Rates — use last value (same across segments.date rows for a campaign)
    c.ctr = Number(row.metrics?.interaction_rate || 0);
    c.avgCpc = (row.metrics?.average_cpc || 0) / 1_000_000;
    c.conversionRate = Number(row.metrics?.conversions_from_interactions_rate || 0);
    c.topImprRate = Number(row.metrics?.search_top_impression_share || 0);
    c.absTopImprRate = Number(row.metrics?.search_absolute_top_impression_share || 0);
    c.searchImprShare = Number(row.metrics?.search_impression_share || 0);
    c.lostISBudget = Number(row.metrics?.search_budget_lost_impression_share || 0);
    c.lostISRank = Number(row.metrics?.search_rank_lost_impression_share || 0);
  }
  return campaigns;
}

// ─── Google Ads — Conversion Actions ─────────────────────────────────────────

async function fetchConversionsByAction(adsClient, customerId, startDate, endDate) {
  const query = `
    SELECT
      campaign.id,
      segments.conversion_action_name,
      segments.conversion_action_category,
      metrics.conversions,
      metrics.conversions_value,
      metrics.all_conversions
    FROM campaign
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      AND metrics.all_conversions > 0
      AND campaign.status != 'REMOVED'
    ORDER BY campaign.name
  `;
  const rows = await queryAds(adsClient, customerId, query);

  // Group by campaign → action name
  const result = {}; // campaignId → { actionName → { name, category, count, value } }
  for (const row of rows) {
    const campaignId = String(row.campaign?.id);
    const actionName = row.segments?.conversion_action_name || 'Unknown';
    const conversions = Number(row.metrics?.conversions || 0);
    const allConversions = Number(row.metrics?.all_conversions || 0);
    const value = Number(row.metrics?.conversions_value || 0);
    const isPrimary = conversions > 0;

    if (!result[campaignId]) result[campaignId] = {};
    if (!result[campaignId][actionName]) {
      result[campaignId][actionName] = {
        name: actionName,
        category: isPrimary ? 'primary' : 'secondary',
        count: 0,
        value: 0,
        allCount: 0,
      };
    }
    const entry = result[campaignId][actionName];
    entry.count += conversions;
    entry.allCount += allConversions;
    entry.value += value;
    if (isPrimary) entry.category = 'primary';
  }
  return result;
}

// ─── Google Ads — Search Terms ────────────────────────────────────────────────

async function fetchSearchTerms(adsClient, customerId, startDate, endDate) {
  const query = `
    SELECT
      campaign.id,
      search_term_view.search_term,
      search_term_view.status,
      segments.keyword.info.match_type,
      metrics.clicks,
      metrics.conversions
    FROM search_term_view
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      AND metrics.impressions > 0
    ORDER BY metrics.conversions DESC, metrics.clicks DESC
    LIMIT 200
  `;
  const rows = await queryAds(adsClient, customerId, query);

  // Group by campaign, top 50 per campaign by conversions
  const byCampaign = {};
  for (const row of rows) {
    const campaignId = String(row.campaign?.id);
    if (!byCampaign[campaignId]) byCampaign[campaignId] = [];
    byCampaign[campaignId].push({
      term: row.search_term_view?.search_term || '',
      matchType: row.segments?.keyword?.info?.match_type || '',
      clicks: Number(row.metrics?.clicks || 0),
      primaryConversions: Number(row.metrics?.conversions || 0),
    });
  }
  // Trim to top 50 per campaign
  for (const id of Object.keys(byCampaign)) {
    byCampaign[id] = byCampaign[id].slice(0, 50);
  }
  return byCampaign;
}

// ─── Google Ads — Ad Copy ─────────────────────────────────────────────────────

async function fetchAdCopy(adsClient, customerId, startDate, endDate) {
  const query = `
    SELECT
      campaign.id,
      ad_group_ad.ad.id,
      ad_group_ad.ad.responsive_search_ad.headlines,
      ad_group_ad.ad.responsive_search_ad.descriptions,
      ad_group_ad.ad.expanded_text_ad.headline_part1,
      ad_group_ad.ad.expanded_text_ad.headline_part2,
      ad_group_ad.ad.expanded_text_ad.headline_part3,
      ad_group_ad.ad.expanded_text_ad.description,
      ad_group_ad.policy_summary.approval_status,
      metrics.clicks,
      metrics.conversions
    FROM ad_group_ad
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      AND ad_group_ad.status != 'REMOVED'
    ORDER BY metrics.conversions DESC
  `;
  const rows = await queryAds(adsClient, customerId, query);

  // Group by campaign → ad id
  const byCampaign = {};
  for (const row of rows) {
    const campaignId = String(row.campaign?.id);
    const adId = String(row.ad_group_ad?.ad?.id || '');
    const approvalStatus = row.ad_group_ad?.policy_summary?.approval_status || '';

    if (!byCampaign[campaignId]) byCampaign[campaignId] = {};
    if (!byCampaign[campaignId][adId]) {
      // Extract headlines and descriptions
      const rsa = row.ad_group_ad?.ad?.responsive_search_ad;
      const eta = row.ad_group_ad?.ad?.expanded_text_ad;
      let headlines = [];
      let descriptions = [];

      if (rsa) {
        headlines = (rsa.headlines || []).map(h => h.text || '').filter(Boolean);
        descriptions = (rsa.descriptions || []).map(d => d.text || '').filter(Boolean);
      } else if (eta) {
        headlines = [eta.headline_part1, eta.headline_part2, eta.headline_part3].filter(Boolean);
        descriptions = [eta.description].filter(Boolean);
      }

      byCampaign[campaignId][adId] = {
        id: adId,
        headlines,
        descriptions,
        status: approvalStatus,
        clicks: 0,
        conversions: 0,
      };
    }
    byCampaign[campaignId][adId].clicks += Number(row.metrics?.clicks || 0);
    byCampaign[campaignId][adId].conversions += Number(row.metrics?.conversions || 0);
  }

  // Convert to arrays
  const result = {};
  for (const [campaignId, ads] of Object.entries(byCampaign)) {
    result[campaignId] = Object.values(ads);
  }
  return result;
}

// ─── Google Ads — Disapproved Ads ────────────────────────────────────────────

async function fetchDisapprovedAds(adsClient, customerId) {
  const query = `
    SELECT
      campaign.id,
      ad_group_ad.ad.id,
      ad_group_ad.ad.responsive_search_ad.headlines,
      ad_group_ad.ad.expanded_text_ad.headline_part1,
      ad_group_ad.ad.expanded_text_ad.headline_part2,
      ad_group_ad.policy_summary.approval_status,
      ad_group_ad.policy_summary.policy_topic_entries
    FROM ad_group_ad
    WHERE ad_group_ad.policy_summary.approval_status != 'APPROVED'
      AND ad_group_ad.status != 'REMOVED'
      AND ad_group.status != 'REMOVED'
      AND campaign.status != 'REMOVED'
  `;
  const rows = await queryAds(adsClient, customerId, query);

  const byCampaign = {};
  for (const row of rows) {
    const campaignId = String(row.campaign?.id);
    const adId = String(row.ad_group_ad?.ad?.id || '');
    const approvalStatus = row.ad_group_ad?.policy_summary?.approval_status || '';
    const policyEntries = row.ad_group_ad?.policy_summary?.policy_topic_entries || [];

    const rsa = row.ad_group_ad?.ad?.responsive_search_ad;
    const eta = row.ad_group_ad?.ad?.expanded_text_ad;
    let headlines = [];
    if (rsa) {
      headlines = (rsa.headlines || []).map(h => h.text || '').filter(Boolean);
    } else if (eta) {
      headlines = [eta.headline_part1, eta.headline_part2].filter(Boolean);
    }

    if (!byCampaign[campaignId]) byCampaign[campaignId] = [];
    byCampaign[campaignId].push({
      id: adId,
      headlines,
      approvalStatus,
      policyTopics: policyEntries.map(e => ({
        topic: e.topic || '',
        constraintType: e.type || '',
      })),
    });
  }
  return byCampaign;
}

// ─── GA4 REST API ─────────────────────────────────────────────────────────────

async function getGA4Token() {
  const jwtClient = new JWT({
    email: KEY_DATA.client_email,
    key: KEY_DATA.private_key,
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
  });
  const tokenResult = await jwtClient.getAccessToken();
  return tokenResult.token;
}

async function ga4Report(token, propertyId, body) {
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await resp.json();
  if (data.error) throw new Error(`GA4 API error: ${data.error.message}`);
  return data;
}

function ga4Val(row, index) {
  return row?.metricValues?.[index]?.value ?? '0';
}

async function fetchGA4Period(token, propertyId, startDate, endDate) {
  const dateRange = { startDate, endDate };

  // Overview metrics
  const overview = await ga4Report(token, propertyId, {
    dateRanges: [dateRange],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
      { name: 'newUsers' },
      { name: 'bounceRate' },
      { name: 'engagementRate' },
      { name: 'averageSessionDuration' },
      { name: 'screenPageViewsPerSession' },
      { name: 'screenPageViews' },
    ],
  });
  const ov = overview.rows?.[0];

  // Traffic sources
  const sourcesData = await ga4Report(token, propertyId, {
    dateRanges: [dateRange],
    dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }],
    metrics: [{ name: 'sessions' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 20,
  });

  // Landing pages
  const landingData = await ga4Report(token, propertyId, {
    dateRanges: [dateRange],
    dimensions: [{ name: 'landingPage' }],
    metrics: [{ name: 'sessions' }, { name: 'bounceRate' }, { name: 'engagementRate' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 20,
  });

  // Devices
  const deviceData = await ga4Report(token, propertyId, {
    dateRanges: [dateRange],
    dimensions: [{ name: 'deviceCategory' }],
    metrics: [{ name: 'sessions' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
  });

  // Countries
  const countryData = await ga4Report(token, propertyId, {
    dateRanges: [dateRange],
    dimensions: [{ name: 'country' }],
    metrics: [{ name: 'sessions' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 10,
  });

  // Contact engagement events
  const eventsData = await ga4Report(token, propertyId, {
    dateRanges: [dateRange],
    dimensions: [{ name: 'eventName' }, { name: 'sessionGoogleAdsCampaignName' }],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: {
      filter: {
        fieldName: 'eventName',
        stringFilter: { matchType: 'PARTIAL_REGEXP', value: 'form|phone|email|call|contact|submit', caseSensitive: false }
      }
    },
    orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
    limit: 50,
  });

  return {
    sessions: Number(ga4Val(ov, 0)),
    users: Number(ga4Val(ov, 1)),
    newUsers: Number(ga4Val(ov, 2)),
    bounceRate: parseFloat(Number(ga4Val(ov, 3)).toFixed(4)),
    engagementRate: parseFloat(Number(ga4Val(ov, 4)).toFixed(4)),
    avgSessionDuration: Math.round(Number(ga4Val(ov, 5))),
    pagesPerSession: parseFloat(Number(ga4Val(ov, 6)).toFixed(2)),
    pageViews: Number(ga4Val(ov, 7)),
    trafficSources: (sourcesData.rows || []).map(r => ({
      source: r.dimensionValues[0].value,
      medium: r.dimensionValues[1].value,
      sessions: Number(r.metricValues[0].value),
    })),
    landingPages: (landingData.rows || []).map(r => ({
      url: r.dimensionValues[0].value,
      sessions: Number(r.metricValues[0].value),
      bounceRate: parseFloat(Number(r.metricValues[1].value).toFixed(4)),
      engagementRate: parseFloat(Number(r.metricValues[2].value).toFixed(4)),
    })),
    devices: (deviceData.rows || []).map(r => ({
      device: r.dimensionValues[0].value,
      sessions: Number(r.metricValues[0].value),
    })),
    countries: (countryData.rows || []).map(r => ({
      country: r.dimensionValues[0].value,
      sessions: Number(r.metricValues[0].value),
    })),
    contactEvents: (eventsData.rows || []).map(r => ({
      eventName: r.dimensionValues[0].value,
      campaign: r.dimensionValues[1].value,
      count: Number(r.metricValues[0].value),
    })),
  };
}

// ─── Build Client Output ──────────────────────────────────────────────────────

function buildPeriodMetrics(campaignPerf, conversionsByAction) {
  // Merge conversion actions into campaign performance objects
  const result = {};
  for (const [id, perf] of Object.entries(campaignPerf)) {
    const actions = conversionsByAction[id] || {};
    result[id] = {
      ...perf,
      conversionActions: Object.values(actions).map(a => ({
        name: a.name,
        category: a.category,
        count: parseFloat(a.count.toFixed(2)),
        value: parseFloat(a.value.toFixed(2)),
      })),
    };
  }
  return result;
}

// ─── Collect One Client ───────────────────────────────────────────────────────

async function collectClient(client, periods, adsClient, ga4Token) {
  const customerId = client.googleAdsCustomerId.replace(/-/g, '');
  const propertyId = client.ga4PropertyId;
  log(`  Collecting ${client.clientName} (${customerId})...`);

  // ── Google Ads ────────────────────────────────────────────────────────────

  // Campaign performance — 3 periods
  const [ydPerf, mtdPerf, prevPerf] = await Promise.all([
    withRetry(() => fetchCampaignPerformance(adsClient, customerId, periods.yesterday, periods.yesterday), 'campaign perf yesterday'),
    withRetry(() => fetchCampaignPerformance(adsClient, customerId, periods.currentMonthToDate.start, periods.currentMonthToDate.end), 'campaign perf mtd'),
    withRetry(() => fetchCampaignPerformance(adsClient, customerId, periods.previousMonth.start, periods.previousMonth.end), 'campaign perf prev month'),
  ]);

  // Conversion actions — 3 periods
  const [ydConv, mtdConv, prevConv] = await Promise.all([
    withRetry(() => fetchConversionsByAction(adsClient, customerId, periods.yesterday, periods.yesterday), 'conversions yesterday'),
    withRetry(() => fetchConversionsByAction(adsClient, customerId, periods.currentMonthToDate.start, periods.currentMonthToDate.end), 'conversions mtd'),
    withRetry(() => fetchConversionsByAction(adsClient, customerId, periods.previousMonth.start, periods.previousMonth.end), 'conversions prev month'),
  ]);

  // Search terms + ad copy + disapproved ads (MTD / current)
  const [searchTerms, adCopy, disapprovedAds] = await Promise.all([
    withRetry(() => fetchSearchTerms(adsClient, customerId, periods.currentMonthToDate.start, periods.currentMonthToDate.end), 'search terms'),
    withRetry(() => fetchAdCopy(adsClient, customerId, periods.currentMonthToDate.start, periods.currentMonthToDate.end), 'ad copy'),
    withRetry(() => fetchDisapprovedAds(adsClient, customerId), 'disapproved ads'),
  ]);

  // Merge per-campaign data
  const allCampaignIds = new Set([
    ...Object.keys(ydPerf),
    ...Object.keys(mtdPerf),
    ...Object.keys(prevPerf),
  ]);

  const campaigns = [];
  for (const id of allCampaignIds) {
    const base = ydPerf[id] || mtdPerf[id] || prevPerf[id];

    const ydMerged = buildPeriodMetrics({ [id]: ydPerf[id] || {} }, { [id]: ydConv[id] || {} });
    const mtdMerged = buildPeriodMetrics({ [id]: mtdPerf[id] || {} }, { [id]: mtdConv[id] || {} });
    const prevMerged = buildPeriodMetrics({ [id]: prevPerf[id] || {} }, { [id]: prevConv[id] || {} });

    const yesterday = ydMerged[id] || {};
    const currentMonthToDate = mtdMerged[id] || {};
    const previousMonth = prevMerged[id] || {};

    // Strip redundant base fields from period objects
    const periodFields = ['spend', 'impressions', 'clicks', 'ctr', 'avgCpc', 'conversionRate',
      'topImprRate', 'absTopImprRate', 'searchImprShare', 'lostISBudget', 'lostISRank', 'conversionActions'];

    campaigns.push({
      id,
      name: base?.name || '',
      status: base?.status || '',
      type: base?.type || '',
      biddingStrategy: base?.biddingStrategy || '',
      dailyBudget: base?.dailyBudget || 0,
      yesterday: Object.fromEntries(periodFields.map(f => [f, yesterday[f] ?? (f === 'conversionActions' ? [] : 0)])),
      currentMonthToDate: Object.fromEntries(periodFields.map(f => [f, currentMonthToDate[f] ?? (f === 'conversionActions' ? [] : 0)])),
      previousMonth: Object.fromEntries(periodFields.map(f => [f, previousMonth[f] ?? (f === 'conversionActions' ? [] : 0)])),
      searchTerms: searchTerms[id] || [],
      ads: adCopy[id] || [],
      disapprovedAds: disapprovedAds[id] || [],
    });
  }

  // ── Google Analytics ──────────────────────────────────────────────────────

  const [ga4Yd, ga4Mtd, ga4Prev] = await Promise.all([
    withRetry(() => fetchGA4Period(ga4Token, propertyId, periods.yesterday, periods.yesterday), 'ga4 yesterday'),
    withRetry(() => fetchGA4Period(ga4Token, propertyId, periods.currentMonthToDate.start, periods.currentMonthToDate.end), 'ga4 mtd'),
    withRetry(() => fetchGA4Period(ga4Token, propertyId, periods.previousMonth.start, periods.previousMonth.end), 'ga4 prev month'),
  ]);

  // ── Assemble output ───────────────────────────────────────────────────────

  return {
    meta: {
      clientId: client.clientId,
      clientName: client.clientName,
      collectedAt: new Date().toISOString(),
      periods: {
        yesterday: periods.yesterday,
        currentMonthToDate: { start: periods.currentMonthToDate.start, end: periods.currentMonthToDate.end },
        previousMonth: { start: periods.previousMonth.start, end: periods.previousMonth.end },
      },
    },
    googleAds: { campaigns },
    googleAnalytics: {
      yesterday: ga4Yd,
      currentMonthToDate: ga4Mtd,
      previousMonth: ga4Prev,
    },
  };
}

// ─── File I/O ─────────────────────────────────────────────────────────────────

function saveClientFile(runDate, clientId, data) {
  const dir = `${DATA_DIR}/raw/${runDate}`;
  mkdirSync(dir, { recursive: true });
  const path = `${dir}/${clientId}.json`;
  const json = JSON.stringify(data, null, 2);
  JSON.parse(json); // validate well-formed before writing
  writeFileSync(path, json, 'utf8');
  return path;
}

function saveStatusFile(status) {
  const path = `${DATA_DIR}/collector-status.json`;
  writeFileSync(path, JSON.stringify(status, null, 2), 'utf8');
}

// ─── Monthly Rollup ───────────────────────────────────────────────────────────

function writeMonthlyRollup(runDate, clientId, clientData) {
  const d = new Date(runDate);
  const prevMonth = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  const pad = n => String(n).padStart(2, '0');
  const monthKey = `${prevMonth.getFullYear()}-${pad(prevMonth.getMonth() + 1)}`;
  const dir = `${DATA_DIR}/monthly/${monthKey}`;
  mkdirSync(dir, { recursive: true });

  // Monthly file contains only previousMonth period data
  const rollup = {
    meta: { ...clientData.meta, rollupMonth: monthKey },
    googleAds: {
      campaigns: clientData.googleAds.campaigns.map(c => ({
        id: c.id, name: c.name, status: c.status, type: c.type,
        biddingStrategy: c.biddingStrategy, dailyBudget: c.dailyBudget,
        previousMonth: c.previousMonth,
      })),
    },
    googleAnalytics: { previousMonth: clientData.googleAnalytics.previousMonth },
  };

  writeFileSync(`${dir}/${clientId}.json`, JSON.stringify(rollup, null, 2), 'utf8');
  log(`  Monthly rollup written: ${dir}/${clientId}.json`);
}

// ─── Pruning ──────────────────────────────────────────────────────────────────

function pruneOldFiles(runDate) {
  const rawDir = `${DATA_DIR}/raw`;
  if (!existsSync(rawDir)) return;

  const cutoff = new Date(runDate);
  cutoff.setDate(cutoff.getDate() - 90);

  let pruned = 0;
  for (const dir of readdirSync(rawDir)) {
    const dirDate = new Date(dir);
    if (!isNaN(dirDate) && dirDate < cutoff) {
      rmSync(`${rawDir}/${dir}`, { recursive: true, force: true });
      pruned++;
    }
  }
  if (pruned > 0) log(`Pruned ${pruned} daily director${pruned === 1 ? 'y' : 'ies'} older than 90 days`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const now = new Date();
  const periods = getDatePeriods(now);
  const runDate = periods.yesterday; // label the collection by the data date

  log(`=== Collector run started — data date: ${runDate} ===`);
  log(`Periods: yesterday=${periods.yesterday}, MTD=${periods.currentMonthToDate.start}→${periods.currentMonthToDate.end}, prevMonth=${periods.previousMonth.start}→${periods.previousMonth.end}`);

  const activeClients = CLIENTS.filter(c => c.active !== false);
  log(`Active clients: ${activeClients.length}`);

  // Create shared API clients
  const adsClient = await createAdsClient();
  const ga4Token = await getGA4Token();

  const accountResults = [];
  let succeeded = 0;
  let failed = 0;

  for (const client of activeClients) {
    try {
      const data = await collectClient(client, periods, adsClient, ga4Token);

      // On 1st of month — write monthly rollup before saving daily file
      if (periods.isFirstOfMonth) {
        writeMonthlyRollup(periods.yesterday, client.clientId, data);
      }

      saveClientFile(runDate, client.clientId, data);
      log(`  ✓ ${client.clientName} — saved`);
      succeeded++;
      accountResults.push({
        clientId: client.clientId,
        status: 'success',
        completedAt: new Date().toISOString(),
      });
    } catch (err) {
      log(`  ✗ ${client.clientName} — FAILED: ${err.message}`);
      failed++;
      accountResults.push({
        clientId: client.clientId,
        status: 'failed',
        error: err.message,
        completedAt: new Date().toISOString(),
      });
    }
  }

  await adsClient.close();

  // Prune old files (after monthly rollup)
  if (periods.isFirstOfMonth) {
    pruneOldFiles(periods.yesterday);
  }

  // Write status file
  const overallStatus = failed === 0 ? 'complete' : succeeded === 0 ? 'failed' : 'partial';
  const statusFile = {
    status: overallStatus,
    runDate: periods.yesterday,
    periods: {
      yesterday: periods.yesterday,
      currentMonthToDate: periods.currentMonthToDate,
      previousMonth: periods.previousMonth,
    },
    accounts: accountResults,
  };
  saveStatusFile(statusFile);

  log(`=== Collection complete — ${succeeded} succeeded, ${failed} failed. Status: ${overallStatus} ===`);

  // Trigger Analyst or alert admin
  if (overallStatus === 'failed') {
    log('All accounts failed — not triggering Analyst. Alert admin.');
    // Admin alert would be sent here via the platform messaging system
  } else {
    log(`Triggering Analyst: "New data collected for ${runDate}. Status: ${succeeded} succeeded, ${failed} failed. Proceed with analysis."`);
    // Analyst trigger message would be sent here via the platform messaging system
  }
}

main().catch(err => {
  log(`FATAL: ${err.message}\n${err.stack}`);
  process.exit(1);
});
