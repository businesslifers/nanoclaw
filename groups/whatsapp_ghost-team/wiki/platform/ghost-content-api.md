---
title: Ghost Content API
tags: [platform, api, content-api, integration]
updated: 2026-04-08
source: https://docs.ghost.org/content-api
---

# Ghost Content API

Ghost's public Content API delivers published content in read-only mode. It can be accessed from anywhere — browsers, servers, external services.

## Base URL

```
https://{admin_domain}/ghost/api/content/
```

For launchpointgolf.com, the admin domain is the same as the site domain.

## Authentication

Content API keys are passed as query parameters:

```
?key={content_api_key}
```

Content API keys are **safe for use in browsers** — they only ever provide access to public data.

**How to get a key:** Ghost Admin → Settings → Integrations → Add custom integration.

## Accept-Version Header

```
Accept-Version: v6.0
```

Use this header to specify the minimum API version to target. Always include for Ghost 6.x.

## Working Example

```bash
curl -H "Accept-Version: v6.0" \
  "https://launchpointgolf.com/ghost/api/content/posts/?key=<key>"
```

## Endpoints

| Verb | Path | Description |
|------|------|-------------|
| GET | `/posts/` | Browse posts |
| GET | `/posts/{id}/` | Read post by ID |
| GET | `/posts/slug/{slug}/` | Read post by slug |
| GET | `/pages/` | Browse pages |
| GET | `/pages/{id}/` | Read page by ID |
| GET | `/pages/slug/{slug}/` | Read page by slug |
| GET | `/tags/` | Browse tags |
| GET | `/tags/{id}/` | Read tag by ID |
| GET | `/tags/slug/{slug}/` | Read tag by slug |
| GET | `/authors/` | Browse authors |
| GET | `/authors/{id}/` | Read author by ID |
| GET | `/authors/slug/{slug}/` | Read author by slug |
| GET | `/tiers/` | Browse membership tiers |
| GET | `/settings/` | Read site settings |

## Browse vs Read

- **Browse** (`/posts/`) — returns a paginated list of resources
- **Read** (`/posts/{id}/`) — returns a single resource

## Pagination

**Ghost 6.x: `?limit=all` has been removed.** Maximum of 100 results per request.

```
?page=1&limit=15    # default
?page=2&limit=100   # max per page
```

To retrieve all posts: paginate through using `page` parameter with delays to avoid rate limits.

## Useful Parameters

```
?filter=tag:golf                 # Filter by field
?include=tags,authors            # Include related data
?fields=title,slug,published_at  # Limit returned fields
?order=published_at desc         # Sort order
?limit=15&page=1                 # Pagination
```

## JavaScript Client

Ghost provides an official JavaScript client:

```bash
npm install @tryghost/content-api
```

```javascript
import GhostContentAPI from '@tryghost/content-api';

const api = new GhostContentAPI({
  url: 'https://launchpointgolf.com',
  key: '<content_api_key>',
  version: 'v6.0'
});

const posts = await api.posts.browse({ limit: 15 });
```

## Important Notes for Ghost 6.x

- `?limit=all` is **removed** — returns max 100 items silently (no error thrown)
- The Content API is **fully cacheable** — safe to call frequently
- Content is returned as HTML (Ghost renders Lexical → HTML before the API response)
- Admin API write operations must be done via SSH scripts on the server (JWT from outside is rejected with 403)

## Related Pages

- [Ghost CMS Overview](ghost-overview.md)
- [Ghost Breaking Changes](ghost-breaking-changes.md)
- [DigitalOcean Infrastructure](digitalocean-infrastructure.md)
