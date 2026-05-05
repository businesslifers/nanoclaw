/**
 * For each low QS keyword, find the landing page URL being used
 * (keyword-level final URL if set, otherwise ad-level final URL)
 */

import { readFileSync } from 'fs';
import { JWT } from '/workspace/agent/node_modules/google-auth-library/build/src/index.js';
import { grpc } from '/workspace/agent/node_modules/google-gax/build/src/index.js';
import { GoogleAdsServiceClient } from '/workspace/agent/node_modules/google-ads-node/build/src/index.js';

const CONFIG = JSON.parse(readFileSync('/workspace/agent/credentials/google-ads-config.json', 'utf8'));
const KEY_DATA = JSON.parse(readFileSync(CONFIG.serviceAccountKeyFile, 'utf8'));
const CLIENTS = JSON.parse(readFileSync('/workspace/agent/clients.json', 'utf8')).filter(c => c.active);

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

async function queryAds(adsClient, customerId, query) {
  const rows = [];
  const stream = adsClient.searchStream(
    { customer_id: customerId, query },
    { otherArgs: { headers: { 'developer-token': CONFIG.developerToken } } }
  );
  for await (const page of stream) for (const row of (page.results || [])) rows.push(row);
  return rows;
}

const adsClient = createAdsClient();

for (const client of CLIENTS) {
  const customerId = client.googleAdsCustomerId.replace(/-/g, '');

  // Get low QS keywords with their own final URLs (if set)
  const kwRows = await queryAds(adsClient, customerId, `
    SELECT
      campaign.name,
      ad_group.id,
      ad_group.name,
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type,
      ad_group_criterion.quality_info.quality_score,
      ad_group_criterion.quality_info.post_click_quality_score,
      ad_group_criterion.final_urls,
      metrics.impressions
    FROM keyword_view
    WHERE ad_group_criterion.status = 'ENABLED'
      AND ad_group.status = 'ENABLED'
      AND campaign.status = 'ENABLED'
    ORDER BY campaign.name, ad_group.name
  `);

  const lowKws = kwRows.filter(r => {
    const qs = r.ad_group_criterion?.quality_info?.quality_score;
    return qs && qs > 0 && qs <= 5;
  });

  if (lowKws.length === 0) continue;

  // Get ad-level final URLs for each affected ad group (fallback when keyword has no override)
  const adGroupIds = [...new Set(lowKws.map(r => String(r.ad_group?.id)))];
  const adRows = await queryAds(adsClient, customerId, `
    SELECT
      ad_group.id,
      ad_group_ad.ad.final_urls
    FROM ad_group_ad
    WHERE ad_group_ad.status = 'ENABLED'
      AND ad_group.status = 'ENABLED'
      AND campaign.status = 'ENABLED'
  `);

  // Map: adGroupId → set of final URLs used by active ads
  const adGroupUrls = {};
  for (const row of adRows) {
    const id = String(row.ad_group?.id);
    if (!adGroupUrls[id]) adGroupUrls[id] = new Set();
    for (const url of (row.ad_group_ad?.ad?.final_urls || [])) adGroupUrls[id].add(url);
  }

  // Group by campaign → ad group for clean output
  const byCampaign = {};
  for (const row of lowKws) {
    const campaign = row.campaign?.name;
    const adGroupId = String(row.ad_group?.id);
    const adGroup = row.ad_group?.name;
    const kw = row.ad_group_criterion?.keyword?.text;
    const match = row.ad_group_criterion?.keyword?.match_type;
    const qs = row.ad_group_criterion?.quality_info?.quality_score;
    const lp = row.ad_group_criterion?.quality_info?.post_click_quality_score;
    const impr = Number(row.metrics?.impressions || 0);
    const kwUrls = row.ad_group_criterion?.final_urls || [];
    const urls = kwUrls.length > 0 ? kwUrls : [...(adGroupUrls[adGroupId] || [])];

    if (!byCampaign[campaign]) byCampaign[campaign] = {};
    if (!byCampaign[campaign][adGroup]) byCampaign[campaign][adGroup] = { urls: new Set(), keywords: [] };
    for (const u of urls) byCampaign[campaign][adGroup].urls.add(u);
    byCampaign[campaign][adGroup].keywords.push({ kw, match, qs, lp, impr });
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`${client.clientName}`);
  console.log('='.repeat(60));

  for (const [campaign, adGroups] of Object.entries(byCampaign)) {
    console.log(`\nCampaign: ${campaign}`);
    for (const [adGroup, data] of Object.entries(adGroups)) {
      console.log(`  Ad Group: ${adGroup}`);
      console.log(`  Landing page(s): ${[...data.urls].join(', ') || '(none found)'}`);
      const sorted = data.keywords.sort((a, b) => a.qs - b.qs);
      for (const k of sorted) {
        console.log(`    QS ${k.qs}/10 | LP: ${k.lp} | ${k.impr} impr | "${k.kw}" [${k.match}]`);
      }
    }
  }
}
