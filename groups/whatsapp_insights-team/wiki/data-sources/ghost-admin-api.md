---
title: Ghost Admin API
tags: [data-source, ghost, email, membership, api]
updated: 2026-04-07
---

# Ghost Admin API

## What It Measures

The Ghost Admin API provides access to membership, newsletter, and content management data for Ghost-platform sites. For the Insights Team, the primary use is tracking audience growth and email engagement.

Current Ghost sites in the network: **Launch Point Golf** (launchpointgolf.com)

## Data Available

| Resource | Key Fields | Use Case |
|----------|-----------|----------|
| Members | total count, `created_at`, email, status | Audience size and growth rate |
| Emails | `email_count`, `opened_count`, `clicked_count`, `open_rate`, `click_rate` | Newsletter engagement |
| Newsletters | name, subscriber count | Newsletter configuration |
| Posts | title, published_at, email stats | Per-post email performance |

## API Access Pattern

**Important:** Do NOT use the `@tryghost/admin-api` npm package — it returns HTTP 400 errors in this environment. Use the manual JWT + HTTPS approach instead.

### Authentication

Ghost Admin API uses short-lived JWT tokens signed with the Admin API key. The key format is `id:secret` where secret is hex-encoded.

```javascript
const fs = require('fs');
const jwt = require('jsonwebtoken');
const https = require('https');

// Read key from file (never hardcode)
const config = JSON.parse(fs.readFileSync('/workspace/global/instance.json', 'utf-8'));
const KEY_FILE = '/workspace/extra/' + config.credentials.paths.ghost_admin_api_key;
const key = fs.readFileSync(KEY_FILE, 'utf8').trim();
const [id, secret] = key.split(':');

// Generate token — valid for 5 minutes
const token = jwt.sign({}, Buffer.from(secret, 'hex'), {
  keyid: id,
  algorithm: 'HS256',
  expiresIn: '5m',
  audience: '/admin/'
});
// Use in header: Authorization: Ghost <token>
```

### Making Requests

```javascript
function ghostFetch(hostname, path) {
  return new Promise((resolve, reject) => {
    https.get(
      { hostname, path: `/ghost/api/admin/${path}`, headers: { Authorization: `Ghost ${token}` } },
      res => {
        let data = '';
        res.on('data', d => data += d);
        res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { resolve({}); } });
      }
    ).on('error', reject);
  });
}

// Total member count
const members = await ghostFetch('launchpointgolf.com', 'members/?limit=1');
const totalMembers = members.meta?.pagination?.total ?? 0;

// New members today
const today = new Date().toISOString().split('T')[0];
const newToday = await ghostFetch('launchpointgolf.com', `members/?filter=created_at:>='${today}'&limit=all`);

// Recent email performance
const emails = await ghostFetch('launchpointgolf.com', 'emails/?limit=5&order=created_at%20desc');
const latest = emails.emails?.[0];
// latest.opened_count, latest.email_count, latest.open_rate, latest.click_rate
```

## Credential Location

- Key file path: `instance.json > credentials.paths.ghost_admin_api_key`
- Base directory: `/workspace/extra/`
- File format: single line, `id:secret` (hex secret)
- If file is missing: report to Adam via `send_message` — do not attempt workarounds

## Known Quirks

- **JWT expiry:** Tokens expire in 5 minutes. Generate a fresh token per session/script run, not per request.
- **`@tryghost/admin-api` package:** Returns HTTP 400 in this environment — use manual JWT approach above.
- **Pagination:** Default limit is 15 records. Use `limit=all` for complete data or `limit=1` + `meta.pagination.total` for count-only queries.
- **Ghost version:** launchpointgolf.com runs Ghost 6.26.0 (as of Apr 2026).
- **Member status:** Members can be `free` or `paid`. Total count includes both. Filter by `status:free` or `status:paid` if segmentation is needed.

## What to Track

For the weekly digest and baselines:
1. **Total member count** — snapshot weekly, track MoM growth rate
2. **New members this week** — leading indicator of growth momentum
3. **Latest email open rate** — benchmark against Ghost industry average (~45%)
4. **Latest email click rate** — engagement beyond open; indicates content quality

## Related Pages

- [Google Analytics (GA4)](google-analytics-ga4.md) — web traffic data for LPG
- [Google Search Console](google-search-console.md) — organic search data for LPG
- [Performance Baselines](../sites/performance-baselines.md) — LPG baseline tracking
- [What We Measure](../methodology/what-we-measure.md) — how Ghost data fits into reporting
