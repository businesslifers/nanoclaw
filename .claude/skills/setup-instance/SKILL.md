---
name: setup-instance
description: Interactive setup wizard for instance.json. Use when cloning this repo for a new business unit or when editing the instance configuration. Walks through business identity, people, sites, infrastructure, credentials, and AI models.
---

# Instance Setup Wizard

Interactive wizard that creates or edits `groups/global/instance.json` — the central config file that all teams reference for instance-specific values (sites, people, infrastructure, credential paths).

**When to use:** After cloning this repo for a new business unit, or when you need to update the instance config (add sites, change infrastructure, update people).

**UX Note:** Use `AskUserQuestion` for multiple-choice questions only. For free-text input (names, domains, IPs), ask in plain text and wait for the user's reply.

## Step 1: Detect existing config

```bash
cat groups/global/instance.json 2>/dev/null
```

**If the file exists:**

AskUserQuestion: "An instance.json already exists. What would you like to do?"

1. **Edit a specific section** — jump to that section
2. **Start fresh** — back up the existing file and create a new one
3. **Add a site** — jump straight to the sites section to add a new entry

**If editing a section**, ask which one:

AskUserQuestion: "Which section do you want to edit?"

1. **Business identity** — name, description, business units
2. **People** — owner, co-founders, authors
3. **Sites** — add, edit, or remove sites
4. **Infrastructure** — server details, GitHub repo, SSH keys
5. **Credentials** — host paths, OneCLI secret names
6. **AI models** — image generation model IDs

Jump to the corresponding step below.

**If starting fresh**, back up first:
```bash
cp groups/global/instance.json groups/global/instance.json.bak
```

Then proceed through all steps in order.

## Step 2: Business identity

Ask in plain text:
- "What is the business name?" (e.g. "Lifers", "Acme Corp")
- "One-line description of the business?" (e.g. "AI-powered content marketing")
- "What name should the agent use?" (e.g. "Derek", "Andy")

AskUserQuestion: "How many business units does this business have?"

1. **1** — single focus
2. **2–3** — a few units
3. **4+** — many units

For each business unit, ask:
- "Business unit name?" (e.g. "Content Marketing Agency")
- "Brief description?" (or "To be configured" if not ready)

Store these values for the final JSON.

## Step 3: People

Ask in plain text:
- "Owner's name?"
- "Owner's location?" (city, country)
- "Owner's timezone?" (e.g. "AEST") and "UTC offset?" (e.g. "+10")

AskUserQuestion: "Are there co-founders with equal authority?"

1. **Yes** — collect co-founder details
2. **No** — skip

For each co-founder:
- "Co-founder's name?" (short name used in chat)
- "Co-founder's full name?" (if different)

AskUserQuestion: "Do you have named content authors?"

1. **Yes** — collect author details
2. **Not yet** — skip, can add later

For each author:
- "Author name?"
- "WordPress User ID?" (number)
- "Which blog codenames does this author write for?" (comma-separated)

## Step 4: Sites

AskUserQuestion: "Do you want to add sites now?"

1. **Yes** — add sites one at a time
2. **Not yet** — create an empty sites array (can add later with `/setup-instance`)

For each site, ask in plain text:
- "Site codename?" (e.g. "MY-BLOG" — uppercase, hyphenated)
- "Domain?" (e.g. "myblog.com")
- "Full URL?" (e.g. "https://myblog.com")

AskUserQuestion: "Platform for [codename]?"

1. **WordPress**
2. **Ghost**

Then:
- "GA4 Property ID?" (numeric, or "skip" if not set up yet)
- "GSC Property?" (usually the URL, or `sc-domain:domain.com`)

If Ghost: "Ghost version?" (e.g. "6.26.0")

AskUserQuestion: "Add another site?"

1. **Yes** — loop
2. **No** — move on

## Step 5: Infrastructure

AskUserQuestion: "Do you have a Ghost/CMS server to configure?"

1. **Yes** — collect server details
2. **No** — use placeholder values

If yes, ask in plain text:
- "Server IP address?"
- "Cloud provider?" (e.g. "digitalocean", "aws", "hetzner")
- "Server OS?" (default: "Ubuntu 24.04 LTS")
- "Region?" (e.g. "syd1", "nyc1")
- "Droplet/instance size?" (e.g. "s-1vcpu-2gb")

