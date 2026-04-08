# Ghost Team Wiki — Index

Knowledge base for Ghost CMS, theme development, publishing workflows, and site operations.

## Platform

- [Ghost CMS Overview](platform/ghost-overview.md) — Ghost 6.x, Lexical content format, Admin API auth, JWT patterns, known quirks
- [Ghost Configuration](platform/ghost-configuration.md) — config.production.json options, mail, database, env vars, storage adapters
- [Ghost CLI Commands](platform/ghost-cli-commands.md) — All CLI commands: install, restart, update, backup, log, doctor
- [Ghost Content API](platform/ghost-content-api.md) — Read-only API endpoints, auth, pagination (v6: no limit=all), JS client
- [Ghost Webhooks](platform/ghost-webhooks.md) — Available events, setup, use cases for automation
- [Ghost Breaking Changes](platform/ghost-breaking-changes.md) — v6: limit=all removed, Node v22, MySQL 8 only, AMP removed
- [DigitalOcean Infrastructure](platform/digitalocean-infrastructure.md) — Server setup, Ghost deployment pattern, MySQL access, secrets storage, adding new sites

## Sites

- [LaunchPoint Golf](sites/launch-point-golf.md) — launchpointgolf.com — active site, credentials, templates, colour palette, known issues

## Theme Development

- [Component Library](theme/component-library.md) — All components, file structure, CSS architecture, Ghost native cards, Handlebars conventions
- [Ghost Theme Structure](theme/ghost-theme-structure.md) — Official template hierarchy, required files, contexts, package.json reference
- [Ghost Editor Cards](theme/ghost-editor-cards.md) — kg-* CSS classes for all editor card types (image, callout, gallery, toggle, etc.)
- [Ghost Routing](theme/ghost-routing.md) — routes.yaml: collections, channels, taxonomies, custom routes, redirects
- [Ghost Custom Settings](theme/ghost-custom-settings.md) — package.json custom settings API (select, boolean, color, image, text)
- [Deployment Workflow](theme/deployment-workflow.md) — Builder → Inspector → Deploy workflow, deploy script, rollback, adding sites

## Troubleshooting

- [Common Issues](troubleshooting/common-issues.md) — Inspector regressions, deploy gotchas, Ghost API quirks, credential security, attachment limitations
