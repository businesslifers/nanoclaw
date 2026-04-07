---
title: Theme Deployment Workflow
tags: [theme, deployment, workflow, github, ssh]
updated: 2026-04-07
---

# Theme Deployment Workflow

## The Rule

**Builder → Inspector sign-off → Deploy. No exceptions.**

Even for small CSS fixes. Inspector must always validate before Deploy ships. This rule was explicitly enforced by Adam after regressions shipped when Inspector was skipped during a fast iteration sprint.

---

## Step 1: Builder

Builder writes and commits theme changes:

```bash
# Make changes in /workspace/group/ghost-theme/
git add <specific files>
git commit -m "feat: add X" # or fix: / style: / refactor:
git push origin main
```

**Builder rules:**
- Commit specific files only — never `git add -A` (risk of committing secrets)
- Always push to GitHub before triggering deploy (deploy script runs `git pull` from GitHub)
- Never commit credentials, tokens, or keys
- No npm dependencies, no build step, no inline styles in HBS templates
- CSS custom properties only — never hardcode hex values

## Step 2: Inspector

Inspector validates all changes before deployment:

### Inspector Checklist

1. **HBS validity** — no broken helpers, unclosed blocks, missing `{{!< default}}`
2. **Context wrappers** — `post.hbs` has `{{#post}}...{{/post}}`, `page.hbs` has `{{#page}}...{{/page}}`
3. **Partial naming** — no partial named after a Ghost built-in helper
4. **CSS variables** — no hardcoded hex colours (exempt: code blocks, KG callout semantic colours)
5. **No inline styles** — except the sidenav-suppression `<style>` block in custom templates (this is intentional — PASS if it matches the exact pattern)
6. **Mobile layout** — checked at 375px, 768px, 1280px
7. **Cross-page regression** — when `screen.css`, `default.hbs`, or any shared partial is modified, Inspector checks ALL page types: homepage, post, tag, and custom templates
8. **Ghost-specific traps** — sidenav only activates on `body.post-template` pages, not globally

### Sidenav suppression pattern (Inspector PASS)

```html
<style>#site-sidenav,.site-sidenav{display:none!important}.site-layout{display:block!important}</style>
```

If this exact pattern appears as the first element in a `custom-*.hbs` file, Inspector marks it PASS — it is intentional.

### What triggers a cross-page regression check

Any change to:
- `screen.css`
- `default.hbs`
- Any partial in `partials/`

Check: homepage, standard post, tag page, and all custom templates.

## Step 3: Deploy

Deploy script location: `/workspace/group/ghost-theme/scripts/deploy.js`

Run with:
```bash
node /workspace/group/ghost-theme/scripts/deploy.js
```

### What the deploy script does

1. SSHs into the server as `root` using `/workspace/extra/ghost-team/ssh_id_ed25519`
2. `git pull` the latest `main` branch into the themes directory
3. `ghost restart` in the Ghost app directory (as `ghost-user`)
4. Reports outcome per site

### Sites array

Configured in `deploy.js` SITES array. Currently:

| Site | Host | Ghost Dir | Theme Dir |
|------|------|-----------|-----------|
| launchpointgolf.com | 170.64.190.155 | /var/www/launchpointgolf | /var/www/launchpointgolf/content/themes |

Add new sites to the SITES array when provisioned.

### Why SSH instead of Admin API

Ghost 6.x **blocks theme uploads via the Admin API** for custom integrations. All deployments use SSH git pull + ghost restart.

### Pre-deploy checklist

- [ ] Changes committed and **pushed to GitHub** (deploy script does `git pull` — if not pushed, server gets old commit)
- [ ] Inspector has signed off
- [ ] SSH key accessible at `/workspace/extra/ghost-team/ssh_id_ed25519`

## Rollback Procedure

Ghost keeps previous versions in `/var/www/<site>/versions/`. To roll back:

```bash
ssh -i /workspace/extra/ghost-team/ssh_id_ed25519 root@170.64.190.155

# Check available versions
ls /var/www/launchpointgolf/versions/

# Roll back theme: check out previous git commit in the themes dir
cd /var/www/launchpointgolf/content/themes/businesslifers-theme
git log --oneline -10
git checkout <previous-commit-hash>

# Restart Ghost
su - ghost-user -c 'ghost restart --dir /var/www/launchpointgolf'
```

For Ghost version rollback (rare): Ghost CLI supports `ghost update --rollback`.

## Deploying to Multiple Sites Simultaneously

When multiple sites are on the same server (as planned), the deploy script iterates the SITES array and processes each in sequence. A failure on one site is reported but does not abort the remaining deploys.

To deploy to a single site only: temporarily comment out other sites in the SITES array, or add a `--site` flag to the deploy script when implemented.

## Adding a New Site to the Deploy Pipeline

1. Provision Ghost on the server (see [DigitalOcean Infrastructure](../platform/digitalocean-infrastructure.md))
2. Add an entry to the `SITES` array in `deploy.js`
3. Confirm `ghost-user` has write access to the themes directory
4. Test with a dry-run SSH before first live deploy
5. Store Ghost Admin API key in OneCLI

## Related Pages

- [Ghost CMS Overview](../platform/ghost-overview.md)
- [Component Library](component-library.md)
- [DigitalOcean Infrastructure](../platform/digitalocean-infrastructure.md)
- [Common Issues](../troubleshooting/common-issues.md)
