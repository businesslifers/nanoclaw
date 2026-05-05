/**
 * Check Carpet One Logan City — ads pointing to /book
 */

import { readFileSync } from 'fs';
import { JWT } from '/workspace/agent/node_modules/google-auth-library/build/src/index.js';
import { grpc } from '/workspace/agent/node_modules/google-gax/build/src/index.js';
import { GoogleAdsServiceClient } from '/workspace/agent/node_modules/google-ads-node/build/src/index.js';

const CONFIG = JSON.parse(readFileSync('/workspace/agent/credentials/google-ads-config.json', 'utf8'));
const KEY_DATA = JSON.parse(readFileSync(CONFIG.serviceAccountKeyFile, 'utf8'));
const ADS_CUSTOMER_ID = '3480465964'; // Carpet One Logan City

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

// Check expanded text ads, responsive search ads, and any ad with final URLs containing /book
const query = `
  SELECT
    campaign.name,
    campaign.status,
    ad_group.name,
    ad_group_ad.ad.id,
    ad_group_ad.ad.type,
    ad_group_ad.ad.final_urls,
    ad_group_ad.ad.expanded_text_ad.headline_part1,
    ad_group_ad.ad.expanded_text_ad.headline_part2,
    ad_group_ad.ad.responsive_search_ad.headlines,
    ad_group_ad.status,
    ad_group_ad.policy_summary.approval_status
  FROM ad_group_ad
  WHERE ad_group_ad.status != 'REMOVED'
    AND campaign.status != 'REMOVED'
  ORDER BY campaign.name, ad_group.name
`;

const rows = await queryAds(adsClient, ADS_CUSTOMER_ID, query);

// Filter to those with /book in final URLs
const bookAds = rows.filter(row => {
  const urls = row.ad_group_ad?.ad?.final_urls || [];
  return urls.some(url => url.toLowerCase().includes('/book'));
});

console.log(`Total ads checked: ${rows.length}`);
console.log(`Ads with /book in final URL: ${bookAds.length}`);

if (bookAds.length === 0) {
  // Show all unique final URL patterns to help identify what's there
  const urlSet = new Set();
  for (const row of rows) {
    for (const url of (row.ad_group_ad?.ad?.final_urls || [])) {
      urlSet.add(url);
    }
  }
  console.log('\nAll final URLs found in account:');
  for (const url of [...urlSet].sort()) console.log(' ', url);
} else {
  for (const row of bookAds) {
    console.log({
      campaign: row.campaign?.name,
      campaignStatus: row.campaign?.status,
      adGroup: row.ad_group?.name,
      adId: row.ad_group_ad?.ad?.id,
      adType: row.ad_group_ad?.ad?.type,
      adStatus: row.ad_group_ad?.status,
      approvalStatus: row.ad_group_ad?.policy_summary?.approval_status,
      finalUrls: row.ad_group_ad?.ad?.final_urls,
    });
  }
}

// Also check ad group level final URLs and sitelinks
const sitelinkQuery = `
  SELECT
    campaign.name,
    campaign_extension_setting.extension_type,
    extension_feed_item.sitelink_feed_item.final_urls,
    extension_feed_item.sitelink_feed_item.link_text,
    extension_feed_item.status
  FROM extension_feed_item
  WHERE extension_feed_item.extension_type = 'SITELINK'
    AND extension_feed_item.status != 'REMOVED'
`;

try {
  const sitelinkRows = await queryAds(adsClient, ADS_CUSTOMER_ID, sitelinkQuery);
  const bookSitelinks = sitelinkRows.filter(row => {
    const urls = row.extension_feed_item?.sitelink_feed_item?.final_urls || [];
    return urls.some(url => url.toLowerCase().includes('/book'));
  });
  console.log(`\nSitelinks with /book in URL: ${bookSitelinks.length}`);
  for (const row of bookSitelinks) {
    console.log({
      campaign: row.campaign?.name,
      linkText: row.extension_feed_item?.sitelink_feed_item?.link_text,
      urls: row.extension_feed_item?.sitelink_feed_item?.final_urls,
      status: row.extension_feed_item?.status,
    });
  }
} catch (e) {
  console.log('Sitelink check skipped:', e.message);
}
