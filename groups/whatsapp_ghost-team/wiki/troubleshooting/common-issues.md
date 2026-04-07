---
title: Common Issues & Resolutions
tags: [troubleshooting, bugs, fixes, incidents]
updated: 2026-04-07
---

# Common Issues & Resolutions

## Inspector Skipped → Regressions Shipped

**Incident:** During a fast iteration sprint on the Category Guide and Partner Feature templates, Inspector was skipped multiple times. Two regressions shipped to production:

1. **Logo font went serif** — `font-family: var(--font-serif)` was incorrectly added to `.site-name`. Because `--font-sans` had previously been incorrectly set to include `Georgia, serif` fallbacks, macOS rendered the logo in serif.
   - *Fix:* Removed `font-family: var(--font-serif)` from `.site-name`. Fixed `--font-sans` to pure sans-serif stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`

2. **Sidenav activating on all pages** — Code Injection CSS used `.site-layout` (applied globally) instead of `body.post-template .site-layout` (post pages only). The sidenav appeared on the homepage.
   - *Fix:* Updated Code Injection CSS to scope to `body.post-template .site-layout` and `body.post-template .site-sidenav`

**Adam's response:** "This should never have passed QA."

**Rule established:** Builder → Inspector → Deploy is mandatory, no exceptions. Inspector must run a cross-page regression check whenever shared CSS or partials are modified.

See [Deployment Workflow](../theme/deployment-workflow.md) for the full Inspector checklist.

---

## Deploy Script Path Was Wrong in CLAUDE.md

**Issue:** CLAUDE.md documented the deploy script as `node /workspace/group/deploy.js`. This caused a "Cannot find module" error.

**Fix:** Corrected path is `node /workspace/group/ghost-theme/scripts/deploy.js`

---

## Git Push Missing Before Deploy

**Issue:** Commit was made locally but not pushed to GitHub before running the deploy script. The deploy script runs `git pull` on the server — without a prior `git push`, the server pulled the old commit. The deploy appeared to succeed but the server was running old code.

**Fix:** Always `git push origin main` before running the deploy script.

**Checklist addition:** Pre-deploy checklist now includes "Changes pushed to GitHub" as a mandatory step.

---

## `#picks` Tag Appearing in Topics Sidenav

**Issue:** The `picks` tag was created as a **public** tag. It appeared in the sidenav Topics list on post pages, which was unintended.

**Fix:** Converted to an internal tag via MySQL:
```sql
UPDATE tags
SET name='#picks', slug='hash-picks', visibility='internal'
WHERE slug='picks';
```

Updated template filter from `filter="tag:picks"` to `filter="tag:hash-picks"`.

**Rule:** Use internal tags (prefixed with `#`) for any tag that should not appear in public tag lists. Internal tags have slug `hash-<name>`.

---

## `{{#get "pages"}}` Returning Empty More Picks

**Issue:** The Partner Feature template used `{{#get "pages"}}` to pull "more picks" content. The `#picks`-tagged items were posts (type=`post`), not pages (type=`page`). The query returned nothing.

**Fix:** Changed template to `{{#get "posts" limit="3" filter="tag:hash-picks"}}`.

**Rule:** Posts and pages are separate content types in Ghost. Always use `{{#get "posts"}}` for tagged post content.

---

## Full-Bleed Images Causing Horizontal Scrollbar

**Issue:** Full-bleed CSS technique (`width: 100vw; margin-left: calc(50% - 50vw)`) on `.partner-article-image` caused a horizontal scrollbar on Windows/Linux because `100vw` includes the scrollbar width.

**Fix:** Added `overflow-x: hidden` to the `body` rule in `screen.css`:
```css
body {
  ...
  overflow-x: hidden;
}
```

---

## Sidenav Text Clipping at Viewport Edge

**Issue:** The sidenav grid placed `.site-sidenav` at x:0 with no left padding. On narrow viewport widths, sidenav text was clipped at the viewport edge.

**Interim fix:** Sidenav deactivated on launchpointgolf.com entirely (cleared Code Injection CSS). This resolved the visual issue.

**Status:** In backlog — sidenav reinstatement needs a proper padding fix and full Inspector QA before re-enabling. Do not reactivate until resolved.

---

## Credential Security — Policy and Prevention

**Risk:** Credentials (API keys, passwords, tokens, SSH keys) accidentally committed to a git repository expose secrets permanently. Git history retains files even after deletion.

**Prevention rules in place:**
- Never create credential or config files inside a cloned repo directory
- Before creating any file in a repo, verify it won't be tracked by git
- A `.gitignore` must exist and cover sensitive file patterns before any commit
- Read credentials from `/workspace/extra/` (host-mounted, read-only) and pass as runtime variables — never persist them in repo files
- If credentials are accidentally written to a repo: **stop immediately**, alert Adam via send_message, treat as a security incident requiring review and key rotation

**Credential locations:**
- SSH key: `/workspace/extra/ghost-team/ssh_id_ed25519` (host-mounted, never in repo)
- API keys: OneCLI (injected at runtime)
- MySQL passwords: `config.production.json` on server (read via SSH)

---

## Ghost Admin API JWT Auth Rejected from Container

**Issue:** Generating a Ghost Admin API JWT from outside the server (i.e. from the NanoClaw container) results in a 403 Forbidden response. This affects all Admin API write operations.

**Cause:** Ghost validates JWT origin and rejects tokens generated externally for custom integrations.

**Fix:** All Admin API write operations (post creation, settings updates, tag modifications) must run as SSH scripts executed on the server itself.

**Read operations** (Content API) work fine from anywhere.

See [Ghost CMS Overview](../platform/ghost-overview.md) for auth details and the correct JWT generation pattern.

---

## HTML Attachments Not Received via WhatsApp

**Issue:** Raeleen sent an HTML mockup file via WhatsApp. Only JPG images arrived — no HTML file was received.

**Cause:** NanoClaw/WhatsApp integration processes image attachments only. Non-image file types (HTML, PDF, etc.) are not passed through.

**Status:** Adam investigating NanoClaw capability. Remind in daily reports until resolved.

**Workaround:** Share design mockups as screenshots/images. For structured content, paste HTML directly into the chat message.

---

## Related Pages

- [Deployment Workflow](../theme/deployment-workflow.md)
- [Ghost CMS Overview](../platform/ghost-overview.md)
- [Component Library](../theme/component-library.md)
