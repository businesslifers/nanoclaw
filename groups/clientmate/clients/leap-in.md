# Client Profile: Leap in!

> Last updated: 25 March 2026
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

1. **ClickUp:** Search for tasks and docs related to this client that have been created or updated since the last profile update date.
2. **Slack:** Search for recent conversations mentioning this client since the last profile update date.
3. **Google Drive:** If connected, check for new or updated documents since the last profile update date.
4. **Brief the team.** Summarise what you found. Flag anything that should be added to the profile.
5. **Ask whether to update the profile** with the new information, or just use it as context for the current conversation.

**Step 2: Use the profile**

- **Read the Flags and Sensitivities section before doing or suggesting anything.**
- **Reference the Project History** when the team asks about past work.
- **Check the Issues and Incidents Log** before proposing changes to anything technical or client-facing.

### How Mettro works (context for Claude)

Mettro is a full-service digital agency. Small team (6 to 15 people), fully remote, working with mid-size companies, enterprise clients, and government.

**How Claude should work with Mettro:**
- Ask before acting.
- Be concise.
- Respect the team's knowledge.
- When unsure, ask.
- Push back when needed.
- Match the voice.

### Writing and style rules

**Language:** Australian English.
**Tone:** Warm, direct, and human.
**Hard rules (never break these):**
- No em dashes in running prose. Ever.
- Never use "unlock" or "elevate" in any context.
- No buzzwords: "synergy", "ecosystem", "leverage", "disrupt", "game-changer", etc.
- No corporate-speak.

---

## Overview

**What they do:** Leap in! is an NDIS plan management provider. They help National Disability Insurance Scheme participants manage their funding, pay providers, and get the most out of their plans.

**Industry:** Disability services / NDIS plan management.

**Size:** Mid-size organisation. Has a leadership team, internal IT (Manny), and uses external providers like McNeil & Co for some administrative functions.

**Relationship summary:** Mettro has been working with Leap in! since August 2024. The relationship started with a website redevelopment project (GreyboxPro build on WordPress/WP Engine) and has grown into ongoing support, maintenance, and new projects including the recently won "Can I buy it?" app. Raeleen leads BD and Tracey manages the account and project delivery. The relationship is in a really good place right now. The client is easy to talk to and very smart. There is a formal support contract in place. The key watch-out is scope creep (see Flags and Sensitivities).

---

## URLs

| Environment | URL |
|---|---|
| Live site | https://www.leapin.com.au/ |
| Staging / dev | WP Engine staging environment (ask Archie for current URL) |
| Old staging | https://web3-uat.leapin.com.au/ (old site, pre-redevelopment) |
| Old CMS | https://web3-uat.leapin.com.au/li-cms |
| Nav subdomain | https://nav.leapin.com.au/ (separate from main site) |
| BugHerd | https://www.bugherd.com/projects/454449/kanban |
| Figma design | https://www.figma.com/design/AhPZbsmfqHW8HqIz5AEFgg/Leap-in-Website-redesign |
| ClickUp CRM | https://app.clickup.com/t/86cw7fn4g |

---

## Key Contacts

### Client side

| Name | Role | Contact | Notes |
|---|---|---|---|
| Susi Blackwell | Primary contact | susi.blackwell@leapin.com.au / +61 411 109 847 | Main point of contact and decision-maker. Reports to Graham. Knowledgeable, hands-on with content in WordPress. Very smart, easy to talk to. |
| Manny | Internal IT | | Technical contact. Good to work with. Happy for Mettro to push back on technical decisions. Involved in Bitbucket, ISO 27001, and infrastructure decisions. |
| Graham | Head of IT | | Above Susi in the chain. Gets involved on bigger decisions. |
| Stacy | Covers for Susi | | Steps in when Susi is away. |
| Bek | External marketing provider | | Handles Google Ads, SEO, and conversion-focused marketing. Very good and very heavy on conversions. Mettro does not work directly on SEO or Google Ads for this client. |
| Jasmine | McNeil & Co | | Raises support tickets on behalf of Leap in! External admin/support provider. |

### Mettro side

| Name | Role | Notes |
|---|---|---|
| Raeleen | BD / Relationship | Primary relationship holder. Leads proposals and strategic conversations. |
| Tracey | Project Manager / Account Manager | Day-to-day account management. Main point of contact for Susi. |
| Archie | Developer | Lead developer. Handles WP Engine, caching, plugin management, Bitbucket. |
| Daina | Content / QA | Content entry and QA on the website. |
| RJ | Developer | Built the Precedence Engine. Currently building the Sign Up Form. |
| Luis | Designer | Created the Leap in! website redesign concept in Figma. |

---

## Brand

**Brand guidelines location:** Brand toolkit PDF ("1264_L__Brand_toolkit_unfinished.pdf") — marked as unfinished, some sections are placeholder only.

