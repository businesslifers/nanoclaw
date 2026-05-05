/**
 * Quality score check — all active clients, active keywords only
 * Quality score is keyword-level (Search campaigns only — PMax doesn't have QS)
 * Flagging anything 5 and below
 */

import { readFileSync } from 'fs';
import { JWT } from '/workspace/agent/node_modules/google-auth-library/build/src/index.js';
import { grpc } from '/workspace/agent/node_modules/google-gax/build/src/index.js';
import { GoogleAdsServiceClient } from '/workspace/agent/node_modules/google-ads-node/build/src/index.js';

const CONFIG = JSON.parse(readFileSync('/workspace/agent/credentials/google-ads-config.json', 'utf8'));
const KEY_DATA = JSON.parse(readFileSync(CONFIG.serviceAccountKeyFile, 'utf8'));
const CLIENTS = JSON.parse(readFileSync('/workspace/agent/clients.json', 'utf8'))
  .filter(c => c.active);

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
  try {
    const rows = await queryAds(adsClient, customerId, `
      SELECT
        campaign.name,
        ad_group.name,
        ad_group_criterion.keyword.text,
        ad_group_criterion.keyword.match_type,
        ad_group_criterion.quality_info.quality_score,
        ad_group_criterion.quality_info.creative_quality_score,
        ad_group_criterion.quality_info.post_click_quality_score,
        ad_group_criterion.quality_info.search_predicted_ctr,
        metrics.impressions
      FROM keyword_view
      WHERE ad_group_criterion.status = 'ENABLED'
        AND ad_group.status = 'ENABLED'
        AND campaign.status = 'ENABLED'
      ORDER BY campaign.name
    `);

    // Filter to low QS (≤5) in code
    const lowQS = rows.filter(row => {
      const qs = row.ad_group_criterion?.quality_info?.quality_score;
      return qs && qs > 0 && qs <= 5;
    }).sort((a, b) =>
      (a.ad_group_criterion?.quality_info?.quality_score || 0) -
      (b.ad_group_criterion?.quality_info?.quality_score || 0)
    );

    if (lowQS.length === 0) {
      console.log(`✓ ${client.clientName} — no low quality score keywords (${rows.length} keywords checked)`);
      continue;
    }

    console.log(`\n⚠️  ${client.clientName} — ${lowQS.length} low QS keyword(s) (of ${rows.length} total):`);
    for (const row of lowQS) {
      const qs = row.ad_group_criterion?.quality_info?.quality_score;
      const kw = row.ad_group_criterion?.keyword?.text;
      const match = row.ad_group_criterion?.keyword?.match_type;
      const adEff = row.ad_group_criterion?.quality_info?.creative_quality_score;
      const landingPage = row.ad_group_criterion?.quality_info?.post_click_quality_score;
      const ctr = row.ad_group_criterion?.quality_info?.search_predicted_ctr;
      const impr = Number(row.metrics?.impressions || 0);
      console.log(`  QS ${qs}/10 | "${kw}" [${match}] | Campaign: ${row.campaign?.name} | Ad Group: ${row.ad_group?.name}`);
      console.log(`         Ad relevance: ${adEff} | Landing page: ${landingPage} | Expected CTR: ${ctr} | Impressions: ${impr}`);
    }
  } catch (e) {
    console.log(`✗ ${client.clientName} — error: ${e.message}`);
  }
}
