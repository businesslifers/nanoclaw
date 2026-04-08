# Wiki Log

Chronological record of wiki activity.

## 2026-04-08 | ingest | Ghost Official Documentation (docs.ghost.org)

Source: https://docs.ghost.org/ — 12+ pages read via agent-browser (JavaScript-rendered site).

Pages created:
- `platform/ghost-configuration.md` — config.production.json, required options (url/db/mail), env vars, storage adapters
- `platform/ghost-cli-commands.md` — All CLI commands with usage, ghost-user permissions, common operational patterns
- `platform/ghost-content-api.md` — Endpoints, auth, pagination, v6 limit=all removal, JS client
- `platform/ghost-webhooks.md` — All available events, setup instructions, automation use cases
- `platform/ghost-breaking-changes.md` — v6 changes: limit=all removed, Node v22, MySQL 8 only, AMP removed
- `theme/ghost-theme-structure.md` — Official template hierarchy, required files, contexts, package.json reference
- `theme/ghost-editor-cards.md` — Complete kg-* CSS class reference for all editor card types
- `theme/ghost-routing.md` — routes.yaml: collections, channels, taxonomies, custom routes, redirects
- `theme/ghost-custom-settings.md` — package.json custom settings API, all 5 types, groups, visibility, fonts

Source file saved: `sources/ghost-official-docs-2026-04-08.md`
Index updated with all 9 new pages.

## 2026-04-07 | Phase 1 seed | 6 pages built from workspace sources

Built initial wiki from CLAUDE.md, SPEC.md, DEPLOY_SPEC.md, COMPONENT_SPEC.md, SITE_COLOURS.md, ghost_server.md memory, session history, and agents.json.

Pages created:
- `platform/ghost-overview.md` — Ghost 6.x overview, Lexical format, Admin API auth, JWT patterns, Handlebars quirks
- `platform/digitalocean-infrastructure.md` — Server config, Ghost install pattern, MySQL access, secrets, adding new sites
- `sites/launch-point-golf.md` — launchpointgolf.com status, credentials, custom templates, colour palette, backlog
- `theme/component-library.md` — Full component library, file structure, CSS architecture, design principles
- `theme/deployment-workflow.md` — Builder → Inspector → Deploy workflow, deploy script, rollback procedure
- `troubleshooting/common-issues.md` — 9 resolved issues documented including Inspector regressions, deploy gotchas, Ghost quirks

Gaps noted:
- "Ghost secret valueFormat Bearer vs Ghost JWT" incident referenced in task brief — no specific incident found in session logs; the JWT auth pattern is documented in ghost-overview.md from SPEC.md knowledge
- "DNS resolution monitoring cancelled" incident — not found in session logs; not documented
- Deployment history for launchpointgolf.com is partial (only what's in session summary)
