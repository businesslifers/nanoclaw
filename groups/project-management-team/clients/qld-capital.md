# Client Profile: Queensland Capital (QLD Capital)

> Last updated: 10 July 2026
> Populated by: Raels + Claude
> Status: Active

---

## Instructions for Claude

> This section tells Claude what this document is and how to use it. Do not delete.

### What this is

This is a Mettro client knowledge base. It should contain everything Mettro knows about a client: every project, every issue, how the relationship works, their brand, their tech, their sensitivities, and the working knowledge that lives in the team's heads. The goal is that any Mettro team member can ask Claude anything about this client and get an informed, accurate answer.

This document may be long. That's by design.

This profile is used alongside SOPs from ClickUp and the BriefMate Engine template during task briefing. SOPs live as tasks in the "Template / SOP Library" space in ClickUp. Claude searches for and pulls in relevant SOPs when building briefs for this client.

### What "done" looks like

**Setup mode:** All sections populated from research and team interviews. Interview guide deleted. Status changed to Active. The profile is ready to use in BriefMate sessions.

**Working mode:** The profile stays current. Claude checks for updates at the start of each conversation and flags anything new. The team updates it when things change.

### Before you start (tell the team member this first)

When a team member loads this profile into a conversation, Claude should check the following before doing anything else:

1. **Google Drive access:** Google Drive search is not enabled by default. The team member needs to click the **+ icon** in the chat input area and enable Google Drive as a source. Without this, Claude cannot search Drive for brand guidelines, strategy docs, or any other client files. Tell them to do this before proceeding.

2. **PDF and non-Docs files:** Google Drive search can find and read Google Docs directly, but it cannot open PDFs, images, spreadsheets, or other non-Docs file types stored in Drive. If Claude finds a relevant file that it cannot read (e.g. a brand guidelines PDF), it should tell the team member where the file is in Drive and ask them to either upload it directly into the conversation or add it to the project files so Claude can read it.

### If this profile is already populated (working mode)

This is a live client knowledge base. Use it as context for whatever work is being discussed.

**Step 1: Refresh check (do this at the start of every conversation)**

When this profile is loaded into a new conversation, check for updates before doing anything else. Use the "Last updated" date at the top to know what is new.

1. **ClickUp:** Search for tasks and docs related to this client that have been created or updated since the last profile update date. Look for new projects, status changes, new issues, completed work, and any new notes or comments.
2. **Slack:** Search for recent conversations mentioning this client since the last profile update date. Look for new decisions, issues raised, scope changes, or anything that affects the profile.
3. **Google Drive:** If connected, check for new or updated documents since the last profile update date.
4. **Brief the team.** Summarise what you found: "Since this profile was last updated on [date], here's what's new: [summary]." Flag anything that looks like it should be added to the profile, especially new issues, completed projects, or changes to flags and sensitivities.
5. **Ask whether to update the profile** with the new information, or just use it as context for the current conversation.

**Step 2: Use the profile**

- **Read the Flags and Sensitivities section before doing or suggesting anything.** If you are unsure whether something conflicts with a known flag, ask before proceeding.
- **Reference the Project History** when the team asks about past work, precedents, or how something was handled previously.
- **Check the Issues and Incidents Log** before proposing changes to anything technical or client-facing, in case there is a relevant history.
- If the team shares new information during a conversation that should be in this profile, note it and suggest updating the profile.

### How Mettro works (context for Claude)

Mettro is a full-service digital agency. Small team (6 to 15 people), fully remote, working with mid-size companies, enterprise clients, and government. The work spans web and digital products, marketing and content, branding and design, and strategy and consulting.

**What sets Mettro apart:** Senior people do the work. The team understands clients' businesses, not just their briefs. Straight-talking, no fluff. Moves faster than bigger agencies.

**How the team operates:** Warm, kind, and collaborative. Knowledgeable and confident, but not bulldozers. Before acting, the team talks. They ask. They make sure the right people have had their say before moving.

**How Claude should work with Mettro:**

- **Ask before acting.** The team is experienced and knows their business. Do not run off and do something. Check in first, especially on anything substantive.
- **Be concise.** Short questions, short check-ins. Do not over-explain.
- **Respect the team's knowledge.** Claude is a support tool, not the expert in the room.
- **When unsure, ask.** Clarify before proceeding. Do not assume and run with it.
- **Push back when needed.** Be honest, even if it is not what the team wants to hear. Flag concerns directly and plainly.
- **Match the voice.** Everything Claude writes should sound like it came from a knowledgeable, warm, straight-talking human. Not a bot, not a brand manual.

### Writing and style rules

These apply to everything produced in the context of this client profile and any work that comes from it.

**Language:** Australian English. Spelling, idiom, the lot.

**Tone:** Warm, direct, and human. Confident without being cold. Friendly without being gushing. Get to the point. No long wind-ups. Start with the thing.

