# New Service Concepts

Last updated: 2026-04-25

A holding page for early-stage service ideas Raels and Adam are developing. Each concept is labelled and self-contained. Raels noted these should also be synced to the ClickUp wiki notebook (9003245964 / 8ca58cc-94596) — flag for BriefMate to action.

---

## Concept 1: AI-Agent SEO / GEO / AEO Service

*Originated: Apr 24–25, 2026 — Raels + Janet brainstorm in raels-dm*

### What is it?

A done-for-you search optimisation service powered by AI agents — covering traditional SEO, Generative Engine Optimisation (GEO, getting content cited in AI answers), and Answer Engine Optimisation (AEO, featured snippets and voice). The agents do the ongoing heavy lifting; one human strategist oversees and handles relationships.

### The product (what clients buy)

- Continuous keyword gap analysis and competitor monitoring
- On-page content optimisation (scan + update cycle)
- Local SEO: Google Business Profile management — posts, updates, Q&A, photo uploads
- Off-page: outreach agent identifies backlink prospects and drafts emails; human approves sends
- Multi-location support (separate GBP + local pages per location)
- Live reporting dashboard showing rankings, traffic, GBP insights, backlink activity
- Monthly strategy review with human strategist

### CMS / access requirements

- **WordPress:** Full API or admin access — agents can read, write, and publish content; robots.txt, meta, schema
- **Shopify:** Similar access via Storefront + Admin API — product descriptions, blog, meta
- **Squishmate (Mettro's own):** Native integration opportunity
- **Google Business Profile:** OAuth / Google API — posts, attributes, Q&A, photos
- Client must explicitly grant CMS access as part of onboarding

### The team (agents + humans)

| Role | Type | Responsibility |
|------|------|----------------|
| Keyword research agent | Agent | Ongoing gap analysis, competitor monitoring |
| On-page agent | Agent | Scans and optimises content continuously |
| Local SEO agent | Agent | GBP posts, updates, Q&A, multi-location management |
| Outreach agent | Agent | Finds backlink prospects, drafts outreach emails |
| Reporting agent | Agent | Pulls rankings, flags changes, builds client reports |
| SEO strategist | Human (1) | Reviews, approves, handles client relationships and edge cases |

### How to sell it

- Position similarly to the paid advertising service: monthly retainer, results-focused, ongoing
- Differentiate on speed and coverage — agents work 24/7 and catch more opportunities than a human-only team
- Key trust message: human strategist oversees all work — not fully automated
- Target clients: existing Mettro clients with websites (WordPress / Shopify / Squishmate preferred)
- Service likely suits clients already running Google Ads — complementary channel

### Open questions / next steps

- [ ] Wireframe / dashboard mockup (Raels to draft; Janet can provide a prompt for this)
- [ ] Pricing model and tier structure
- [ ] Backlink outreach tooling — which API/platform handles the prospect finding?
- [ ] Legal: client CMS access agreement / terms
- [ ] Sync this concept to ClickUp wiki notebook

### Prompt for wireframe mockup (Raels' request)

> Design a wireframe for a live SEO/GEO client dashboard. It should show: overall visibility score (search + AI citation rate), keyword ranking table (position, change, intent), GBP insights panel (views, searches, calls, direction requests), backlink activity feed (new links earned, referring domains), on-page health score (issues flagged, resolved), and a recommendations queue (top 3 actions this week). Style: clean SaaS, data-forward, suitable for a client-facing monthly report view.

---

---

## Concept 2: AI Design Team (Mettro + Business Lifers)

*Originated: Apr 27, 2026 — Raels in #briefmate*

### What is it?

An in-house AI-powered design team handling design, illustration, UX, and UI work for both Mettro (agency) and Business Lifers (personal brand). Raels created a ClickUp task to flesh this out (due Wednesday Apr 30, 8 hrs total, status: to do).

### Scope

- **Design:** Brand assets, campaign graphics, social media visuals
- **Illustration:** Custom illustrations (replacing stock imagery)
- **UX/UI:** Website wireframes, component design, landing pages
- **Clients:** Mettro brand + Business Lifers brand ("Lifeish")

### Tools in consideration

- ChatGPT image generation (already in use for Business Lifers website)
- Media Mate (already in use for blog hero images)
- UX Pin (referenced for layout/wireframing)
- Figma (existing tool — UI/website)

### Status

Early concept. Raels' ClickUp task: flesh out the design team structure, roles, and tooling. Not yet built.

---

## See also

- [mettro-crm-system.md](mettro-crm-system.md) — existing service lines and client list
- [mettro-tools.md](mettro-tools.md) — Squishmate, Media Mate (tools that could integrate)
- [launchmate-report-format.md](launchmate-report-format.md) — paid ads reporting (parallel service)
