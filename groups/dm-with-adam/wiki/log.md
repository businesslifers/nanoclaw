# Wiki Activity Log

## 2026-05-08 | fix | channel-architecture.md: replaced fabricated short IDs (telegram-mg-17772, telegram-mg-17774, slack-mg-17779) with real `mg-<timestamp>-<random>` IDs from the v2 DB. Added explicit "ID format" section warning never to abbreviate or invent these. Added Slack DM, Marketing Team Slack, CRM, ClientMate rows. Trigger: Adam noticed Janet citing fake IDs in Slack reply on 2026-05-08.

## 2026-05-13 | lint | Daily reflection lint pass. All 17 pages indexed, all cross-references clean.

## 2026-05-12 | lint | Daily reflection lint pass. All 17 pages indexed, all cross-references clean.

## 2026-05-11 | lint | Daily reflection lint pass. All 17 pages indexed, all cross-references clean.

## 2026-05-10 | lint | Daily reflection lint pass. All 17 pages indexed, all cross-references clean. Nothing new to ingest.

## 2026-05-09 | lint | Daily reflection lint pass. All 17 pages indexed, all cross-references clean. Nothing new to ingest.

## 2026-05-08 | lint | Daily reflection. Found 2 orphan pages not in index (qld-capital-client.md, zoho-platform.md — created by another session May 6-7). Added both to index. All cross-references clean. 17 pages now indexed.

## 2026-05-07 | lint | Daily reflection lint pass. No new issues. All cross-references clean.

## 2026-05-06 | lint | Daily reflection lint pass. No new issues. All cross-references clean.

## 2026-05-05 | lint | Daily reflection lint pass. No new issues. All cross-references clean. 5 weekly lint items still awaiting Adam's OK.

## 2026-05-04 | lint | Daily reflection lint pass. No new issues. All cross-references clean. 5 items from weekly lint still awaiting Adam's OK.

## 2026-05-03 | lint | Weekly lint pass. 5 issues flagged (reported to Adam). Auto-fixed: index.md date. Awaiting OK on: slack-formatting.md v1 label, google-sheets-integration.md stale status, launchmate-report-format.md v1 label, v1-conversations ingestion decision.

## 2026-05-03 | lint | 0 issues found. All cross-references clean, all 15 pages indexed. PI insurance renewal flagged (due 20 May 2026, Raels handling).

## 2026-05-02 | learn | Daily reflection. channel-architecture.md: updated with v2 Telegram destinations (telegram-mg-17772 = Adam DM, telegram-mg-17774 = Marketing Team); v1 Slack section marked historical. admin-tools.md: added Deferred Tools section (ToolSearch pattern for loading tool schemas in v2). index.md updated.

## 2026-05-01 | learn | Daily reflection (v2 onboarding). admin-tools.md: added Wiki & Workspace Paths section — correct path is /workspace/agent/wiki/, /workspace/group/wiki/ does not exist (stale pre-existing scheduled task cancelled), global wiki confirmed read-only (write check fails). Gotcha: always verify file paths in scheduled task prompts before registering.

## 2026-05-01 | lint | Stale go-live flag updated in mettro-crm-system.md and mettro-content-team.md (site still in copy development May 2026). Fixed incorrect .docx claim in mettro-content-team.md ("Janet can read .docx" → warning it's binary/unsupported). Added GreyboxPro to mettro-tools.md.

## 2026-05-01 | learn | Daily reflection. Created mettro-brand-voice.md: Mettro copy rules (no colons, no "users", no "we see ourselves as partners", no overuse of "we"/"our", include AEO/GEO alongside SEO, GreyboxPro platform, 25+ years, breadcrumbs on every page, don't knock competitors). Carpet One Australasia board meeting notes added (sampling decision, hub 2FA issues, Canberra store resistance, ClickUp as survey source of truth). index.md updated.

## 2026-04-30 | learn | Daily reflection. mettro-crm-system.md: Carpet One Australasia added as major web/AI strategy client (contact: Liam Barrett); LEAPIN Founder Grotesk font note added (visually smaller at same px — client requested 18px minimum); services full sub-page list added. admin-tools.md: Slack visibility limits documented (Janet cannot see DMs between other users). clickup-integration.md: Planning bug workaround confirmed in practice — verify status + re-PATCH; confirmed twice in chat as standard. index.md updated.

## 2026-04-29 | learn | Daily reflection. clickup-integration.md: "Planning" default bug documented (ClickUp may revert status to Planning after creation — workaround: verify and re-PATCH). admin-tools.md: .docx added to inbound file handling table (binary, cannot inline). mettro-crm-system.md: Mettro services structure added (3 top-level categories, main revenue drivers); LEAPIN (Leap In!) added as web support client (reCAPTCHA + mobile language dropdown issues, dev: RJ); Carpet One Logan City noted as both PPC and web client. index.md updated.

## 2026-04-28 | learn | Daily reflection. CLAUDE.md: 2 new standing rules (always set task status; always set time estimate field). clickup-integration.md: task status + time_estimate field sections added with detail. team.md: Business Lifers website is Ghost CMS. google-sheets-integration.md: flagged as still incomplete setup (Raels asked again Apr 27). mettro-tools.md: Mettro dev site URL added. new-service-concepts.md: Concept 2 (AI Design Team) added.