**Simplicity:** Short sentences. Simple words. One idea per sentence. Many team members have English as a second language. Write so everyone can follow without guessing.

**Active voice:** "Upload the image" not "The image should be uploaded." "Check the error log" not "The error log should be checked."

**Be specific:** "Set the memory limit to 256M" not "Increase the memory limit." "Send the URL to the project manager" not "Share the URL with the relevant person."

**Formatting:** Avoid excessive structure for simple responses. Only use headings, bullets, or numbered lists when the content genuinely calls for it. When there is a sequence, number it.

**Hard rules (never break these):**
- No em dashes in running prose. Ever.
- Never use "unlock" or "elevate" in any context.
- No buzzwords: "synergy", "ecosystem", "leverage", "disrupt", "game-changer", etc.
- No excessive adjectives or superlatives used as filler. If something earns a strong word, use it once and mean it.
- No more than one exclamation mark per piece, and only if it genuinely earns it.
- No corporate-speak. If it sounds like a press release, rewrite it.

**Client writing specifically:** Should feel like it comes from a real person who knows what they are talking about. Clear, confident, grounded. Says what it means. Nothing generic or interchangeable. Individual client voice preferences (if any) are noted in the Tone of Voice section below.

### Tools and ecosystem

Mettro's tools, for reference when searching or suggesting workflows:

| Tool | Purpose |
|---|---|
| ClickUp | Task management, client work, SOP library |
| Gmail / Google Workspace | Email and enterprise comms |
| Google Calendar | Scheduling and calendaring |
| Google Drive | Document storage, brand assets, strategy docs, client files |
| Bitbucket | Code repository |
| Slack | Internal comms and some client comms |
| Adobe Suite | Design and creative production |
| Canva | Design |

### Security and sensitive information

**Never store passwords, API keys, tokens, or any credentials in this profile.** This document is a knowledge base, not a secrets vault.

It is fine to note *where* credentials are managed (e.g. "Passwords for this client's CMS are stored in Bitwarden" or "API keys are in the team's shared vault"). But the actual values must never appear in this document, and Claude must never surface them in conversation even if found in ClickUp, Slack, or any other source.

If Claude encounters credentials during research, it should note where they were found (so the team can check access is appropriate) but must not include the values in the profile or in any response.

---

## Overview

**What they do:** Qld Capital provides developers, businesses and brokers with no-nonsense finance options that are low on time investment and certain in outcome. As lender direct, they can act as both senior and mezzanine funder, depending on the solution required. Their main stream is development finance, but they also do asset-backed lending (business lending). Mark Adams is the manager of Queensland Capital.

**Industry:** Property and development finance / Non-bank lending

**Size:** SME. Part of the NMG (Northern Management Group) entity. Small team including Mark Adams (principal), Jess Burman (PA), and Charlie Floyd. Don Fleming (former BDM) left the business as of July 2026 — see Key Contacts and Working Notes.

**Relationship summary:** Mettro has worked with QLD Capital for approximately two years, possibly longer. The relationship started when Raels did a LinkedIn reach-out campaign with B2B leads and connected with Mark. After an initial meeting, Mark agreed to a $10,000/month retainer. The work has expanded to cover the full digital marketing stack: website, Google Ads, email campaigns, LinkedIn outreach, reporting, branding, and strategic consulting. Raels holds the primary relationship. The working relationship is close and collaborative, but Mark drives everything. He might say Mettro is responsible for marketing, but in practice he directs the strategy and priorities.

---

## URLs

| Environment | URL |
|---|---|
| Live site | https://www.qldcapital.com.au/ |
| Staging / dev | qcstag.wpengine.com |
| CMS / admin | /wp-admin (WordPress) |
| Analytics | Google Analytics property 342687688 |
| Google Ads | Account 483-764-0439 |
| Google Tag Manager | GTM-WTWS2DK |
| Zoho CRM | https://accounts.zoho.com/ |
| Marketing Calendar | https://docs.google.com/spreadsheets/d/1jaXsy2rgC84eJzi4GPxzXHZex4ZiG9SIsmNBXxhdcdA/edit?gid=0#gid=0 |
| Key Messages | Consolidated into the Marketing Calendar (above). The separate Key Messages spreadsheet is no longer in use. |
| Google Drive (shared) | https://drive.google.com/drive/folders/1CMT40zu06ph3pi_Lv3iW7AXJKMjF6v2u?usp=drive_link |
| Canva artwork | https://drive.google.com/drive/u/1/folders/12l0FG4-jOmdBwuhLeMN3HaWAWir9pMK1 (or via Canva with login) |

---

## Key Contacts

### Client side

