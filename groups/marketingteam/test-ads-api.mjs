// Test direct API connection to customer 3366875793 (Carpet One - Redcliffe)
// Uses google-ads-node (gRPC) with service account credentials - no manager/login-customer-id

import { readFileSync, writeFileSync } from 'fs';
import { JWT } from '/workspace/agent/node_modules/google-auth-library/build/src/index.js';
import { grpc } from '/workspace/agent/node_modules/google-gax/build/src/index.js';
import { GoogleAdsServiceClient } from '/workspace/agent/node_modules/google-ads-node/build/src/index.js';

const CUSTOMER_ID = '3366875793';
const OUTPUT_FILE = '/workspace/agent/data/api-test-result.txt';

async function run() {
  const config = JSON.parse(readFileSync('/workspace/agent/credentials/google-ads-config.json', 'utf8'));
  const keyData = JSON.parse(readFileSync(config.serviceAccountKeyFile, 'utf8'));

  // Create JWT auth client with the required Google Ads scope
  const jwtClient = new JWT({
    email: keyData.client_email,
    key: keyData.private_key,
    scopes: ['https://www.googleapis.com/auth/adwords'],
  });

  // Build gRPC credentials from service account
  const sslCreds = grpc.credentials.createSsl();
  const authCreds = grpc.credentials.createFromGoogleCredential(jwtClient);
  const combinedCreds = grpc.credentials.combineChannelCredentials(sslCreds, authCreds);

  // Headers: developer token only, no login-customer-id
  const metadata = new grpc.Metadata();
  metadata.set('developer-token', config.developerToken);

  const client = new GoogleAdsServiceClient({ sslCreds: combinedCreds });

  const query = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status
    FROM campaign
    ORDER BY campaign.name
    LIMIT 50
  `;

  let lines = [];
  lines.push(`Google Ads API Test - Carpet One Redcliffe (Customer ID: ${CUSTOMER_ID})`);
  lines.push(`Date: ${new Date().toISOString()}`);
  lines.push(`Auth: Service account (${keyData.client_email})`);
  lines.push(`Manager login-customer-id: NOT SET (direct access)`);
  lines.push('');

  try {
    const callOptions = {
      otherArgs: {
        headers: {
          'developer-token': config.developerToken,
          // No login-customer-id header
        },
      },
    };

    // searchStream returns page objects; each has a .results array
    const stream = client.searchStream(
      { customer_id: CUSTOMER_ID, query },
      callOptions
    );

    const campaigns = [];
    for await (const page of stream) {
      for (const row of (page.results || [])) {
        campaigns.push(row.campaign);
      }
    }

    lines.push(`SUCCESS - ${campaigns.length} campaign(s) found`);
    lines.push('');
    lines.push('Campaigns:');
    if (campaigns.length === 0) {
      lines.push('  (no campaigns in this account)');
    } else {
      for (const c of campaigns) {
        lines.push(`  ID: ${c.id}  Name: ${c.name}  Status: ${c.status}`);
      }
    }
  } catch (err) {
    lines.push('ERROR - API call failed');
    lines.push('');
    lines.push(`Error type: ${err.constructor?.name || 'Unknown'}`);
    lines.push(`Message: ${err.message}`);
    if (err.code !== undefined) lines.push(`gRPC code: ${err.code}`);
    if (err.details) lines.push(`Details: ${err.details}`);
    if (err.metadata) {
      try {
        const failureKey = Object.keys(err.metadata?.internalRepr || {}).find(k => k.includes('googleadsfailure'));
        if (failureKey) {
          lines.push(`Ads failure metadata key: ${failureKey}`);
        }
      } catch (_) {}
    }
    lines.push('');
    lines.push('Full error:');
    lines.push(String(err));
  } finally {
    await client.close();
  }

  const output = lines.join('\n');
  writeFileSync(OUTPUT_FILE, output);
  console.log(output);
}

run().catch(err => {
  const msg = `FATAL: ${err.message}\n${err.stack}`;
  writeFileSync(OUTPUT_FILE, msg);
  console.error(msg);
  process.exit(1);
});