### Colours

| Colour | Hex | RGB | PMS | Usage |
|---|---|---|---|---|
| Red | #E32625 | 227, 38, 37 | PMS 485 C | Primary brand colour. Dominant. |
| Purple | #533FAB | 83, 63, 171 | PMS 7678 C | Secondary. |
| Yellow | #FFC749 | 255, 199, 73 | PMS 123 C | Accent. |
| Charcoal | #222538 | 34, 37, 56 | PMS 276 C | Body copy. Use sparingly. |

**AA+ Accessibility compliance:** WCAG 2.0 AA compliance required across all digital channels.

### Logos

- Always refer to the brand in text as "Leap in!" (lowercase "in", exclamation mark).
- Full colour logo preferred, or white on brand red.
- "L!" graphic for small-scale digital use.

### Fonts

| Font | Usage |
|---|---|
| Founders Grotesk Bold | Headlines |
| Founders Grotesk Medium | Bold body copy |
| Founders Grotesk Regular | Body copy |

### Tone of voice

Brand personality: authentic, plain speaking, positive and optimistic, confident, balanced and approachable.

Purpose: "to help people with a disability to live their best life."

Copy is generally supplied by the client. If writing on their behalf: warm, supportive, positive, plain speaking, confident. Focused on empowering NDIS participants.

**Accessibility is non-negotiable.** WCAG AA minimum. Build it into every brief, design, and development piece.

---

## Products and Services

- **Plan management:** Core service.
- **Provider network/directory:** Directory of service providers.
- **Member Benefits Club:** Members-only portal (legacy HTML/jQuery — fragile).
- **eBooks and resources:** Educational content.
- **Sign-up form:** Currently being rebuilt.
- **"Can I buy it?" App:** In development. Helps NDIS participants determine what they can purchase.

---

## Competitors

| Competitor | URL |
|---|---|
| True Plan | https://trueplan.com.au |
| Bright Plan | https://brightplan.com.au |
| Plan Management People | https://planmanagementpeople.com.au |

---

## Technology and Integrations

| System | Purpose | Notes |
|---|---|---|
| WordPress | CMS | Core website platform |
| WP Engine | Hosting | Recurring caching issues (see Issues Log). DNS pointed here. |
| Elementor + Elementor Pro | Page builder | Susi works in Elementor on staging. Caching must be cleared separately. |
| GreyboxPro | Website kit | Mettro's proprietary starter kit. |
| Bitbucket | Code repository | Now in Leap in!'s own workspace (ISO 27001). Mettro has same access. |
| BugHerd | Bug tracking | https://www.bugherd.com/projects/454449/kanban |
| ActiveCampaign | Email marketing / CRM | Via Gravity Forms Add-On. |
| Gravity Forms | Forms | Main form plugin. Connected to ActiveCampaign and reCAPTCHA. |
| Yoast SEO Premium | SEO / Redirects | Chosen so client's SEO team can manage redirects. |
| SearchWP | Site search | Live Ajax search. |
| WP Mail SMTP | Email delivery | Transactional email. |
| Meta pixel | Tracking | Facebook/Meta pixel. |
| GTM4WP | Tag management | Google Tag Manager integration. |
| WP Rocket | Performance | Caching. Auto-updates enabled. |
| JWT Authentication | API auth | WP REST API via JSON Web Tokens. |
| Wordfence Security | Security | Firewall and malware scanning. |
| BlogVault | Backup / Security | WordPress backup. |
| AWS | Infrastructure (client) | Mettro does NOT set up or maintain servers. Deploy access only. |
| Claude AI | AI tools (client) | Client uses Claude internally. Tech-forward. |

**Plugin licence note:** ACF Pro and Silent ReCaptcha are on Mettro's licence. Needs transfer to Leap in!'s own licence. ClickUp task: https://app.clickup.com/t/86cyy1xnf

---

## Project History

### "Can I buy it?" App — In Progress (Won)
**Dates:** Created December 2025. Won March 2026.
**Scope:** App to help NDIS participants determine what they can purchase with their funding.
**ClickUp:** https://app.clickup.com/t/86d2bawht
**Notes:** Mettro does not set up or maintain servers. If deploying to AWS, Leap in! handles all server setup. Mettro needs deploy access only. Quote carefully and caveat everything.

### Sign Up Form Rebuild - Sale
**Dates:** Late 2025. RJ working on it March 2026, target Friday 21 March 2026.
**Scope:** Rebuild sign-up form. New page on leapin.com.au (e.g. /sign-up).
**ClickUp:** https://app.clickup.com/t/86czvwx62
**Notes:** Client pressure on timelines. Susi reporting to leadership.

### Precedence Engine - Complete
**Dates:** Created June 2025, completed December 2025.
**ClickUp:** https://app.clickup.com/t/86czcr86z
**Notes:** RJ built it.