| Name | Role | Contact | Notes |
|---|---|---|---|
| Mark Adams | Manager / Principal | manager@qldcapital.com.au | All decisions go through Mark. He approves everything. Does not like jargon. Keep descriptions simple and in lay terms, not overly technical. Averse to new subscriptions — warm him up on anything that costs money. Communicates primarily in the regular marketing meetings. If you really need something outside of meetings, call him. He does not respond well to email for decision-making. |
| Don Fleming | Former BDM (left July 2026) | | No longer with QLD Capital as of July 2026. Previously ran broker and accountant relationships and handled LinkedIn outreach. A new BDM has not yet come onboard — a broker announcement workflow is being built to cover the gap. Do not route approvals or outreach through Don anymore. |
| Jess Burman | PA to Mark Adams | pa@nmgroup.com.au, 0430 398 662 | Works across QC and NMG. Important: the relationship with Jess has changed. Do not harass her or go to her for every little thing. |
| Charlie Floyd | Operations | | Involved in compliance and operational tasks. Best not to involve Charlie in things she's not directly relevant to. |

### Mettro side

| Name | Role | Notes |
|---|---|---|
| Raels (Raeleen Robertson) | Account lead / Strategy | Primary relationship holder. Leads all client communication, strategy, and direction. |
| Tracey | Project coordination / List building | Manages list building, Firmable data, MFAA scraping, task coordination. |
| Daina | Reporting / Website maintenance | Handles weekly QC reporting, monthly website maintenance. |
| Adam Jowett | Google Ads / Strategy | Google Ads performance review and optimisation. |
| Luis | Design | Logo work, Canva templates, website visual changes, Zoho template design. |
| Luisa | Copy / Content | Website copy, email content, Zoho template copy. |
| Archie | Development | Email template tech setup, file linking, WPEngine/WordPress technical work. |

**Communication preferences:** Mark communicates in the regular marketing meetings and by phone when needed. He does not use email for decision-making. Regular marketing meetings — as of Jul 2026, fortnightly — with Mark, Don, and sometimes Charlie. Mettro provides weekly reporting.

