---
title: Ghost CLI Commands
tags: [platform, ghost-cli, operations, devops]
updated: 2026-04-08
source: https://docs.ghost.org/ghost-cli
---

# Ghost CLI Commands

Ghost-CLI is the primary tool for installing, configuring, and maintaining a Ghost install. It must always be run as `ghost-user`, not root.

## Install / Update CLI

```bash
sudo npm install -g ghost-cli@latest
```

## Global Flags

```bash
ghost --help          # Usage info
ghost --verbose       # Verbose output for debugging
ghost --version       # Print CLI and Ghost version
ghost --dir <path>    # Run command in a different directory
ghost --no-prompt     # Non-interactive mode
```

## Commands

### ghost install

Installs Ghost in the current directory.

```bash
ghost install \
  --url https://launchpointgolf.com \
  --db mysql \
  --dbhost localhost \
  --dbuser ghost_lpg \
  --dbpass <password> \
  --dbname ghost_lpg
```

### ghost setup

Configures an existing Ghost install (NGINX, SSL, systemd).

```bash
ghost setup
```

### ghost start

Starts Ghost.

```bash
ghost start --dir /var/www/launchpointgolf
```

### ghost stop

Stops Ghost.

```bash
ghost stop --dir /var/www/launchpointgolf
```

### ghost restart

Restarts Ghost. Required after:
- Changes to `config.production.json`
- Changes to `.hbs` template files in production
- Changes to `package.json` in the theme

**Must run as ghost-user:**
```bash
su - ghost-user -c 'ghost restart --dir /var/www/launchpointgolf'
```

Never `ghost restart` as root — it refuses with a permissions error.

### ghost update

Updates Ghost to the latest version.

```bash
ghost update --dir /var/www/launchpointgolf

# Update to a specific version
ghost update 6.x.x --dir /var/www/launchpointgolf
```

**Major updates:** Best done shortly after the first minor release of the new major version (e.g. wait for 6.1.0, not just 6.0.0).

### ghost config

Read or write configuration values.

```bash
# Interactive config setup
ghost config

# Read a value
ghost config url

# Set a value
ghost config url https://launchpointgolf.com
```

Changes via `ghost config` require `ghost restart` to take effect.

### ghost backup

Creates a backup of the Ghost install (content, database, config).

```bash
ghost backup --dir /var/www/launchpointgolf
```

### ghost doctor

Diagnoses common environment problems.

```bash
ghost doctor --dir /var/www/launchpointgolf
```

### ghost ls

Lists all running Ghost installs on the server.

```bash
ghost ls
```

### ghost log

View Ghost log output.

```bash
ghost log --dir /var/www/launchpointgolf
```

### ghost uninstall

Removes Ghost from the current directory (destructive).

## Common Operational Patterns

### After theme changes in production

```bash
# SSH to server, then:
su - ghost-user -c 'ghost restart --dir /var/www/launchpointgolf'
```

Note: In our workflow, `ghost restart` is handled automatically by the deploy script — no need to run manually after a git pull deploy.

### After config changes

```bash
su - ghost-user -c 'ghost restart --dir /var/www/launchpointgolf'
```

### Check Ghost status

```bash
su - ghost-user -c 'ghost status --dir /var/www/launchpointgolf'
```

### Check logs after a failure

```bash
su - ghost-user -c 'ghost log --dir /var/www/launchpointgolf'
```

## Related Pages

- [Ghost Configuration](ghost-configuration.md)
- [DigitalOcean Infrastructure](digitalocean-infrastructure.md)
- [Deployment Workflow](../theme/deployment-workflow.md)
