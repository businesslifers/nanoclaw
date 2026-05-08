# #crm — Contact Intelligence System Spec

_Summary: Project Spec_

## Overview
An automated contact intelligence system replacing manual ClickUp contact management. Runs in the background discovering contacts, enriching them, monitoring touchpoints, and surfacing actions. Team spends zero time on CRM admin.

## Channel
`#crm` (Slack: `C0ASE9FTH9Q`) — separate from #clientmate (correspondence)

## Team Access
| Person | Role | Phase |
| --- | --- | --- |
| Raels | Owner, strategic decisions, senior client relationships | From day 1 |
| Tracey | Day-to-day queries, correspondence, contact updates | From day 1 |
| Daina | Full access | Once Raels and Tracey are happy |

## Storage
- **SQLite** (`contacts.db`) — structured record: first name, last name, work email, work phone, mobile phone, company, segment, source, service/engagement type, assigned AM, LinkedIn URL + status, last contact date, Brevo status (read-only), HeyReach status, flags/notes
- **Markdown contact cards** (`contacts/[company-name].md`) — rich context per contact

## Daily Digest
- 8:30am Brisbane time, Mon–Fri, in #crm
- Format: action items first, then summary, then full list
- Each item shows: Company, Service, AM

## Touchpoint Windows
| Segment | Window |
| --- | --- |
| Active project | 7 days |
| Post-project | 45 days |
| Warm prospect | 30 days |
| Cross-sell trigger | Month 3 |

## Key Rules
- #crm is single source of truth for all contact/client knowledge
- BriefMate reads client profiles from #crm (not duplicate — BriefMate migrates to #crm)
- Brevo sequences managed in Paid Advertising project; #crm tracks status only (read-only)
- LinkedIn connection check is against Raels' LinkedIn specifically

## Integrations
- Google Workspace service account (domain-wide delegation) for email scanning — covers raeleen@, tracey@, marketing@, support@
- HeyReach (LinkedIn outreach status)
- Make.com (connectors)
- Apollo.io (contact enrichment, free tier 50 exports/month)

## Status
Spec v2.2 complete. Awaiting Adam + Tracey sign-off before build begins.

## ClickUp Reference
Spec page: `8ca58cc-22896` in Mettro AI doc `8ca58cc-93956`
Full spec file: `/workspace/agent/data/client-team-spec.md`
