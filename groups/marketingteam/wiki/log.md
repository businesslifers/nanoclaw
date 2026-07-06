---
scope: group
group: marketingteam
---

# Marketing Team Wiki — Log

Append-only chronological record of ingest, query, lint, and promotion events. One entry per operation. Format:

```
## [YYYY-MM-DD] <event-type> | <one-line summary>

<details>
```

Where `<event-type>` is `ingest`, `query`, `lint`, `promote`, or `prune`.

Recent entries are tail-readable: `tail -50 log.md` or `grep "^## \[" log.md | tail -10`.

---

## [2026-06-05] lint | 2 open items, 0 broken links

Health check. Index current (8 content pages all indexed, `updated`/`lint` = 2026-06-05). All cross-references resolve — 8 inline links + frontmatter `related:` targets, 0 broken (the lone `](url)` in reporting-pipeline.md is a literal Slack-formatting example, not a link). No orphans, no contradictions. Both top-level sources have summary pages — none unprocessed. Open items: (1) `google-ads-proxy-h2-break.md` Status ends Jun 5 but the `403 credential_not_found` wall it documents has persisted across every subsequent daily run, still unresolved — needs a status refresh; (2) carried since May 8 — no per-client entity pages for the 7 active clients (covered by client-list topic).

## [2026-05-05] ingest | v1-scheduled-tasks.md

Pipeline task prompt and Telegram formatting note folded into reporting-pipeline.md. Source summary filed. Index updated.

## [2026-06-05] lint | 1 issue found, 1 fixed

Full health check. All cross-references resolve (20 `related:` frontmatter links + inline links, 0 broken), all 8 content pages indexed, no orphans, no contradictions, both top-level sources (`v1-conversations/2026-04-08-conversation-2312.md`, `v1-scheduled-tasks.md`) have summary pages — none unprocessed. Fixed: index `updated`/`lint` dates were stale at 2026-05-22 despite the Jun 5 proxy-break page being added since; bumped to 2026-06-05. Carried open item (since May 8): no per-client entity pages for the 7 active clients (covered by `topics/client-list.md`); left as-is.

## [2026-06-05] ingest | Google Ads proxy h2/gRPC break incident

Collector lane diagnosed the Jun 3–4 collection failures: OneCLI proxy began TLS-intercepting and only negotiates http/1.1, breaking google-ads-node's gRPC/h2 requirement (SSL alert 120). Filed `topics/google-ads-proxy-h2-break.md` with root cause + 3 fix options (infra host exemption / proxy h2 support / app-side REST transport). Relayed to channel (msg 137), awaiting decision. Also recorded the separate, still-open May 31 month-end MTD date bug there.

## [2026-05-22] lint | 3 stale claims fixed in reporting-pipeline.md

`reporting-pipeline.md` had not been updated when QLD Capital was paused. Fixed:
- "8 active clients" → "7 active clients" (QLD Capital paused Apr 24, 2026)
- Reporter output described as "Telegram message" → "Slack mrkdwn message" (channel migrated to Slack)
- "Telegram note" block referencing `telegram-markdown-sanitize.ts` replaced with Slack mrkdwn note
- Frontmatter `updated` date corrected
No broken cross-references, no orphan pages, no unprocessed sources.
Open recurring item: no per-client entity pages for 7 active clients (covered by client-list topic).

## [2026-05-22] lint | 1 stale claim found and fixed

Discovered QLD Capital has been paused since Apr 24, 2026 (`active: false` in clients.json) but wiki still listed 8 active clients. Fixed:
- `topics/client-list.md` — updated to 7 active clients, noted QLD Capital pause
- `entities/qld-capital.md` — updated status to paused
- `index.md` — updated client-list summary line
All links valid, no orphan pages, no new sources.

## [2026-05-15] lint | 0 new issues, 2 pre-existing open items

All links valid, all 7 content pages indexed, no new sources. Same open items as May 8 lint:
1. Missing entity pages for 6 Carpet One locations + Haus Of Rattan (covered by client-list topic only).
2. Global wiki remains empty — no cross-group promotions yet.

## [2026-05-08] lint | 2 issues found, 0 fixed

Index is current and all 7 content pages are indexed. No broken cross-references, no orphan pages, no unprocessed sources, no contradictions detected. Two issues flagged for future action:
1. Missing entity pages for 7 clients (6 Carpet One locations + Haus Of Rattan) — client-list topic covers them but no per-client entity pages exist.
2. Index `updated` date bumped to today.

## [2026-05-05] ingest | v1-conversations/2026-04-08-conversation-2312.md

Filed 5 pages: reporting-pipeline (topic), client-list (topic), analyst-spec (concept), collector-data-schema (concept), qld-capital (entity), plus source summary. Index updated.

## [2026-05-04] lint | 2 issues found, 0 fixed

Wiki is structurally healthy (no broken links, no orphans, no contradictions) but both source files are unprocessed — no entity/concept/topic pages exist yet. Sources flagged for ingest: `v1-conversations/2026-04-08-conversation-2312.md` and `v1-scheduled-tasks.md`.

## [2026-04-30] init | Wiki scaffolded for Marketing Team group

Created `wiki/` skeleton (`index.md`, `log.md`, `entities/`, `concepts/`, `topics/`) so the agent has somewhere to file marketing-specific knowledge as sources are ingested. `sources/` already contained the v1 conversation import and v1 scheduled-tasks export — those have not yet been processed into wiki pages.

