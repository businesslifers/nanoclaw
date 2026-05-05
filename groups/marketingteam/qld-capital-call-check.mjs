/**
 * Check all conversion actions in QLD Capital account
 */

import { readFileSync } from 'fs';
import { JWT } from '/workspace/agent/node_modules/google-auth-library/build/src/index.js';
import { grpc } from '/workspace/agent/node_modules/google-gax/build/src/index.js';
import { GoogleAdsServiceClient } from '/workspace/agent/node_modules/google-ads-node/build/src/index.js';

const CONFIG = JSON.parse(readFileSync('/workspace/agent/credentials/google-ads-config.json', 'utf8'));
const KEY_DATA = JSON.parse(readFileSync(CONFIG.serviceAccountKeyFile, 'utf8'));
const ADS_CUSTOMER_ID = '4837640439';

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

const adsClient = createAdsClient();

// List all conversion actions with their types/categories
const query = `
  SELECT
    conversion_action.name,
    conversion_action.type,
    conversion_action.category,
    conversion_action.status,
    conversion_action.include_in_conversions_metric
  FROM conversion_action
  WHERE conversion_action.status != 'REMOVED'
  ORDER BY conversion_action.name
`;

const rows = await queryAds(adsClient, ADS_CUSTOMER_ID, query);
for (const row of rows) {
  console.log({
    name: row.conversion_action?.name,
    type: row.conversion_action?.type,
    category: row.conversion_action?.category,
    status: row.conversion_action?.status,
    includedInConversions: row.conversion_action?.include_in_conversions_metric,
  });
}

// Also check for any conversions in the date range broken down by all action names (including calls from ads)
const convQuery = `
  SELECT
    campaign.name,
    segments.conversion_action_name,
    segments.conversion_action_category,
    metrics.conversions,
    metrics.all_conversions
  FROM campaign
  WHERE segments.date BETWEEN '2026-04-06' AND '2026-04-12'
    AND campaign.status != 'REMOVED'
    AND metrics.all_conversions > 0
  ORDER BY campaign.name
`;
const convRows = await queryAds(adsClient, ADS_CUSTOMER_ID, convQuery);
console.log('\n=== ALL CONVERSIONS IN DATE RANGE ===');
for (const row of convRows) {
  console.log({
    campaign: row.campaign?.name,
    action: row.segments?.conversion_action_name,
    category: row.segments?.conversion_action_category,
    conversions: row.metrics?.conversions,
    allConversions: row.metrics?.all_conversions,
  });
}
