---
title: Ghost Configuration
tags: [platform, configuration, ghost, production]
updated: 2026-04-08
source: https://docs.ghost.org/config
---

# Ghost Configuration

Ghost is configured via JSON files managed by `nconf`. Configuration changes require `ghost restart` to take effect.

## Config Files

| File | Environment | Purpose |
|------|------------|---------|
| `config.production.json` | Production | Live site config |
| `config.development.json` | Development | Local dev config |
| `config.local.json` | Development | Local overrides (git-ignored), merged on top of development |

Location: root of the Ghost install directory (e.g. `/var/www/launchpointgolf/`)

## Required Options

Three options are required in every Ghost install:

### URL

```json
{
  "url": "https://launchpointgolf.com"
}
```

### Database (MySQL for production)

```json
{
  "database": {
    "client": "mysql",
    "connection": {
      "host": "localhost",
      "user": "ghost_lpg",
      "password": "<password>",
      "database": "ghost_lpg"
    }
  }
}
```

Ghost 6.x: MySQL 8 is the only supported production database.

### Mail

```json
{
  "mail": {
    "transport": "SMTP",
    "options": {
      "service": "Mailgun",
      "auth": {
        "user": "postmaster@mg.launchpointgolf.com",
        "pass": "<mailgun-api-key>"
      }
    }
  }
}
```

## Key Optional Settings

### Server

```json
{
  "server": {
    "port": 2368,
    "host": "127.0.0.1"
  }
}
```

### Image Optimization

```json
{
  "imageOptimization": {
    "resize": true,
    "srcsets": true
  }
}
```

### Admin URL

If your admin domain differs from the site domain (e.g. Ghost Pro):

```json
{
  "admin": {
    "url": "https://launchpointgolf.ghost.io"
  }
}
```

### Logging

```json
{
  "logging": {
    "level": "info",
    "rotation": {
      "enabled": true,
      "count": 10
    },
    "transports": ["file"]
  }
}
```

## Environment Variables

ALL config options can be overridden with environment variables — env vars take priority over config files:

```bash
# Simple value
url=https://launchpointgolf.com node index.js

# Nested value — use double underscore
database__connection__host=mysql node index.js
```

## Applying Config Changes

```bash
# After any config.production.json change:
su - ghost-user -c 'ghost restart --dir /var/www/launchpointgolf'
```

## Storage Adapters

By default Ghost uses local file storage. Custom storage adapters (e.g. S3, CloudFront) can be configured:

```json
{
  "storage": {
    "active": "s3",
    "s3": {
      "accessKeyId": "...",
      "secretAccessKey": "...",
      "bucket": "..."
    }
  }
}
```

## Debugging

```bash
# View compiled config output
DEBUG=ghost:*,ghost-config node index.js
```

## Related Pages

- [Ghost CMS Overview](ghost-overview.md)
- [DigitalOcean Infrastructure](digitalocean-infrastructure.md)
- [Ghost CLI Commands](ghost-cli-commands.md)