## [2026-06-12] lint | incident page status refreshed
Updated `topics/google-ads-proxy-h2-break.md` Status: the `403 credential_not_found` wall is still unresolved, having failed every daily collector run Jun 7–12 (6 consecutive days, 0/7 accounts). Closes the open item flagged in the Jun 5 lint. Still no infra host-exemption applied; pipeline remains blocked.

## [2026-06-17] fix | Google Ads collector RESOLVED — stale login-customer-id, not infra
Root-caused and fixed by Adam (host-side). The 13-day "proxy `credential_not_found` wall" was a misdiagnosis: the single cause was the stale `login-customer-id: 3218082250` (Lifers PTY LTD MCC) header in `collector.mjs` `queryAds()`. That MCC no longer parents the client accounts (only child is now Business Lifers 9813601805); the service account has DIRECT access to all 7 active clients. The manager header triggered OneCLI to demand a vault credential (`credential_not_found`) AND would have hit `USER_PERMISSION_DENIED` at Google. Removed the header; verified live through the OneCLI proxy → 7 succeeded, 0 failed. No infra/host-exemption was needed (none exists in OneCLI 2.2.3). Updated `topics/google-ads-proxy-h2-break.md` with a RESOLVED banner.

## [2026-06-17] incident-resolved | Google Ads collector outage cleared
Jun 17 collector run succeeded 7/7 — first clean run since Jun 6, ending an 11-day blackout (Jun 7–16). Full pipeline ran end-to-end and posted the daily report. Root cause was NOT infra/proxy (see Adam's fix entry above): a stale `login-customer-id: 3218082250` header in `collector.mjs` triggered OneCLI's `credential_not_found` and would have hit Google `USER_PERMISSION_DENIED`. Removing the header fixed it. Corrected my earlier "infra-side cleared" note on `topics/google-ads-proxy-h2-break.md` to match.

## [2026-07-03] lint | 1 page created, index refreshed, 0 broken links
Health check. All content pages indexed, 3 inline links + all frontmatter `related:`/`sources:` targets resolve (0 broken), no orphans, both raw sources have summary pages. Fixed: (1) split the recurring month-end MTD date bug into its own page `topics/collector-month-end-mtd-bug.md` — it was an ACTIVE recurring bug (confirmed May 31 + Jun 30) buried as a footnote on the RESOLVED, unrelated `google-ads-proxy-h2-break.md` and absent from the index; added it to the index, cross-linked both ways, trimmed the old footnote to a pointer; (2) index `updated`/`lint` bumped 2026-06-26 → 2026-07-03. Noted, not fixed: `log.md` entries are not in strict chronological order (pre-existing; left as-is to avoid churn). Open items: (1) month-end MTD bug code fix still outstanding, next risk Jul 31; (2) no per-client entity pages for the 7 clients (carried since May 8, covered by client-list topic).

## [2026-06-30] incident | month-end MTD date bug recurred — collector 0/7
As predicted in the Jun 26 lint, the month-end MTD date bug fired on data date 2026-06-30 (last day of month). Collector computed MTD as start `2026-07-01` → end `2026-06-30`; GA4 rejected every account (`start_date must be <= end_date`), all 3 retries failed. Result: 0 succeeded, 7 failed, status `failed`; analyst/reporter not triggered. Posted the runbook failure warning to channel and stopped. Expected to self-clear on Jul 1 (as May 31 → Jun 1 did). The underlying MTD start-date logic in collector.mjs is still uncoded — tracked in `topics/google-ads-proxy-h2-break.md` "Related open issue". This is now the 2nd confirmed month-end occurrence (May 31, Jun 30).

## [2026-06-26] lint | 1 fixed, 2 open items
Health check. All 8 content pages indexed. Cross-references all resolve: 3 inline relative links + every frontmatter `related:`/`sources:` target (0 broken); both raw sources (`v1-conversations/2026-04-08-conversation-2312.md`, `v1-scheduled-tasks.md`) exist and have summary pages — none unprocessed. No orphans, no contradictions; collector-outage page consistent with its RESOLVED banner and matches reality (pipeline has run clean 7/7 daily through Jun 25). Fixed: index `updated`/`lint` dates frozen at 2026-06-18 → bumped to 2026-06-26. Open items: (1) May 31 month-end MTD date-bug still uncoded — recurs every month-end, next risk Jun 30 (4 days out), tracked in `google-ads-proxy-h2-break.md`; (2) carried since May 8 — no per-client entity pages for the 7 active clients (covered by `client-list` topic, left as-is).

## [2026-06-18] lint | 2 fixed, 2 open items
Health check. All 8 content pages indexed, all inline + frontmatter `related:` links resolve (0 broken), no orphans, no contradictions (incident page Status now consistent with its RESOLVED banner after the Jun 17 reconciliation). Both sources have summary pages. Fixed: (1) index `updated`/`lint` dates were frozen at 2026-06-05 → bumped to 2026-06-18; (2) index summary line for the collector-outage page still framed it as an active unresolved incident → rewrote to RESOLVED with correct root cause. Open items: (1) still-open May 31 month-end MTD date-bug (code fix outstanding, recurs each month-end — tracked in `google-ads-proxy-h2-break.md`); (2) carried since May 8 — no per-client entity pages for the 7 active clients (covered by client-list topic).
