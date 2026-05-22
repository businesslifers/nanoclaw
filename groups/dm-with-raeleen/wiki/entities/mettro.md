# Mettro

_Entity: Agency_

## Overview
Mettro is a digital marketing agency. Raels (Raeleen Robertson) is the owner/director. The agency runs a suite of AI-assisted tools and channels under the "Mate" brand (MateSuite).

Founded: 29 August 2001 (24 years as of 2026)

## Key People
- **Raels (Raeleen Robertson)** — Owner/director. Strategic decisions, senior client relationships, account management.
- **Adam** — Technical/ops. Responsible for setting up APIs, infrastructure, channel creation. Does not action ClickUp tasks — never assign tasks to Adam.
- **Tracey** — Day-to-day operations, client correspondence, contact updates.
- **Luisa** — On-staff writer. Main pilot for the #content team.
- **Daina** — Access to tools/systems (e.g. Zoho). Not a developer.
- **Derek** — Has a separate personal/lifer sites team. Provides content spec and docs (article writing standards, researcher workflow). Spec pending.

## Channels (Slack)
| Channel | Purpose |
| --- | --- |
| #clientmate | Client correspondence — drafting emails, ClickUp-based updates |
| #crm | Contact intelligence — automated CRM, daily digest, relationship monitoring |
| #content | Content team — case studies, blog posts, website content |
| #briefmate | Client briefs and project scoping |
| #launchmate | Launch workflows |
| janet-main | Janet's main control channel |

## MateSuite Products
- **BriefMate** — Client brief and project scoping tool
- **ClientMate** — Client correspondence channel
- **PostMate** — Social media scheduling software (separate from #content, out of scope for content team)
- **LaunchMate** — Launch workflows

## Key Tools & Integrations
- **ClickUp** — Project management, SOPs, task tracking, notebooks
- **Semrush** — SEO keyword research
- **WordPress** — Primary CMS for Mettro and most clients
- **Make.com** — Automation connectors
- **HeyReach** — LinkedIn outreach automation
- **Nano Banana 2 / Pro** — AI image generation
- **Apollo.io** — Contact enrichment (free tier, 50 exports/month)
- **Google Workspace** — Email (raeleen@, tracey@, marketing@, support@)

## Timezone
- **Australia/Brisbane (AEST, UTC+10)** — no daylight saving
- All due dates, scheduling, and time calculations must use Brisbane time

## ClickUp Workspace
- Workspace ID: `9003245964`
- Mettro AI doc ID: `8ca58cc-93956`
- Mettro Knowledge Base (wiki mirror): `8ca58cc-94596`
- **Estimates/proposals** live in the **Deals list** — not the Clients list

## Email Drafting Conventions
- Always include a **subject line** in every email draft
- For designed/HTML emails (EDMs): also include a **pre-header**
- For plain emails Raels is sending personally: subject line only (no pre-header needed unless asked)

## Blog Categories (mettro.com.au/articles)

- Website Design & Development
- Website Design *(sub of Website Design & Development)*
- Marketing
- Content Marketing *(sub of Marketing)*
- Digital Marketing *(new — added May 2026)*
- Paid Advertising *(new — added May 2026)*
- WordPress 101
- Copywriting
- Business Strategy
- Technology
- Social Media
- User Experience

**Notes:** No tags — categories only. Tags removed from blog task format (May 2026).

---

## ClickUp Task Presentation
- **Always include the full task URL** when presenting or discussing a task: `https://app.clickup.com/t/{task_id}`
- Never present a task without its link
- **Never assign tasks to Adam** — he does not action ClickUp tasks

## ClickUp Content Conventions
Always use formatted/rendered content — never plain text with raw markdown symbols. Field varies by endpoint:

| Endpoint | Correct field | Notes |
|---|---|---|
| Task descriptions (v2 API) | `markdown_content` | Renders markdown properly |
| Doc pages — PUT/POST (v3 API) | `content` | `markdown_content` saves nothing (silent fail) |
| Comments (v2 API) | `comment` array with `attributes: {"bold": true}` etc. | `markdown_content` returns 400; `comment_text` with `markdown: true` renders as literal symbols |

Never use raw HTML or `content` field for task descriptions.
