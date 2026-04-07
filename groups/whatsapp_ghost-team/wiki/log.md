# Wiki Log

Chronological record of wiki activity.

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