## 2026-04-27 | learn | Daily reflection. Updated mettro-content-team.md: active priorities confirmed (case studies + blogs), two-task action plan, .docx file delivery method. Created mettro-sops.md: SOP structure standards (split docs, PM caveat, checklist-as-record, format template). Created mettro-admin.md: company details + PI insurance renewal (due 20 May 2026, Raels handling, policy 02A001073ICT). Lint: fixed cross-container reference for La Petite Boudoir in mettro-crm-system.md.

## 2026-04-26 | lint | Scheduled lint pass. Fixed: index.md team.md date (23→25 Apr). Flagged stale: website go-live "end of April" now past (mettro-crm-system.md, mettro-content-team.md); Google Sheets API status unverified since Apr 10. Added: QLD Capital pause cross-reference in mettro-crm-system.md. No orphan pages. All 12 content pages indexed.

## 2026-04-25 | learn | Daily reflection. CLAUDE.md: Time Budget block standing rule added. clickup-integration.md: Time Budget block section added (mandatory for all tasks except SOPs). team.md: Wispr Flow suggestion for Luis. admin-tools.md: inbound file handling limits documented (JPEG ≥5MB = too large, WebP = binary/unsupported). Created new-service-concepts.md: Concept 1 = AI-agent SEO/GEO/AEO service (Raels + Janet brainstorm Apr 24–25).

## 2026-04-24 | learn | Daily reflection. admin-tools.md: DB query method documented (sqlite3 CLI unavailable; use better-sqlite3 via full node path), registered_groups schema added, new MCP tools (send_file, ask_group, inbound attachments) documented. channel-architecture.md: emacs group added. launchmate-report-format.md: QLD Capital paused all ads (Apr 24, until further notice).

## 2026-04-23 | learn | Daily reflection. Created mettro-tools.md (Media Mate + Squishmate + blog hero workflow). team.md: Luis updated to ESL/junior with task-writing guidance. clickup-integration.md: added remote team Overview rule.

## 2026-04-22 | learn | Daily reflection. CLAUDE.md: 3 new rules (always include task link, email subject line required, Brisbane timezone for dates). clickup-integration.md updated (task link rule, date timezone). admin-tools.md: #janet-main crash loop documented (35 min, Apr 22 ~02:29-03:05 UTC). Created dns-email-authentication.md (SPF/DKIM/DMARC, Mettro DNS policy, QLD Capital M365 case study).

## 2026-04-21 | learn | Daily reflection. Created clickup-integration.md (markdown_content rule, large-text via ClickUp comments pattern). team.md: added Business Lifers section (Adam + Raels, Surviving the Storm ebook context). CLAUDE.md: ClickUp markdown_content standing rule added.

## 2026-04-20 | learn | Daily reflection. team.md: added office address + phone. launchmate-report-format.md: added ad-hoc query pattern section. CLAUDE.md: new standing rule — print-ready artwork must use InDesign or Canva, not Figma.

## 2026-04-19 | learn | Daily reflection. Added La Petite Boudoir to mettro-crm-system.md PPC client list (Google Ads migration Apr 2026, account in Bitwarden, Adam setting up). Raels DM wiki read-only from this container — raels-linkedin.md headline checkbox stale (needs fixing from Raels DM context).

## 2026-04-19 | lint | Full wiki lint pass complete. Fixed: index.md stale date + stale #crm description; mettro-crm-system.md bare filename → proper link. Flagged: Google Sheets API status unverified post-Apr 10; website go-live target (end of Apr) approaching.

## 2026-04-18 | learn | team.md updated: Mettro founding date (29 Aug 2001), ClickUp workspace/wiki mirror IDs, remote team roles corrected

## 2026-04-17 | learn | LaunchMate: analyst-role.md spec update confirmed; disapproved ad detail standard raised; Google Ads API confirmed read-only

## 2026-04-16 | learn | LaunchMate critical flag rule updated (budget/IS + CPA trend logic); spec update scheduled for launchmate agent

## 2026-04-15 | learn | #crm registered (channel-architecture updated); CLAUDE.md standing rules added: no em dashes, use "we" for Mettro, check client profile before emails, send_message current-group-only gotcha

## 2026-04-14 | learn | launchmate requiresTrigger→true; #crm channel pending registration; CRM spec refined (email platform TBD, digest schedule, contact fields, email monitoring); created mettro-content-team.md

## 2026-04-13 | learn | Auth overnight outage pattern documented in admin-tools.md; created mettro-crm-system.md with full CRM/marketing engine design

## 2026-04-10 | learn | Google Sheets integration pattern for service accounts; LaunchMate first automated report run confirmed successful (exit 0, 142s)

## 2026-04-10 | bootstrap | Initial wiki created from Apr 8-9 activity review

Pages created:
- `index.md` — wiki index
- `slack-formatting.md` — Slack emoji quirks (`:large_yellow_circle:` fix)
- `launchmate-report-format.md` — approved grouped report format
- `admin-tools.md` — IPC admin tools status and limitations
- `channel-architecture.md` — registered channels, JIDs, mounts
- `team.md` — Mettro team members and Slack IDs
- `log.md` — this file
