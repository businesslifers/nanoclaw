---
title: DigitalOcean Infrastructure
tags: [platform, infrastructure, digitalocean, server]
updated: 2026-04-07
---

# DigitalOcean Infrastructure

## Server

| Property | Value |
|----------|-------|
| Provider | DigitalOcean |
| Region | syd1 (Sydney) |
| IP | 170.64.190.155 |
| OS | Ubuntu 24.04 LTS |
| Size | s-1vcpu-2gb (1 vCPU, 2 GB RAM) |
| SSH key email | ghostteam@businesslifers.com |

**SSH access:**
```bash
ssh -i /workspace/extra/ghost-team/ssh_id_ed25519 root@170.64.190.155
```

The SSH key is host-mounted at `/workspace/extra/ghost-team/ssh_id_ed25519` — read-only. Never copy it into `/workspace/group/` or the git repo.

## Ghost Site Layout

```
/var/www/
├── launchpointgolf/       ← Ghost installation
│   ├── config.production.json   ← DB credentials, mail config, URL
│   ├── content/
│   │   ├── themes/
│   │   │   └── businesslifers-theme/   ← active theme (git pull target)
│   │   ├── images/
│   │   └── files/
│   └── versions/
│       ├── 6.25.1/
│       └── 6.26.0/        ← current active version
```

## How Ghost is Deployed on DigitalOcean

Ghost is installed via **Ghost CLI** on a bare Ubuntu droplet. The standard DigitalOcean Ghost 1-click app is NOT used — this is a manual CLI install for more control.

### Installation pattern (for new sites)

```bash
# 1. Update system
apt update && apt upgrade -y

# 2. Install Node.js (Ghost-supported version)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# 3. Install Ghost CLI
npm install -g ghost-cli

# 4. Create site directory
mkdir -p /var/www/<sitename>
chown ghost-user:ghost-user /var/www/<sitename>

# 5. Install Ghost (as ghost-user)
cd /var/www/<sitename>
ghost install --url https://<domain> --db mysql --dbhost localhost \
  --dbuser ghost_<site> --dbpass <password> --dbname ghost_<site>
```

### SSL

Ghost CLI sets up **Let's Encrypt** SSL automatically during install via the `--ssl` flag (or prompts for it). Certbot is managed by Ghost CLI — renewals are automatic.

### Domain configuration

DNS must point to the droplet IP before install. Ghost CLI validates DNS resolution during setup. If DNS hasn't propagated, use `--no-prompt` and configure SSL manually after.

## MySQL

Ghost uses MySQL on the same droplet. Access pattern (no `.my.cnf` stored on disk):

```bash
# From the server — read credentials from Ghost config
printf "[client]\nuser=ghost_lpg\npassword=$(cat /var/www/launchpointgolf/config.production.json | python3 -c \"import sys,json; c=json.load(sys.stdin); print(c['database']['connection']['password'])\")\n" > /tmp/my.cnf
mysql --defaults-file=/tmp/my.cnf ghost_lpg
```

Or inline:
```bash
mysql $(cat /var/www/launchpointgolf/config.production.json | python3 -c "import sys,json; c=json.load(sys.stdin); db=c['database']['connection']; print(f\"--user={db['user']} --password={db['password']} --host={db['host']} {db['database']}\")")
```

## Adding a New Ghost Site

1. **Provision DNS** — point domain A record to `170.64.190.155`
2. **Create database** — `CREATE USER 'ghost_<site>'@'localhost' IDENTIFIED BY '<password>'; GRANT ALL ON ghost_<site>.* TO 'ghost_<site>'@'localhost';`
3. **Install Ghost** — run `ghost install` as `ghost-user` in `/var/www/<sitename>`
4. **Configure colour palette** — paste colour variables into Ghost Admin → Code Injection. See [Site Colours](../theme/component-library.md) for the template
5. **Activate theme** — run deploy script to push the shared theme via git pull
6. **Store API key** — add Ghost Admin API key to OneCLI
7. **Update deploy script** — add site to the `SITES` array in `ghost-theme/scripts/deploy.js`

## Secrets Storage

| Secret | Location | Access method |
|--------|----------|---------------|
| SSH private key | `/workspace/extra/ghost-team/ssh_id_ed25519` | Host-mounted, read-only |
| Ghost Admin API keys | OneCLI (`GHOST_ADMIN_API_LAUNCHPOINTGOLF` etc.) | Injected as headers |
| GitHub token | OneCLI (`GHOST_GITHUB_TOKEN`) | Injected as headers |
| MySQL passwords | `config.production.json` on server | Read via SSH at runtime |

**Never store credentials in `/workspace/group/` or any git-tracked file.**

## GitHub Integration

- Theme repo: `github.com/businesslifers/ghost-theme`
- GitHub org: `businesslifers`
- Machine user: `ghost-builder-bot` (write access to theme repo only)
- Deploy method: SSH → `git pull` from GitHub → `ghost restart`

## Related Pages

- [Ghost CMS Overview](ghost-overview.md)
- [LaunchPoint Golf Site](../sites/launch-point-golf.md)
- [Deployment Workflow](../theme/deployment-workflow.md)
