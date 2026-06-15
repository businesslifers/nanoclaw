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
