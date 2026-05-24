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

## [2026-05-05] ingest | v1-scheduled-tasks.md

Pipeline task prompt and Telegram formatting note folded into reporting-pipeline.md. Source summary filed. Index updated.

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
