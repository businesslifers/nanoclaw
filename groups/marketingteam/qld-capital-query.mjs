/**
 * Ad-hoc query: QLD Capital — Apr 6–12, 2026
 * Fetches: contact page hits, form submissions, calls from ads — by campaign
 */

import { readFileSync } from 'fs';
import { JWT } from '/workspace/agent/node_modules/google-auth-library/build/src/index.js';
import { grpc } from '/workspace/agent/node_modules/google-gax/build/src/index.js';
import { GoogleAdsServiceClient } from '/workspace/agent/node_modules/google-ads-node/build/src/index.js';

const CONFIG = JSON.parse(readFileSync('/workspace/agent/credentials/google-ads-config.json', 'utf8'));
const KEY_DATA = JSON.parse(readFileSync(CONFIG.serviceAccountKeyFile, 'utf8'));

const ADS_CUSTOMER_ID = '4837640439';  // QLD Capital (no dashes)
const GA4_PROPERTY_ID = '342687688';
const START_DATE = '2026-04-06';
const END_DATE = '2026-04-12';

// ─── Google Ads ───────────────────────────────────────────────────────────────

function createAdsClient() {
  const jwtClient = new JWT({
    email: KEY_DATA.client_email,
    key: KEY_DATA.private_key,
    scopes: ['https://www.googleapis.com/auth/adwords'],
  });
  const sslCreds = grpc.credentials.createSsl();
  const authCreds = grpc.credentials.createFromGoogleCredential(jwtClient);
  const combinedCreds = grpc.credentials.combineChannelCredentials(sslCreds, authCreds);
  return new GoogleAdsServiceClient({ sslCreds: combinedCreds });
}

async function queryAds(adsClient, customerId, query) {
  const rows = [];
  const stream = adsClient.searchStream(
    { customer_id: customerId, query },
    { otherArgs: { headers: { 'developer-token': CONFIG.developerToken } } }
  );
  for await (const page of stream) {
    for (const row of (page.results || [])) rows.push(row);
  }
  return rows;
}

async function fetchCallsFromAds(adsClient) {
  const query = `
    SELECT
      campaign.name,
      segments.conversion_action_name,
      metrics.conversions,
      metrics.all_conversions
    FROM campaign
    WHERE segments.date BETWEEN '${START_DATE}' AND '${END_DATE}'
      AND campaign.status != 'REMOVED'
    ORDER BY campaign.name
  `;
  const rows = await queryAds(adsClient, ADS_CUSTOMER_ID, query);

  // Group by campaign → action name, filter for call conversions
  const byCampaign = {};
  for (const row of rows) {
    const campaign = row.campaign?.name || 'Unknown';
    const action = row.segments?.conversion_action_name || '';
    const allConversions = Number(row.metrics?.all_conversions || 0);

    const isCall = action.toLowerCase().includes('call') || action.toLowerCase().includes('phone');
    if (!isCall || allConversions === 0) continue;

    if (!byCampaign[campaign]) byCampaign[campaign] = { callsFromAds: 0, actions: [] };
    byCampaign[campaign].callsFromAds += allConversions;
    byCampaign[campaign].actions.push(`${action}: ${allConversions}`);
  }
  return byCampaign;
}

// ─── GA4 ──────────────────────────────────────────────────────────────────────

async function getGA4Token() {
  const jwtClient = new JWT({
    email: KEY_DATA.client_email,
    key: KEY_DATA.private_key,
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
  });
  const tokenResult = await jwtClient.getAccessToken();
  return tokenResult.token;
}

async function ga4Report(token, body) {
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}:runReport`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await resp.json();
  if (data.error) throw new Error(`GA4 error: ${data.error.message}`);
  return data;
}

async function fetchContactPageHits(token) {
  // Page views where pagePath contains /contact
  const data = await ga4Report(token, {
    dateRanges: [{ startDate: START_DATE, endDate: END_DATE }],
    dimensions: [{ name: 'sessionGoogleAdsCampaignName' }, { name: 'pagePath' }],
    metrics: [{ name: 'screenPageViews' }],
    dimensionFilter: {
      filter: {
        fieldName: 'pagePath',
        stringFilter: { matchType: 'CONTAINS', value: 'contact', caseSensitive: false }
      }
    },
    orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
    limit: 100,
  });
  return data;
}

async function fetchFormSubmissions(token) {
  // Form submit events by campaign
  const data = await ga4Report(token, {
    dateRanges: [{ startDate: START_DATE, endDate: END_DATE }],
    dimensions: [{ name: 'sessionGoogleAdsCampaignName' }, { name: 'eventName' }],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: {
      orGroup: {
        expressions: [
          {
            filter: {
              fieldName: 'eventName',
              stringFilter: { matchType: 'PARTIAL_REGEXP', value: 'submit|form_submit|contact|lead', caseSensitive: false }
            }
          }
        ]
      }
    },
    orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
    limit: 100,
  });
  return data;
}

async function fetchAllContactEvents(token) {
  // Broader — all contact-related events by campaign
  const data = await ga4Report(token, {
    dateRanges: [{ startDate: START_DATE, endDate: END_DATE }],
    dimensions: [{ name: 'sessionGoogleAdsCampaignName' }, { name: 'eventName' }],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: {
      filter: {
        fieldName: 'eventName',
        stringFilter: { matchType: 'PARTIAL_REGEXP', value: 'form|phone|email|call|contact|submit', caseSensitive: false }
      }
    },
    orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
    limit: 100,
  });
  return data;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const adsClient = createAdsClient();
const ga4Token = await getGA4Token();

console.log('=== GOOGLE ADS: CALLS FROM ADS BY CAMPAIGN ===');
const callsData = await fetchCallsFromAds(adsClient);
console.log(JSON.stringify(callsData, null, 2));

console.log('\n=== GA4: CONTACT PAGE HITS BY CAMPAIGN ===');
const pageHits = await fetchContactPageHits(ga4Token);
console.log(JSON.stringify(pageHits, null, 2));

console.log('\n=== GA4: FORM SUBMISSIONS BY CAMPAIGN ===');
const formSubs = await fetchFormSubmissions(ga4Token);
console.log(JSON.stringify(formSubs, null, 2));

console.log('\n=== GA4: ALL CONTACT EVENTS (for reference) ===');
const allEvents = await fetchAllContactEvents(ga4Token);
console.log(JSON.stringify(allEvents, null, 2));
