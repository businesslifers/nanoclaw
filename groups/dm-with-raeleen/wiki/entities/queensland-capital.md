# Queensland Capital

_Entity: Client_

## Overview
Queensland Capital (QLD Capital) is a finance/investment client of Mettro. They operate in the property finance space — deal types include funded and repaid announcements to their contact list.

## Key Contact
- **Mark** — Decision-maker. Resistant to changing platforms or tools. Needs evidence-based persuasion.
- **Archie** — Technical/implementation contact. Knows Zoho.
- **Daina** — Internal operations. Has access to Zoho. Not a developer.
- **Tracey** — Mettro contact managing the account day-to-day.

## Email Setup
- Platform: **Zoho Campaigns** (workflows live in Campaigns, not CRM)
- List size: **14,000+ contacts**
- Current problem: Announcement emails (funded/repaid deals) blast the full list at once → hitting spam filters → not reaching inboxes
- Shared IP on Zoho — compounds the volume spike problem
- Mark has refused to move to a new email platform

## Email Outreach Research
Full research documented in ClickUp: [New Email System — 12 March 2026](https://app.clickup.com/9003245964/v/dc/8ca58cc-27836/8ca58cc-22516)

Key recommendations from research:
- Stop cold outreach from main domain — use a subdomain
- Fix SPF/DKIM/DMARC on primary domain
- Switch to Smartlead + HeyReach for outreach
- Plain text emails only (652% lower bounce rate vs HTML)
- Rewrite emails — conversational, not marketing copy
- Stagger sends instead of bulk blasting

## Batch Sending Options (Ranked)
See ClickUp page: [Batch Sending Bulk Emails](https://app.clickup.com/9003245964/v/dc/8ca58cc-27836/8ca58cc-23016)

1. **Smartlead** — switch email platform, handles staggering natively ($39/mo). Mark's sign-off required.
2. **n8n + Google Sheet** — automation drip-feeds contacts daily from a sheet queue, no Zoho API dependency (~$20/mo + dev setup)
3. **n8n + Zoho Campaigns API** — same but via Zoho API; Zoho community has low confidence in API reliability

## Zoho Notes
- Workflows are in Zoho Campaigns, not CRM
- CRM-to-Campaigns field sync is near real-time (confirmed by Raels)
- Zoho's API has reliability concerns per community feedback
- Daina is not a developer — Archie handles technical Zoho work

## ClickUp
- Retainer list: `901602099641` (QC Retainer)
- QLD Capital notebook doc: `8ca58cc-27836`
