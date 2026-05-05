/**
 * Check all Carpet One accounts for active ads pointing to /book
 */

import { readFileSync } from 'fs';
import { JWT } from '/workspace/agent/node_modules/google-auth-library/build/src/index.js';
import { grpc } from '/workspace/agent/node_modules/google-gax/build/src/index.js';
import { GoogleAdsServiceClient } from '/workspace/agent/node_modules/google-ads-node/build/src/index.js';

const CONFIG = JSON.parse(readFileSync('/workspace/agent/credentials/google-ads-config.json', 'utf8'));
const KEY_DATA = JSON.parse(readFileSync(CONFIG.serviceAccountKeyFile, 'utf8'));

const CARPET_ONE_ACCOUNTS = [
  { name: 'Redcliffe',     id: '3366875793' },
  { name: 'Caloundra',     id: '7138001437' },
  { name: 'Maroochydore',  id: '5453520645' },
  { name: 'Rockhampton',   id: '5385542747' },
  { name: 'Bundall',       id: '2299014578' },
  // Logan City already checked — included for completeness
  { name: 'Logan City',    id: '3480465964' },
];

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

// Only active: campaign ENABLED, ad group ENABLED, ad ENABLED
const query = `
  SELECT
    campaign.name,
    ad_group.name,
    ad_group_ad.ad.id,
    ad_group_ad.ad.final_urls,
    ad_group_ad.status
  FROM ad_group_ad
  WHERE ad_group_ad.status = 'ENABLED'
    AND ad_group.status = 'ENABLED'
    AND campaign.status = 'ENABLED'
  ORDER BY campaign.name
`;

for (const account of CARPET_ONE_ACCOUNTS) {
  try {
    const rows = await queryAds(adsClient, account.id, query);
    const bookAds = rows.filter(row =>
      (row.ad_group_ad?.ad?.final_urls || []).some(url => url.toLowerCase().includes('/book'))
    );
    if (bookAds.length > 0) {
      console.log(`\n⚠️  ${account.name} — ${bookAds.length} active ad(s) pointing to /book:`);
      for (const row of bookAds) {
        console.log(`  Campaign: ${row.campaign?.name}`);
        console.log(`  Ad Group: ${row.ad_group?.name}`);
        console.log(`  URLs: ${(row.ad_group_ad?.ad?.final_urls || []).join(', ')}`);
      }
    } else {
      console.log(`✓ ${account.name} — clear (${rows.length} active ads checked)`);
    }
  } catch (e) {
    console.log(`✗ ${account.name} — error: ${e.message}`);
  }
}
