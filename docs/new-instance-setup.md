# Setting Up a New Business Unit

This repo is a cloneable template for a multi-team NanoClaw instance. Each clone gets the same team structure (Content, Ghost, Insights, personal assistant) which you then customise for a new business.

## Prerequisites

- Node.js 20+
- [Claude Code](https://claude.ai/download)
- Docker or Apple Container
- A WhatsApp account (or other messaging channel)
- OneCLI installed (`/init-onecli`)

## Step 1: Clone and rename

```bash
git clone <this-repo-url> ~/new-business-name
cd ~/new-business-name
```

## Step 2: Edit instance.json

The central config file is at `groups/global/instance.json`. This is the single source of truth for all instance-specific values. Edit every section:

### instance

```json
"instance": {
  "business_name": "Your Business Name",
  "agent_name": "YourAgentName",
  "business_units": [...]
}
```

### people

```json
"people": {
  "owner": {
    "name": "Your Name",
    "location": "Your City, Country",
    "timezone": "AEST",
    "utc_offset": "+10"
  },
  "co_founders": [...],
  "authors": [...]
}
```

### sites

Replace all site entries with your sites. Each site needs:

```json
{
  "codename": "MY-SITE",
  "domain": "mysite.com",
  "url": "https://mysite.com",
  "platform": "wordpress",
  "ga4_property_id": "123456789",
  "gsc_property": "https://mysite.com",
  "status": "active"
}
```

### infrastructure

Update server details, GitHub org/repo, and SSH keys:

```json
"infrastructure": {
  "ghost_server": {
    "ip": "your.server.ip",
    "provider": "digitalocean",
    "os": "Ubuntu 24.04 LTS",
    "region": "your-region",
    "droplet_size": "s-1vcpu-2gb"
  },
  "github": {
    "org": "your-github-org",
    "theme_repo": "your-theme-repo",
    "theme_dir_name": "your-theme-dir"
  }
}
```

### credentials

Update secret names and host paths to match your infrastructure:

```json
"credentials": {
  "host_secrets_root": "/home/youruser/nanoclaw-secrets",
  "paths": {...},
  "onecli_secret_names": {...}
}
```

### ai_models

Update if using different image generation models. The default Gemini models work for most setups.

## Step 3: Update manifest.json files

Each group's `manifest.json` contains host-specific mount paths and OneCLI secret names. Update these for each group:

| Group | File | What to change |
|-------|------|---------------|
| `whatsapp_content-team` | `manifest.json` | `mounts[].host_path`, `required_secrets[].name` |
| `whatsapp_ghost-team` | `manifest.json` | `mounts[].host_path`, `required_secrets[].name`, `external_dependencies[].path` |
| `whatsapp_insights-team` | `manifest.json` | `mounts[].host_path`, `external_dependencies[].path` |
| `whatsapp_main` | `manifest.json` | No changes needed (uses default config) |
| `whatsapp_raels` | `manifest.json` | No changes needed (general-purpose) |

The `host_path` values must match `instance.json` > `credentials.host_secrets_root` + the relevant subdirectory.

## Step 4: Create credential directories

```bash
# Create the secrets root (matches instance.json > credentials.host_secrets_root)
mkdir -p ~/nanoclaw-secrets/{insights,ghost-team,wordpress}
```

Populate with your credential files:
- `insights/google-service-account.json` — Google service account for GSC + GA4
- `insights/ghost-admin-api-key.txt` — Ghost Admin API key (id:secret format)
- `ghost-team/ssh_id_ed25519` — SSH private key for Ghost server
- `wordpress/wp-sites.json` — WordPress REST API credentials

## Step 5: Set up OneCLI secrets

```bash
onecli secrets create  # Follow prompts for each secret
```

Create secrets matching `instance.json` > `credentials.onecli_secret_names`. After creating each secret, assign it to the relevant agent(s).

## Step 6: Run initial setup

```bash
cd ~/new-business-name
claude
```

Inside Claude Code:
1. Run `/setup` to configure messaging channels and container runtime
2. Run `/add-whatsapp` to connect your WhatsApp account
3. Register each WhatsApp group with the appropriate folder name

## Step 7: Validate

After registering groups, validate the wiring:

```bash
npx tsx scripts/validate-group.ts <group-folder>
```

Run this for each group to catch credential issues before the agent starts.

## Step 8: Customise team CLAUDE.md files

The CLAUDE.md files contain team-specific workflows that reference `instance.json` for values. Review and customise:

- `groups/whatsapp_content-team/CLAUDE.md` — Content pipeline, scoring rubric references, swarm architecture
- `groups/whatsapp_content-team/blog-registry.md` — Editorial voice and style per blog (this is the main file to rewrite for a new business)
- `groups/whatsapp_ghost-team/CLAUDE.md` — Ghost CMS workflows, theme architecture
- `groups/whatsapp_ghost-team/agents.json` — Sub-agent roles and instructions
- `groups/whatsapp_insights-team/CLAUDE.md` — Analytics workflows, reporting schedules
- `groups/whatsapp_raels/CLAUDE.md` — Personal assistant scope (rename for your co-founder)

## Step 9: Start the service

```bash
# Linux (systemd)
systemctl --user start nanoclaw

# macOS (launchd)
launchctl load ~/Library/LaunchAgents/com.nanoclaw.plist
```

## What's reusable vs what needs customisation

| Layer | Reusable? | Notes |
|-------|-----------|-------|
| Team structure (Content, Ghost, Insights) | Yes | Same roles work across business units |
| Agent swarm architecture | Yes | Scout, Quill, Prism, Pixel, Mindy, Press pipeline |
| Scoring rubric, writing spec, GEO strategy | Yes | Generic content quality framework |
| Quality gates and thresholds | Yes | 80/100 text gate, image gate, linking gate |
| Ghost theme architecture | Yes | Clean, content-first theme pattern |
| Inspector QA checklists | Yes | Reusable validation workflow |
| `instance.json` values | No | Sites, people, infrastructure per business |
| `manifest.json` mount paths | No | Host-specific credential paths |
| `blog-registry.md` editorial content | No | Unique voice, audience, niche per blog |
| OneCLI secret names | No | Tied to your credential vault |
