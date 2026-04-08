---
title: Ghost Breaking Changes
tags: [platform, versioning, upgrades, breaking-changes]
updated: 2026-04-08
source: https://docs.ghost.org/changes
---

# Ghost Breaking Changes

Reference for backwards-incompatible changes between major Ghost versions. Critical reading before any major version upgrade.

## When to Upgrade

Best practice: upgrade shortly after the **first minor release** of a new major version (e.g. wait for 6.1.0, not just 6.0.0). Bugs and compatibility issues are typically resolved by then, and the team/community is still context-loaded about the changes.

## Ghost 6.0 (Current)

### `?limit=all` Removed from All API Endpoints

**Critical for any integrations, custom themes using `{{#get}}`, or headless setups.**

- `?limit=all` no longer returns all results — it silently caps at 100
- Requesting more than 100 items also caps at 100
- **Fix:** Implement pagination. Add small delays between requests to avoid rate limits.
- Any existing scripts using `limit=all` will silently break (return only 100 items with no error)

### Node.js Version

- **Ghost 6.x requires Node.js v22**
- Node.js v18 (EOL) and v20 are dropped
- Check before upgrading: `node --version`

### MySQL Only

- MySQL 8 is the only supported production database
- SQLite3 is supported in development environments only
- With Node.js v22, SQLite3 requires Python setup tools to install

### AMP Removed

- Google AMP support is completely removed in Ghost 6.0
- No AMP templates, routes, or redirects will function

### Database Schema

- `created_by` and `updated_by` columns removed from all tables
- These properties were unused — check any direct MySQL queries that reference them

## Ghost 5.0

### Mobiledoc Deprecated

- Ghost 5.x introduced the Lexical editor to replace Mobiledoc
- Ghost 6.x: all content is Lexical JSON (see [Ghost CMS Overview](ghost-overview.md))

### Theme Changes (5.0)

- Various theme helper deprecations — run GScan to identify

### API Versioning

- API versioning introduced — use `Accept-Version` header

## Upgrade Path

```bash
# Check current version
ghost --version

# Update Ghost CLI first
sudo npm install -g ghost-cli@latest

# Then update Ghost
su - ghost-user -c 'ghost update --dir /var/www/launchpointgolf'
```

For major version upgrades, review breaking changes for all skipped versions.

## Theme Compatibility

Use GScan before and after upgrading to identify theme compatibility issues:

```bash
gscan /var/www/launchpointgolf/content/themes/businesslifers-theme
```

GScan will flag any deprecated helpers, missing required elements, or compatibility issues.

## Related Pages

- [Ghost CMS Overview](ghost-overview.md)
- [Ghost CLI Commands](ghost-cli-commands.md)
- [Ghost Content API](ghost-content-api.md)
- [Deployment Workflow](../theme/deployment-workflow.md)
