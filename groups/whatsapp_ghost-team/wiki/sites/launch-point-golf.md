---
title: LaunchPoint Golf
tags: [site, launchpointgolf, golf, active]
updated: 2026-04-07
---

# LaunchPoint Golf

Golf content site. The first live Ghost site in the Lifers network.

## Status

**Active — live at https://launchpointgolf.com**

## Technical Details

| Property | Value |
|----------|-------|
| Domain | launchpointgolf.com |
| Platform | Ghost 6.26.0 (self-hosted) |
| Server | DigitalOcean 170.64.190.155 |
| Install path | `/var/www/launchpointgolf` |
| Admin URL | https://launchpointgolf.com/ghost/ |
| Admin email | support@businesslifers.com |
| MySQL db/user | ghost_lpg |
| Theme | businesslifers-theme (shared) |
| GA4 property | 312678946 |
| GSC property | https://launchpointgolf.com |

## API Integrations

| Integration | Key location | Status |
|-------------|-------------|--------|
| Ghost Admin API | OneCLI: `GHOST_ADMIN_API_LAUNCHPOINTGOLF` | Active — integration name "Ghost Team Deploy" |
| Google Analytics 4 | Property 312678946 | Active |
| Google Search Console | https://launchpointgolf.com | Active |

## Colour Palette

Configured via Ghost Admin → Code Injection → Site Header:

```css
:root {
  --color-text: #091413;
  --color-text-secondary: #091413;
  --color-meta: #091413;
  --color-accent: #408A71;    /* green */
  --color-border: #B0E4CC;    /* light green */
}
```

## Custom Page Templates

Two custom page templates built and deployed:

### Category Guide (`custom-category-guide.hbs`)

For affiliate listicle content (e.g. "Best Golf Rangefinders for 2026"). Features:
- Breadcrumb navigation
- `<p class="guide-section-label">The guide</p>` section marker
- Guide card grid pulling from `#picks`-tagged posts
- Affiliate disclosure footer with standard wording: "A note on our picks..."
- Sidenav suppressed via inline `<style>` block

**Example:** https://launchpointgolf.com/best-golf-rangefinders/

### Partner Feature (`custom-partner-feature.hbs`)

For editorial product features and partner/sponsored content. Features:
- Full-bleed hero image
- Breadcrumb navigation
- Product highlight box
- "More picks" grid (3-up guide-card style, pulls from `#picks`-tagged posts)
- Partner disclosure with wording: "A note on this feature..."
- Sidenav suppressed via inline `<style>` block

**Example:** https://launchpointgolf.com/titleist-vokey-sm10-review/

## Internal Tag System

`#picks` — internal Ghost tag (slug: `hash-picks`, visibility: `internal`). Tag any post with `#picks` to have it appear in the "more picks" grid on Category Guide and Partner Feature pages.

Internal tags do not appear in the public Topics list or sidenav.

Filter syntax: `filter="tag:hash-picks"` (use `{{#get "posts"}}` not `{{#get "pages"}}`)

## Sidenav

The sidenav is currently **inactive** on launchpointgolf.com. It was activated briefly during development (via Code Injection CSS) but caused text clipping at the viewport edge (no left padding). Cleared and moved to backlog pending a proper fix.

Do not reactivate until the sidenav padding issue is resolved and the fix passes Inspector QA.

## Known Issues / Backlog

| Item | Priority | Notes |
|------|----------|-------|
| Sidenav reinstatement | Medium | Needs padding fix + Inspector QA before re-enabling |
| Partner banner decision | Low | Removed from template; waiting on Adam/Raeleen decision on use case |
| WordPress content migration | Pending | Waiting on Adam to export from WP |

## Deployment History

| Date | Change | Commit |
|------|--------|--------|
| 2026-04-06 | CSS housekeeping: overflow-x fix, colour variables, orphaned CSS removal, font stack fix | 5bcc7b1 |
| 2026-04-05 | Category Guide + Partner Feature templates built; sidenav activated then cleared; #picks tag system | — |
| Earlier | Initial theme build, component library, schema markup | — |

## Site-Specific Gotchas

- **Admin API JWT rejected from container** — all write operations run as SSH scripts. See [Ghost CMS Overview](../platform/ghost-overview.md).
- **Ghost restart:** `su - ghost-user -c 'ghost restart --dir /var/www/launchpointgolf'`
- **Code Injection CSS** — currently empty (cleared 2026-04-06). The sidenav snippet was removed; colour overrides are stored in `SITE_COLOURS.md` for reference.

## Related Pages

- [Ghost CMS Overview](../platform/ghost-overview.md)
- [DigitalOcean Infrastructure](../platform/digitalocean-infrastructure.md)
- [Deployment Workflow](../theme/deployment-workflow.md)
- [Component Library](../theme/component-library.md)