Ask:
- "GitHub org or username?" (e.g. "businesslifers")
- "Theme repo name?" (e.g. "ghost-theme")
- "Theme directory name on server?" (e.g. "businesslifers-theme")

AskUserQuestion: "Do you have an SSH key pair for the Ghost team?"

1. **Yes** — ask for the public key and key email
2. **Not yet** — leave blank, can add later

## Step 6: Credentials

Ask in plain text:
- "Host secrets root directory?" (default: `~/nanoclaw-secrets`, expand `~` to full path)

Explain: "Credential files are organised in subdirectories under this root. Each team mounts its subdirectory read-only into its container."

Use these defaults unless the user wants to change them:

```json
"paths": {
  "google_service_account": "insights-creds/google-service-account.json",
  "ghost_admin_api_key": "insights-creds/ghost-admin-api-key.txt",
  "ssh_key": "ghost-team/ssh_id_ed25519",
  "wp_sites_json": "wordpress-creds/wp-sites.json",
  "ghost_sites_json": "ghost-creds/ghost-sites.json"
}
```

AskUserQuestion: "Use the default credential path layout, or customise?"

1. **Use defaults** — proceed
2. **Customise** — ask for each path

For OneCLI secret names, use these defaults:

```json
"onecli_secret_names": {
  "github_token": "GHOST_GITHUB_TOKEN",
  "ghost_admin_lpg": "GHOST_ADMIN_API_LAUNCHPOINTGOLF",
  "pexels_api": "PEXELS_API_KEY",
  "gemini_api": "GEMINI_API_KEY",
  "do_api": "DO_API_TOKEN",
  "namecheap_api": "NAMECHEAP_API_KEY",
  "namecheap_user": "NAMECHEAP_USERNAME"
}
```

AskUserQuestion: "Use the default OneCLI secret names, or customise?"

1. **Use defaults** — proceed
2. **Customise** — ask for each secret name

## Step 7: AI Models

Explain: "Image generation uses Google Gemini models by default. Two models are configured: one for photos (no text) and one for infographics (with text labels)."

AskUserQuestion: "Use the default AI model configuration?"

1. **Yes** — use defaults (recommended)
2. **Customise** — ask for model IDs and endpoint

Defaults:
```json
"ai_models": {
  "image_gen_photo": {
    "name": "Nano Banana",
    "model_id": "gemini-2.5-flash-image",
    "use_case": "Photographic/illustrative images with NO text"
  },
  "image_gen_infographic": {
    "name": "Nano Banana 2",
    "model_id": "gemini-3.1-flash-image-preview",
    "use_case": "Infographics, charts, diagrams, images with text labels"
  },
  "image_gen_endpoint": "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
}
```

## Step 8: Write the config

Assemble the full JSON from all collected values. Write it to `groups/global/instance.json` using the Write tool.

After writing, validate:
```bash
node -e "JSON.parse(require('fs').readFileSync('groups/global/instance.json', 'utf-8')); console.log('Valid JSON')"
```

## Step 9: Summary and next steps

Display a summary of what was configured:
- Business: {name} ({N} business units)
- People: {owner} + {N} co-founders, {N} authors
- Sites: {N} sites ({N} WordPress, {N} Ghost)
- Infrastructure: {provider} server at {ip}
- Credentials: {secrets_root} with {N} OneCLI secrets

Then explain next steps:

1. **Update manifest.json files** — each group's `manifest.json` has host-specific mount paths and OneCLI secret names. Update these to match the new config:
   - `groups/whatsapp_content-team/manifest.json`
   - `groups/whatsapp_ghost-team/manifest.json`
   - `groups/whatsapp_insights-team/manifest.json`

2. **Create credential directories** — run:
   ```bash
   mkdir -p {secrets_root}/{insights-creds,ghost-team,wordpress-creds,ghost-creds}
   ```

3. **Set up OneCLI secrets** — run `onecli secrets create` for each secret

4. **Run `/setup`** — to configure messaging channels and container runtime

5. **Customise team files** — review and edit:
   - `groups/whatsapp_content-team/blog-registry.md` (editorial voice per blog)
   - Group CLAUDE.md files (team-specific workflows)

See `docs/new-instance-setup.md` for the full setup guide.
