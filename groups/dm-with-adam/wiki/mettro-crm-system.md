# Mettro CRM & Marketing Engine

Last updated: 2026-04-29

## Overview

Raels is building an automated sales and marketing engine for Mettro. The goal: Raels contributes strategy and high-level direction (30+ years of experience); Janet and agent teams handle everything operational.

## The Problem Being Solved

- ClickUp CRM is broken in practice — nobody maintains it, too much manual effort
- Raels runs sales solo and needs automation, not more tools to manage
- Contacts fall through the cracks — warm prospects go cold with no follow-up system
- No business-wide visibility on who they know, when they last spoke, or what contacts need

## CRM System Design

**Slack channel**: `#crm` (C0ASE9FTH9Q) — registered Apr 14. Responds to all messages (no trigger required). Folder: `slack_crm`.

**Full flow:**
`HeyReach (LinkedIn outreach) → Make.com → Contact DB (Janet/#crm) → Apollo.io enrichment → email sequences (platform TBD)`

### Tool Choices & Rationale

| Tool | Role | Why chosen |
|------|------|-----------|
| HeyReach | LinkedIn outreach campaigns | Raels already uses it, familiar |
| Make.com | Connector/automation | **Native HeyReach integration** — clean, no-code connection. n8n not chosen — no native HeyReach node |
| Contact DB / #crm | Janet manages this | Team queries in plain English via Slack |
| Apollo.io | Contact enrichment | Free tier (50 exports/month) — verified emails, LinkedIn data. No Sales Navigator needed (~$130/month saving) |
| Email platform | Sequences & nurture | **TBD** — see Email Platform below |

### Contact Fields
- First name, last name, work phone, mobile, email
- Company info, role, LinkedIn, recent news (enriched)
- Account manager assigned per contact

### Contact Segments
- Prospect, Client, Supplier, Staff

### Features
- Auto-discovers contacts from ClickUp, emails, proposals — no manual entry
- Email monitoring: raeleen@, tracey@, possibly marketing@/info@/hey@/hello@ (Google Workspace) — Raels to confirm full list
- Enriches contacts via Apollo.io + web search
- Monitors activity, flags when touchpoint is due
- Janet flags which email sequence is appropriate; Raels approves before sending (no auto-assignment)
- Daily digest to Raels: 8:30am Brisbane time, Mon–Fri
- Feeds into BriefMate and other channels

### Email Platform — TBD ⚠️

Decision pending. Raels is evaluating:

| Platform | Pros | Cons |
|----------|------|------|
| Brevo | Volume pricing ($9–18/mo), conditional sequences, Make.com integration | Raels hasn't used it before |
| ActiveCampaign | Raels knows it, familiar setup | Expensive, unwanted CRM/pipeline features bundled in |
| Kit | Generous free tier (up to 10k contacts), simple | Less automation power for conditional sequences |
| MailerLite | Simple | Ruled out — insufficient conditional sequence support |

Feature comparison created in ClickUp (Mettro AI doc). Decision to be made by Raels.

## Marketing Engine Plan

### Goals
- 3 new paid advertising clients per month
- 1 high-ticket ($50k+) project every 3 months

### Content Strategy (phased)
1. Blog content first — feeds the new website launch
2. Case studies — runs alongside blog
3. Social media — after blog/case studies established
4. Paid advertising — after website is live with content

**Website go-live target**: End of April 2026 — ⚠️ date has passed (Apr 26); site is still in active copy and content development as of May 2026 (Raels was rewriting homepage and services copy Apr 30)

### Content Team Structure
- **Derek's team** — handles content for Lifers properties (Adam and Raels' personal sites)
- **Mettro's own content team** — Mettro brand only initially; potentially client work later. Luisa (on-staff writer) is key pilot. See also: [mettro-content-team.md](mettro-content-team.md)

### Mettro Services (confirmed Apr 28, full sub-pages Apr 29)

Top-level service categories:
- **Website Design & Development** — WordPress, custom builds
- **Digital Marketing** — Paid advertising (Google/Meta), SEO
- **Support & Maintenance** — Ongoing website support retainers

Main revenue drivers (in order): Paid Advertising, WordPress dev, Website dev, Support & Maintenance

Full sub-pages (all currently live on site):
- Digital Marketing: Google Ads, Meta Ads, Pay Per Click, SEO, Content Marketing, Email Marketing, Marketing Services
- Website Design & Development: Website Design, Website Development, WordPress Development, Custom Integrations, Content Management
- User Experience: User Experience Design, User Interface Design
- Digital Strategy
- Support and Maintenance

### Existing Clients (PPC)
- Carpet One Logan City (flooring) — also a web client (PPC + web)
- QLD Capital (property development loans) — ⚠️ all ads paused Apr 24, 2026 until further notice (see [launchmate-report-format.md](launchmate-report-format.md))
- Haus of Rattan (rattan furniture online)
- La Petite Boudoir (retail/fashion, Shopify) — Google Ads account migrated Apr 2026 from personal Gmail to `lapetitbadra2026@gmail.com`; login in Bitwarden; Adam setting up new account. See also: la-petite-boudoir.md in raels-dm container wiki (not accessible from adam-dm)

### Existing Clients (Web + Digital Strategy)
- **Carpet One Australasia** — group/head office level client (distinct from Carpet One Logan City PPC). Major web and digital strategy engagement. Comprehensive scope: AI conversation tool on the website, product index (so AI can identify stock by supplier), AI-driven fact sheets (auto-generated from supplier data), image generation system (AI alternative to Roomvo), product rating system, website sampling system (Head Office vs Supplier managed), monetisation strategy (supplier listings, Hub pitching model), local SEO, AEO/GEO content strategy. Contact: Liam Barrett (Slack: UVD9STWP5)

### Existing Clients (Web Support)
- **LEAPIN (Leap In!)** — disability plan management organisation; on a web support retainer. Known issues (Apr 28): reCAPTCHA broken, language dropdown not working on mobile. Assigned dev: RJ (not Archie). Font note (Apr 29): Founder Grotesk renders visually smaller than other fonts at the same pixel size — client requested all sign-up form fonts raised to 18px minimum.

## Financial Model

Raels has a 14-month projection spreadsheet (Apr 2026 – May 2027). Key notes:
- Business not currently running at a loss (spreadsheet figures were deliberately wound down)
- Model uses churn rate as a live formula (not hard-coded)
- Growth curve: 3 new PPC clients/month building to ~100 packages over ~2 years

## Lead Flow (Current State)
- All leads currently flow through Raels manually — she vets, meets, closes
- Goal: automate intake and nurture so Raels only touches qualified, ready-to-buy leads

## What Adam Needs to Set Up
- ~~Register `#crm` channel~~ ✅ Done Apr 14
- Set up Gmail API read-only access for contact discovery (multiple addresses — Raels to confirm list)
- Make.com account (Raels confirmed she has one)

## See also

- [team.md](team.md) — Raels' role and contact
- [channel-architecture.md](channel-architecture.md) — channel registration process
