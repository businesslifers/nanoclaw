---
title: Ghost CMS Overview
tags: [platform, ghost, cms]
updated: 2026-04-07
---

# Ghost CMS Overview

Ghost is the CMS powering all Lifers content sites. The Ghost Team runs a self-hosted installation on DigitalOcean. See [DigitalOcean Infrastructure](digitalocean-infrastructure.md) for server setup.

## Version

- **Current:** Ghost 6.26.0 (launchpointgolf.com as of 2026-04-07)
- **API version:** v5 (Ghost 6.x)
- **Content format:** Lexical JSON (not HTML — see below)

## Content Format — Lexical

Ghost 6.x stores all post content as **Lexical JSON**, not HTML. This is a critical difference from Ghost 4/5.

### What this means for programmatic content operations

- The `html` field in `PUT /posts/:id` via the Admin API is **silently ignored** — you must send `lexical`
- To write content programmatically: convert HTML → Lexical using `@tryghost/kg-html-to-lexical` (`htmlToLexical()`)
- To read content back as HTML: use `LexicalHtmlRenderer` with `DEFAULT_NODES` from `@tryghost/kg-default-nodes` — without `DEFAULT_NODES`, render output is empty
- Direct MySQL writes must write **both** `lexical` AND the rendered `html` field manually (Ghost doesn't regenerate HTML from MySQL)

## Admin API

### Authentication

Ghost Admin API keys have the format `id:secret`. To call the Admin API, generate a JWT:

```javascript
const [id, secret] = apiKey.split(':');
const token = jwt.sign({}, Buffer.from(secret, 'hex'), {
  keyid: id,
  algorithm: 'HS256',
  expiresIn: '5m',
  audience: '/v5/admin/'
});
// Authorization header: `Ghost ${token}`
```

**Critical:** JWT generated from outside the server container is rejected by Ghost with a **403**. All Admin API write operations must run as SSH scripts executed on the server itself.

### Read vs Write

| Operation | From | Works? |
|-----------|------|--------|
| Content API (read) | Anywhere | ✅ Yes |
| Admin API (read) | Anywhere | ❌ 403 from container |
| Admin API (write) | SSH script on server | ✅ Yes |

### Admin API Limitations (Ghost 6.x)

- **Integration tokens are read-only for `/settings`** — settings writes must use direct MySQL + `ghost restart`
- **Theme uploads via API are blocked** — all deployments use SSH git pull + ghost restart (see [Deployment Workflow](../theme/deployment-workflow.md))

## Content API

Read-only API, works from anywhere with a content API key. Used for fetching published posts, tags, authors for display purposes.

## Ghost CLI Operations

Ghost runs as `ghost-user`, not root. Key commands:

```bash
# Restart (must run as root via SSH, targeting ghost-user)
su - ghost-user -c 'ghost restart --dir /var/www/launchpointgolf'

# Never run `ghost` as root — it refuses with an error
# Never use sudo systemctl restart ghost_* — EACCES on log files
```

## Known Quirks and Limitations

### Handlebars context wrappers (CRITICAL)

Every entry template must wrap content in its context block:
- `post.hbs` → `{{#post}}...{{/post}}`
- `page.hbs` → `{{#page}}...{{/page}}`

Without this, `{{title}}`, `{{{content}}}`, `{{reading_time}}` etc. silently return `undefined`. Ghost renders literal "undefined" text. GScan does not catch this.

### Partial naming conflicts

Never name a partial the same as a Ghost built-in helper (`navigation`, `pagination`, `ghost_head`, `ghost_foot`, `body_class`, `post_class`). Ghost's internal helpers call `templates.execute('<name>')` — a matching partial causes infinite recursion and a fatal stack overflow.

### `{{../helperName}}` in block helpers

Calling a Ghost-registered helper on a parent context using `../` causes a fatal runtime error: `.call is not a function`. Restructure templates to access post data before entering sub-blocks like `{{#primary_tag}}` or `{{#foreach}}`.

### `{{navigation}}` output

`{{navigation}}` renders its own `<ul class="nav">` — always wrap it in `<nav>` or `<div>`, never in `<ul>` or `<li>`.

### Internal tags

Ghost internal tags are prefixed with `#` (e.g. `#picks`). In the database, the slug is stored as `hash-picks`. Filter syntax: `filter="tag:hash-picks"`. Internal tags do not appear in public tag lists or the sidenav Topics list.

### `{{#get "posts"}}` vs `{{#get "pages"}}`

Posts (type=`post`) and pages (type=`page`) are separate content types. Querying `pages` will not return tagged posts. Use `{{#get "posts"}}` to retrieve post-type content.

## Related Pages

- [DigitalOcean Infrastructure](digitalocean-infrastructure.md)
- [Deployment Workflow](../theme/deployment-workflow.md)
- [LaunchPoint Golf Site](../sites/launch-point-golf.md)
- [Common Issues](../troubleshooting/common-issues.md)
