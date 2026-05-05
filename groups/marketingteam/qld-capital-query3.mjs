/**
 * QLD Capital — Apr 20–26, 2026
 * Contact page hits, form submissions, direct calls from ads — by campaign
 * Note: ads paused from Apr 24 onwards
 */

import { readFileSync } from 'fs';
import { JWT } from '/workspace/agent/node_modules/google-auth-library/build/src/index.js';
import { grpc } from '/workspace/agent/node_modules/google-gax/build/src/index.js';
import { GoogleAdsServiceClient } from '/workspace/agent/node_modules/google-ads-node/build/src/index.js';

const CONFIG = JSON.parse(readFileSync('/workspace/agent/credentials/google-ads-config.json', 'utf8'));
const KEY_DATA = JSON.parse(readFileSync(CONFIG.serviceAccountKeyFile, 'utf8'));

const ADS_CUSTOMER_ID = '4837640439';
const GA4_PROPERTY_ID = '342687688';
const START_DATE = '2026-04-20';
const END_DATE = '2026-04-26';

function createAdsClient() {
  const jwtClient = new JWT({
    email: KEY_DATA.client_email,
    key: KEY_DATA.private_key,
    scopes: ['https://www.googleapis.com/auth/adwords'],
  });
  const sslCreds = grpc.credentials.createSsl();
  const authCreds = grpc.credentials.createFromGoogleCredential(jwtClient);
  return new GoogleAdsServiceClient({ sslCreds: grpc.credentials.combineChannelCredentials(sslCreds, authCreds) });
}

async function queryAds(adsClient, query) {
  const rows = [];
  const stream = adsClient.searchStream(
    { customer_id: ADS_CUSTOMER_ID, query },
    { otherArgs: { headers: { 'developer-token': CONFIG.developerToken } } }
  );
  for await (const page of stream) for (const row of (page.results || [])) rows.push(row);
  return rows;
}

async function getGA4Token() {
  const jwtClient = new JWT({
    email: KEY_DATA.client_email,
    key: KEY_DATA.private_key,
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
  });
  return (await jwtClient.getAccessToken()).token;
}

async function ga4Report(token, body) {
  const resp = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}:runReport`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await resp.json();
  if (data.error) throw new Error(`GA4 error: ${data.error.message}`);
  return data;
}

const adsClient = createAdsClient();
const ga4Token = await getGA4Token();

// 1. Direct calls from ads only (action name = 'Calls from ads')
const callRows = await queryAds(adsClient, `
  SELECT campaign.name, segments.conversion_action_name, metrics.all_conversions
  FROM campaign
  WHERE segments.date BETWEEN '${START_DATE}' AND '${END_DATE}'
    AND campaign.status != 'REMOVED'
    AND metrics.all_conversions > 0
  ORDER BY campaign.name
`);
const callsByCampaign = {};
for (const row of callRows) {
  if (row.segments?.conversion_action_name !== 'Calls from ads') continue;
  const campaign = row.campaign?.name || 'Unknown';
  callsByCampaign[campaign] = (callsByCampaign[campaign] || 0) + Number(row.metrics?.all_conversions || 0);
}

// 2. Contact page hits by campaign
const pageHits = await ga4Report(ga4Token, {
  dateRanges: [{ startDate: START_DATE, endDate: END_DATE }],
  dimensions: [{ name: 'sessionGoogleAdsCampaignName' }],
  metrics: [{ name: 'screenPageViews' }],
  dimensionFilter: {
    filter: { fieldName: 'pagePath', stringFilter: { matchType: 'CONTAINS', value: 'contact', caseSensitive: false } }
  },
  orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
  limit: 100,
});

// 3. Contact form submissions (Submit only, not View)
const formSubs = await ga4Report(ga4Token, {
  dateRanges: [{ startDate: START_DATE, endDate: END_DATE }],
  dimensions: [{ name: 'sessionGoogleAdsCampaignName' }],
  metrics: [{ name: 'eventCount' }],
  dimensionFilter: {
    filter: { fieldName: 'eventName', stringFilter: { matchType: 'EXACT', value: 'Website - Contact Form - Submit', caseSensitive: true } }
  },
  orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
  limit: 100,
});

console.log('=== CONTACT PAGE HITS ===');
for (const row of (pageHits.rows || [])) {
  console.log(`${row.dimensionValues[0].value}: ${row.metricValues[0].value}`);
}

console.log('\n=== FORM SUBMISSIONS ===');
for (const row of (formSubs.rows || [])) {
  console.log(`${row.dimensionValues[0].value}: ${row.metricValues[0].value}`);
}

console.log('\n=== CALLS FROM ADS (direct) ===');
if (Object.keys(callsByCampaign).length === 0) {
  console.log('Zero across all campaigns');
} else {
  for (const [k, v] of Object.entries(callsByCampaign)) console.log(`${k}: ${v}`);
}