### Website Redevelopment - Complete
**Dates:** Deal August 2024, sale September 2024. Launched mid-2025.
**Scope:** Full GreyboxPro rebuild of leapin.com.au.
**Sale value:** ~$34,408 ex GST.
**ClickUp:** https://app.clickup.com/t/86cw7fptu
**Notes:** Luis designed, Archie led dev, Daina content/QA. Caching was a recurring problem. Redirects via Yoast SEO Premium.

### Monthly Maintenance - In Progress
**ClickUp:** https://app.clickup.com/t/86d2612af
**Notes:** Daina assigned.

### Website Case Study — Blocked
**ClickUp:** https://app.clickup.com/t/86czd3e9j
**Notes:** Not started. Deprioritised while Mettro builds its own new site.

### Plugin Licence Transfer - In Progress
**Dates:** Created May 2025. Still in progress March 2026.
**ClickUp:** https://app.clickup.com/t/86cyy1xnf
**Notes:** Susi to purchase ACF licence. Archie to apply to staging and prod.

---

## Issues and Incidents Log

### Member Benefits Form Not Working - January 2026
**What happened:** Members could not log into the Member Benefits Club. Jasmine at McNeil & Co raised the ticket.
**How resolved:** Archie debugged and fixed. Legacy HTML/jQuery code from old site.
**Current status:** Resolved.
**Lessons:** Member Benefits Club is fragile legacy code. Any future changes need careful testing.
**Source:** https://app.clickup.com/t/86d1fqj5a

### Recurring Caching Issues on Staging - March to June 2025
**What happened:** Changes not visible due to aggressive caching. Happened at least three times.
**How resolved:** Archie cleared WP Engine server cache AND Elementor cache each time.
**Current status:** Monitoring.
**Lessons:** Always clear BOTH WP Engine cache AND Elementor cache. One without the other may not fix it.

### Email Deliverability Issues - May 2025
**What happened:** Emails landing in spam. SPF, DKIM, DMARC not configured on WP Engine.
**How resolved:** Coordinated with WP Engine to configure DNS records.
**Current status:** Resolved.
**Lessons:** After any site migration to WP Engine, check email DNS records as part of go-live.

### Mable Page URL Conflict - May 2025
**What happened:** Plugin conflict broke Mable page when URL slug changed.
**How resolved:** Archie added a dynamic variable for the page slug.
**Current status:** Resolved.

---

## Flags and Sensitivities

- **Scope creep is the number one risk.** Every job has resulted in scope creep. The client is knowledgeable and finds loopholes in proposals. When quoting: caveat everything, define boundaries clearly, nothing open-ended.
- **Quote with precision.** Spell out deliverables, revisions, what "done" looks like, what constitutes a change request.
- **Plugin licences still on Mettro's account.** Chase if needed.
- **Bitbucket repo transferred.** All changes now via Leap in!'s repository. Mettro has same access.
- **Mettro does NOT set up or maintain servers.** Deploy access only. Recommend Vercel for apps.
- **Caching is a known pain point.** Clear BOTH WP Engine AND Elementor cache.
- **Member Benefits Club is legacy code.** Fragile. Treat changes with extra care.
- **Susi reports to a leadership team.** Be realistic about delivery dates. Do not over-promise.
- **Accessibility is non-negotiable.** WCAG AA minimum. Disability services organisation.
- **Conversions matter to Bek.** Changes affecting tracking, page speed, or conversion flows need testing.
- **Overarching agreement in discussion.** Client wants an overarching agreement across all work.
- **Formal support contract is in place.**

---

## Working Notes

- Client is engaged, knowledgeable, hands-on. Susi works directly in WordPress/Elementor. Prefers email. Relationship is very good.
- Scope creep pattern: The client is commercially savvy and will take advantage of ambiguity. Quotes must be airtight.
- Jasmine at McNeil & Co raises tickets on behalf of the client. Clarify who is requesting and who is approving before doing work.
- Bek handles Google Ads, SEO. Very good, very conversion-focused. Mettro does not handle SEO or Google Ads for this client.
- Tech appetite: Forward-thinking but hates technical debt. Lean toward established, maintainable solutions.
- No sensitive topics.

---

## Source Log

| Section | Source | Date |
|---|---|---|
| Overview, contacts, URLs | ClickUp CRM record (86cw7fn4g) | 25 March 2026 |
| Project History | ClickUp tasks, Slack #leap-in | 25 March 2026 |
| Issues | ClickUp tasks, Slack #leap-in | 25 March 2026 |
| Technology | Slack DMs, screenshots | 25 March 2026 |
| Flags, Working Notes | Team interview (Raels) | 25 March 2026 |
| Brand | Brand toolkit PDF | 25 March 2026 |

---

*Version: 2.0*
*Created: March 2026*
*Owner: Raels*