**Meeting agenda:** Raels prepares a "Prepare Meeting Agenda for Mark" task each fortnight (top = what Mark wants reviewed, bottom = what Raels needs to review with him, plus carried-over items from last meeting). First instance: [86d3nb0kx](https://app.clickup.com/t/86d3nb0kx), due 23 Jul 2026, 0.5 hr budget. ClickUp's public API doesn't expose native recurrence, so Raels toggles "Repeat every 2 weeks" on the task itself in the ClickUp UI.

**Approval process:** Mark is the final decision maker on everything. Nothing goes live without his sign-off. If you want preliminary feedback before going to Mark, push things through Don first and ask him to have a look.

**Retainer:** $10,000/month. The client owns everything.

---

## Brand

**Brand guidelines location:** Google Drive - Style Guide: https://drive.google.com/drive/u/0/folders/1peRgTphTk0aFebpaC39IoyRikwT6idnO

**Logo files location:** Google Drive - Logo Files: https://drive.google.com/drive/u/0/folders/1nKW4fiAm6QxjJTF4T8zJH6r2ak3HLZQn

### Colours

| Colour | Hex | Usage |
|---|---|---|
| Primary dark navy/teal | #053751 | Primary brand colour. Logo "Q", headings, dark backgrounds. |
| Near black | #151414 | Body text, dark accents |
| Teal mid | #507385 | Secondary teal |
| Dark grey | #313233 | Text, secondary backgrounds |
| Sage/muted green | #9bafb9 | Accent, secondary elements |
| Mid grey | #525455 | Supporting text |
| Light blue-grey | #cdd7dc | Backgrounds, dividers |
| Grey | #737576 | Supporting text |
| Pale blue-grey | #e6ebee | Light backgrounds |
| Mid grey | #a4a7a9 | Borders, subtle elements |
| Deep teal | #1e4b62 | Accent, alternative to primary |
| Light grey | #c8cacb | Backgrounds |
| Pale grey | #e4e5e5 | Light backgrounds |
| Near white | #f6f6f6 | Page backgrounds |

The brand palette uses a cool, corporate palette of navy/teal and greys. No warm colours in the core palette.

### Logos

Logo variants available (all in project files):
- Full logo with wordmark: "QC QLD CAPITAL - PROPERTY & DEVELOPMENT FINANCE" (horizontal)
- Full logo with URL: includes www.qldcapital.com.au
- Icon only: interlocking "QC" letterforms
- Social icon: square format for profile images
- All variants in: positive (dark on light), reverse (white on dark), RGB colour
- File formats: SVG, EPS, PNG, JPG

Notes on logo usage: The QC icon uses interlocking letterforms. The "Q" is in the primary dark teal (#053751), the "C" is in silver/grey. The logo was redesigned during the retainer (task 86cx2pye9, completed Jan 2025).

### Fonts

| Font | Usage | Source |
|---|---|---|
| LEMON MILK | Logo/display headings | Custom/purchased |
| Nunito Sans | All body copy, support text | Google Fonts |

Nunito Sans is available in Light, Regular, Semibold, and Bold weights.

### Tone of voice

QLD Capital's communications should feel professional but approachable. Not corporate-stiff, not casual. Think senior professional talking to another professional about property finance. Clear, confident, grounded. Keep it simple and in plain language. If it sounds like marketing-speak or reads like a brochure, rewrite it.

---

## Products and Services

QLD Capital is a lender direct, providing finance to developers, businesses, brokers, accountants, and business owners. Their core products:

**Development Finance (main stream):** Funding for property developers and builders. This is the primary business. QC can act as both senior and mezzanine funder depending on the solution required. Products include:
- Spec home finance
- Land subdivision loans
- Build on a block or splitter block loans
- Townhouse/unit construction loans

**Asset-Backed Lending:** Business lending secured by assets. A newer product line with its own marketing push (website page, Google Ads campaign, collateral). Key selling point: no servicing requirements, no tax returns needed, fast turnaround (letter of offer within 48 hours of receiving a scenario).

**Key target markets:** Brokers, developers/builders, accountants, and business owners.

**Key messaging by audience:**
- **Brokers:** Letter of offer speed, don't miss the deal, "give us a look too", low effort to submit
- **Developers/Builders:** Solving problems without presales required
- **Accountants:** No servicing/tax returns needed, fast money, asset-backed, property-backed
- **Asset-backed lending:** Lend quickly, no servicing required, no tax returns

**Funded deals:** QLD Capital creates marketing assets for completed deals (e.g. "D00191 BARLOWS HILL", "D00177 ARANA HILLS"). These are used as proof points and announcement emails.

Note: QLD Capital no longer offers bridging finance.

---

## Competitors

| Competitor | URL | Notes |
|---|---|---|
| Pallas Capital | https://www.pallascapital.com.au/ | |
| Funding.com | https://funding.com/ | |
| Bridgit | https://www.bridgit.com.au/ | |
| Crowd Property Capital | https://crowdpropertycapital.com.au/ | |
| Active Property Group | https://activepropertygroup.com.au/ | |
| Trilogy Funds | https://trilogyfunds.com.au/ | |
| Keystone | | Mark referenced Keystone's product guide as a benchmark for quality/readability |

Mark is always looking at competitors. No particular sensitivities about how they are referenced.

---

## Technology and Integrations

| System | Purpose | Notes |
|---|---|---|
| WordPress | CMS | Hosted on WPEngine. Staging at qcstag.wpengine.com |
| WPEngine | Hosting | |
| GoDaddy | Domain registrar | Domain delegation unclear (Mettro or client) |
| Zoho CRM | Lead management, deals pipeline | Single source of truth for leads |
| Zoho Campaigns | Email marketing | Currently used for email workflows. Under review for cold outreach replacement. |
| Google Ads | Paid search | Account 483-764-0439. Campaigns for development finance and asset-backed lending. Local 3-pack/brand protection turned off per Mark's request. |
| Google Analytics 4 | Website analytics | Property 342687688 |
| Google Tag Manager | Tag management | GTM-WTWS2DK |
| Canva | Design templates | Product brochures, email templates, opportunity documents, social assets |
| Firmable | Data/list building | Used for accountant list sourcing. Limited email addresses available. |
| SEMrush | Reporting | Used for reporting |

All credentials are stored in Bitwarden. No tricky access issues.

### WordPress Plugins

21 plugins installed, all active. Documented from wp-admin screenshot 23 March 2026.

| Plugin | Version | What it does |
|---|---|---|
| Create And Assign Categories For Pages | 1.2.1 | Assigns categories to WordPress pages for custom coding/organisation |
| Elementor | 3.35.5 | Page builder. Drag and drop, responsive editing. Required by Elementor Pro. Cannot be deactivated. Update available (3.35.7). |
| Elementor Pro | 3.35.5 | Premium Elementor features: Pro widgets, kits, Theme Builder, Pop Ups, Forms, WooCommerce. Requires Elementor. |
| Genesis Blocks | 3.1.8 | Collection of blocks for the WordPress editor. By StudioPress. |
| Gravity Forms | 2.9.28 | Web forms. Core form builder. Update available (2.9.30). |
| Gravity Forms reCAPTCHA Add-On | 2.1.0 | Google reCAPTCHA support for Gravity Forms |
| Gravity Forms Zoho CRM Add-On | 2.4.0 | Integrates Gravity Forms with Zoho CRM. Form submissions auto-sent to Zoho. |
| GreyboxPro | 2.2.06 | WordPress website kit for designers. By Mettro. |
| GTM4WP (Google Tag Manager for WordPress) | 1.22.3 | Google Tag Manager integration plugin |
| Mailtrap for WordPress | 0.7 | Configures WordPress to send emails via Mailtrap.io |
| Post Duplicator | 3.0.10 | Duplicates posts, pages, post types, taxonomies, and custom fields. Update available (3.0.13). |
| PowerPack Pro for Elementor | 2.12.17 | 90+ creative widgets and extensions for Elementor |
| Stratum Mega Menu | 1.0.5 | Advanced Elementor addon for mega menus |
| SVG Support | 2.6.14 | Upload SVGs to Media Library, inline rendering for CSS/JS styling |
| Temporary Login Without Password | 1.9.7 | Creates temporary login links with role-based access for limited time |
| Wordfence Security | 8.1.4 | Security: anti-virus, firewall, malware scan |
| WordPress Backup & Security Plugin (BlogVault) | 6.36 | Backup and security |
| WordPress Importer | 0.9.5 | Imports posts, pages, custom fields, categories, tags from WordPress export files |
| WPCode Lite | 2.3.4 | Code snippets in header/footer, conditional logic, ads pixel, custom content. Update available (2.3.5). |
| Yoast SEO | 27.0 | SEO: on-page content analysis, XML sitemaps. Required by Yoast SEO Premium. Update available (27.2). |
| Yoast SEO Premium | 27.0 | Premium SEO features. Auto-updates disabled (based on Yoast SEO setting). Update available (27.2). |

**Notes:** 6 plugins have updates available. Auto-updates are disabled on all 21 plugins. Yoast SEO Premium has a notification to update.

---

## Project History

### Don Fleming Departure Announcement -- In Progress

**Dates:** July 2026
**Scope:** Don Fleming (BDM) left QLD Capital after six-plus years. Build a Zoho workflow to announce the departure to brokers who have closed deals with Don, sent from lending@ and signed off as Mark Adams. Drip-fed across Jess's list (~1,000+ contacts) to avoid Zoho spam thresholds, with a 6-month wait step at the end so the workflow can be revisited once a new BDM comes onboard.
**What was delivered:** Task scoped, priority urgent, due Monday 13 July 2026.
**Outcome:** In progress.
**Notes:** No new BDM in place yet as of July 2026. See Working Notes and Key Contacts.

---

### New BDM Introduction Email -- To Do

**Dates:** July 2026
**Scope:** A new BDM is replacing Don Fleming. Draft an intro email in the style of a sample Raels supplied from "Zolve" (another lender's BDM intro), with QLD Capital wording/products, sent first to existing customers (incl. everyone Don interacted with + campaign interactions), then drip-fed to the wider database.
**What was delivered:** Task created ([86d3naddg](https://app.clickup.com/t/86d3naddg)), due 17 July 2026, assigned Raels + Tracey, 2 hr budget (not split per-person).
**Outcome:** In progress. New BDM's name not yet confirmed -- placeholder in the draft. Rate/LVR/fee details to come from Raels via Mark. Sending address (BDM's own email vs lending@) still to be decided -- Raels weighing up domain warm-up needs. Send segment to be confirmed with Jess/Mark, distinct from the Don departure list.
**Notes:** Once the new BDM's name is confirmed, update Key Contacts below.

---

### Email System Overhaul -- Pending Approval

**Dates:** March 2026, pending
**Scope:** Replace Zoho Campaigns for cold outreach with dedicated deliverability tools. Fix domain health, set up new outreach domain, migrate all 8 email workflows to plain text, staggered sends.
**What was delivered:** Research and recommendations completed. Client-facing recommendations document drafted and pushed to ClickUp Notebook ("New Email System 12 March 2026"). Dev task list for domain health audit created.
**Outcome:** Mark has not approved this yet. He wants to hold and get everything right first before proceeding. Awaiting his go-ahead.
**ClickUp reference:** [86d270x8h](https://app.clickup.com/t/86d270x8h)
**Notes:** Key stats from the research: HTML emails have 652% higher bounce rate than plain text. Plain text generates 30-42% more clicks. Images drop open rates by 23-37%. All cold outreach emails should be run through a spam trigger checker before sending, particularly given finance-industry vocabulary. A new lookalike domain (e.g. qldcapitalgroup.com.au) is recommended for all outreach, with 3-5 mailboxes on Google Workspace or M365.

---

### Remove Outdated Compliance References -- Complete

**Dates:** 18 March 2026
**Scope:** Remove outdated compliance references from website, documents, and Zoho templates.
**What was delivered:** Task created and assigned to Luis (design) and Luisa (copy). Priority order: website first, then Canva documents, then Zoho templates.
**Outcome:** Complete.
**ClickUp reference:** [86d2b7xhe](https://app.clickup.com/t/86d2b7xhe)

---

### Reporting Rebuild -- In Progress

**Dates:** Late 2025, ongoing
**Scope:** Fundamentally rebuild how Mettro reports to QLD Capital. Move from manual spreadsheet-based reporting to Zoho CRM as single source of truth for leads.
**What was delivered:** Reporting brief written (in QC Notebook). Client feedback documented. Spreadsheet cleaned up and automated. Lead definition clarified with Mark: only form fills count as leads.
**Outcome:** Partially complete. Spreadsheet has been cleaned and automated. Deeper attribution setup (call tracking, UTM tracking, dedicated email addresses) still to be implemented. Mark decided against CallRail for now.
**ClickUp reference:** [86d1pjwvu](https://app.clickup.com/t/86d1pjwvu), [86d2aew01](https://app.clickup.com/t/86d2aew01)
**Notes:** Core problem was that what Mettro called a lead and what Mark called a lead were not the same. Resolved: Mark considers only form fills as leads. Google Ads and Analytics report activity/intent only, not leads. Zoho vs GA reporting mismatch needs investigation. Cost Per Lead calculation needs review.

---

### Google Ads Performance Review + Optimisation -- In Progress

**Dates:** January 2026, ongoing
**Scope:** Review Google Ads performance, double down on what works, fix or replace what doesn't.
**What was delivered:** Local 3-pack/brand protection campaigns turned off per Mark's request (consuming budget with no perceived value). Review of top-performing ads underway.
**Outcome:** In progress. Adam Jowett leading.
**ClickUp reference:** [86d1pj4zh](https://app.clickup.com/t/86d1pj4zh)
**Notes:** Mark felt some ads were actually working well. Task is to identify top performers and optimise around them. Includes asset-backed lending campaigns.

---

### LinkedIn Outreach (Don Fleming) -- In Progress

**Dates:** Late 2025, ongoing
**Scope:** Set up LinkedIn outreach campaign for Don targeting brokers.
**What was delivered:** Task created. Proceeding without "known brokers" suppression list (Don approved).
**Outcome:** In progress. Tool decision made but setup not yet active.
**ClickUp reference:** [86cxvc822](https://app.clickup.com/t/86cxvc822)

---

### Website Updates -- In Progress

**Dates:** Ongoing
**Scope:** Various website changes: homepage alterations, privacy policy page, terms of service page, contact form updates, content review.
**What was delivered:** Privacy policy and terms of service pages built, need connecting to footer. Homepage alterations in progress. Content review deferred to later in 2026.
**Outcome:** Multiple items in various stages.
**ClickUp references:** [86d270meg](https://app.clickup.com/t/86d270meg) (Homepage), [86d1ya61d](https://app.clickup.com/t/86d1ya61d) (Privacy Policy), [86d1ya73x](https://app.clickup.com/t/86d1ya73x) (ToS), [86d270vac](https://app.clickup.com/t/86d270vac) (Forms), [86d0n3w3c](https://app.clickup.com/t/86d0n3w3c) (Content Review)
**Notes:** Monthly website maintenance handled by Daina.

---

### QC Video Ads -- On Hold

**Dates:** 2025, on hold
**Scope:** Produce AI-style video ads with tailored messaging by audience (brokers, developers, accountants, asset-backed lending).
**What was delivered:** Task scoped with messaging directions per audience.
**Outcome:** On hold until reporting is fixed.
**ClickUp reference:** [86d1kb3my](https://app.clickup.com/t/86d1kb3my)
**Notes:** Raels has notes in iFlyTek notebook on messaging per audience.

---

### Product Guide Update -- In Progress

**Dates:** Late 2025, ongoing
**Scope:** Rework the QLD Capital product guide / rate card. Make it cleaner, more readable, better CTA.
**What was delivered:** Design changes scoped: remove name/title block, reduce phone/email space, add toll-free number, make "Send us a scenario... letter of offer within 48 hours" stand out (dark reversed, larger), replace top image with corporate visual.
**Outcome:** Awaiting Don's updated table content.
**ClickUp reference:** [86d0nqwma](https://app.clickup.com/t/86d0nqwma)
**Notes:** Mark referenced Keystone's product guide as a benchmark for readability.

---

### Accountants List Building -- In Progress

**Dates:** Ongoing
**Scope:** Build email list of accountants for outreach campaigns.
**What was delivered:** Firmable data pulled but limited email addresses available. MFAA website scrape completed (task 86d18nzqq, in client review). Nouman being used for additional list building.
**Outcome:** In progress. Exploring whether Firmable contacts without emails can be sent to Nouman for enrichment.
**ClickUp reference:** [86cyu2ma6](https://app.clickup.com/t/86cyu2ma6)
**Notes:** 100 accountants per month from Firmable was the cadence.

---

### Asset Backed Lending Marketing -- Complete

**Dates:** Mid-2025, completed
**Scope:** Full marketing push for the new Asset Backed Lending product: website page, Google Ads campaign, product brochure, market research.
**What was delivered:** Website page, Google Ads campaign, product brochure, market research PDF, key messaging.
**Outcome:** Launched successfully. Ongoing optimisation via Google Ads.
**ClickUp reference:** [86cy3p8qw](https://app.clickup.com/t/86cy3p8qw)

---

### Logo Redesign -- Complete

**Dates:** Late 2024 / early 2025
**Scope:** Redesign the QLD Capital logo.
**What was delivered:** New QC interlocking letterform logo in all variants.
**Outcome:** Complete. New logo in use across all channels.
**ClickUp reference:** [86cx2pye9](https://app.clickup.com/t/86cx2pye9)

---

### Email Deliverability Investigation (original) -- Complete

**Dates:** 2024
**Scope:** Investigate email deliverability issues with Zoho Campaigns.
**What was delivered:** Research completed. Spam trigger words documented. Email system comparisons done.
**Outcome:** Led to the current email system overhaul discussion.
**ClickUp reference:** [86cv8974g](https://app.clickup.com/t/86cv8974g)

---

### Construction Finance Email Template -- Complete

**Dates:** Late 2024
**Scope:** Create a new email template for the construction finance product.
**Outcome:** Complete.
**ClickUp reference:** [86cwvb2xb](https://app.clickup.com/t/86cwvb2xb)

---

### LinkedIn Video Ad -- Complete

**Dates:** Late 2024
**Scope:** Create a LinkedIn video ad for QLD Capital.
**Outcome:** Complete.
**ClickUp reference:** [86cwn7fny](https://app.clickup.com/t/86cwn7fny)

---

### Lead Generation Campaign -- Complete

**Dates:** 2025
**Scope:** Lead generation work for QLD Capital.
**Outcome:** Complete.
**ClickUp reference:** [86cy3py09](https://app.clickup.com/t/86cy3py09)

---

### Lending Product Guide / Rate Card -- Complete

**Dates:** 2025
**Scope:** Create the rate card / lending product guide.
**Outcome:** Complete. Now being updated again (see Product Guide Update above).
**ClickUp reference:** [86czkw7bx](https://app.clickup.com/t/86czkw7bx)

---

## Issues and Incidents Log

### Email Deliverability Problems -- Under Discussion

**What happened:** Cold email campaigns sent through Zoho Campaigns on shared IP to a scraped list have been landing in spam. Combined with shared IP, HTML template emails, and finance-industry trigger words, deliverability suffered.
**Impact:** Significant number of campaign emails going to spam. Marketing effectiveness reduced for email channel.
**How it was resolved:** In discussion. Full email system overhaul recommended but not yet approved by Mark.
**Current status:** Awaiting Mark's approval to proceed. He wants to get everything right first.
**Lessons:** All email copy should be run through a spam trigger checker before sending, particularly with finance vocabulary. Plain text outreach performs significantly better than HTML for cold sends.
**Source:** Conversation transcript (11-12 March 2026), ClickUp task 86cv8974g, 86d270x8h

---

### Reporting Trust Breakdown -- Resolved (partially)

**What happened:** Mark didn't trust the numbers in Mettro's weekly reports. Leads in the spreadsheet didn't match deals in Zoho. Google Analytics traffic spikes looked suspicious. The definition of "lead" was misaligned.
**Impact:** Client lost trust in reporting. Significant internal effort spent investigating and rebuilding the report.
**How it was resolved:** Lead definition clarified (form fills only). Spreadsheet cleaned and automated. Zoho CRM established as single source of truth for leads.
**Current status:** Partially resolved. Core reporting is cleaner. Deeper attribution deferred.
**Lessons:** Align definitions with the client before building reports. "Lead" must mean the same thing to everyone. Automate everything.
**Source:** ClickUp QC Notebook, January 2026 meeting minutes

---

### Compliance Reference Removal -- Complete

**What happened:** Outdated compliance references needed urgent removal from website, documents, and email templates.
**Impact:** Compliance issue. Affected website footer, investment documents, and email templates.
**How it was resolved:** Task created (86d2b7xhe). Assigned to Luis and Luisa with urgent priority.
**Current status:** Complete.
**Source:** Client email 18 March 2026

---

### Google Analytics Traffic Suspicion -- Monitoring (low priority)

**What happened:** Mark flagged suspicious traffic spikes in Google Analytics. He doesn't believe the numbers reflect real visitors.
**Impact:** Client distrusts analytics reporting.
**How it was resolved:** GA validation task created (86d1pjuw2). Bot filtering investigation initiated.
**Current status:** Ongoing, but it's more of an annoyance than a priority. Not worth spending significant time on.
**Source:** January 2026 meeting minutes

---

## Flags and Sensitivities

- **Mark approves everything.** Nothing goes live without his sign-off. No exceptions. If you want preliminary feedback, push it through Don first.
- **Keep it simple.** Mark does not like jargon or overly technical descriptions. Explain everything in lay terms. If it sounds like marketing-speak, rewrite it.
- **Lead definition is settled: form fills only.** Do not count phone clicks, email clicks, or page views as leads. Do not reopen this discussion.
- **Mark is averse to new subscriptions.** Any recommendation involving additional software costs needs to be warmed up carefully. Don't spring new costs on him.
- **Don't harass Jess.** The relationship with Jess has changed. Do not go to her for every little thing.
- **Don't involve Charlie unnecessarily.** Only loop Charlie Floyd in on things she's directly relevant to.
- **Run all email copy through a spam trigger checker.** Finance vocabulary (investment, returns, capital, profit, financial) flags spam filters. Any email should be checked before it goes out.
- **Conversion tracking is important for Google Ads.** Any changes to tracking scripts, GTM, or form setups need careful testing.
- **The Zoho CRM data belongs to the client.** We report on it but don't own it. If there's a mismatch, the client's data wins.
- **Mark drives the marketing.** He might say Mettro is responsible, but he directs strategy and priorities. Work with that, not against it.

---

## Working Notes

Mark Adams runs QLD Capital as part of NMG (Northern Management Group). He's a dealmaker, not a marketer. He cares about results (new deals coming in) and doesn't care about the mechanics of how marketing works. He wants to know: is it working, what did it cost, and what do I need to do. Everything else is noise.

Don Fleming left QLD Capital in July 2026 after six-plus years as BDM. He was the boots on the ground with brokers, accountants, and developers, and the go-to for preliminary approval before things went to Mark. There is no BDM in place yet. Until a new BDM comes onboard, route what would have gone to Don to Mark directly. A broker departure-announcement email and Zoho workflow are being built (July 2026) with a 6-month wait step so the workflow can be revisited once the new BDM starts.

Jess Burman is PA to Mark Adams. She handles admin and access requests, but the working relationship has changed. Do not go to her for everything. Be respectful of her time and role boundaries.

Charlie Floyd handles compliance and operational matters. Keep her involvement focused on things she needs to be across.

The QC marketing meetings are where decisions happen. Raels runs them. The attendees are typically Don, Mark, and sometimes Charlie.

The biggest win with this client has been getting traction on the Zoho workflows and the marketing system that Mark wants to build. The email system overhaul and reporting rebuild are both in service of that broader goal.

Mark values the relationship with Mettro but is not sentimental about it. He wants value for money and clear results.

There is a Trello board that predates the ClickUp migration. Some older task references point to Trello URLs. The Trello board is legacy.

---

## ClickUp Reference IDs

| Item | ID |
|---|---|
| QC Retainer list | 901602099641 |
| QC folder | 90161329473 |
| QC Notebook doc | 8ca58cc-27836 |
| Client Status custom field | c1ccd100-7903-4b04-b549-95a35e416f2f |
| Labels custom field | c70a6709-b473-47cd-89f5-bbac1d10de0f |
| Internal label UUID | d5865c83-155e-4b4b-9d01-bbbf59967f01 |

---

## Source Log

| Section | Source | Date |
|---|---|---|
| Overview, URLs, contacts, hosting | ClickUp QC Notebook "Overview" page | Apr 2024 |
| Overview corrections, products, relationship | Raels interview | Mar 2026 |
| Brand colours | Uploaded PDF: Qld-Capital-logo-colour-palette.pdf | Mar 2026 |
| Brand fonts | Uploaded PDF: Qld-Capital-logo-and-identity.pdf | Mar 2026 |
| Logo files | Uploaded to Claude project files | Mar 2026 |
| Conversion tracking | ClickUp QC Notebook "Conversion Setup / Update Brief" | Apr 2024 |
| Reporting brief | ClickUp QC Notebook "Qld Capital Reporting - Brief & Next Steps" | Jan 2026 |
| Reporting client feedback | ClickUp QC Notebook "Reporting Client Feedback" | Feb 2026 |
| Email system recommendations | ClickUp QC Notebook "New Email System 12 March 2026" | Mar 2026 |
| Meeting minutes (most recent) | ClickUp QC Notebook "23/01/2026 Meeting Minutes" | Jan 2026 |
| Email deliverability research | Conversation transcript (exported to project) | Mar 2026 |
| Project history (all tasks) | ClickUp search across QC Retainer list | Mar 2026 |
| Compliance reference removal | Client email chain + conversation transcript | Mar 2026 |
| WordPress plugins | wp-admin screenshot | Mar 2026 |
| Competitors | ClickUp QC Notebook "Overview" page | Apr 2024 |
| Key Messages consolidation | BriefMate session with Raels | Mar 2026 |
| Email copy SOP created | BriefMate session, ClickUp task 86d2ec72c | Mar 2026 |
| Profile imported from PDF | Raels via Slack | Apr 2026 |

---

## Open Questions

- [ ] What work does Mark value most from Mettro?
- [ ] Are there any areas Mark has asked about that Mettro hasn't done yet?
- [ ] Are there any topics or approaches that make Mark uncomfortable beyond what's documented?
- [ ] Beyond the brand guidelines, anything about how QC wants to sound that isn't written down?
- [ ] If someone new at Mettro picked up this client tomorrow, what's the one thing they need to know?

---

*Version: 2.2*
*Created: March 2026*
*Owner: Raels*
