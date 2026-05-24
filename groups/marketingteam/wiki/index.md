---
scope: group
group: marketingteam
title: Marketing Team
description: Marketing Team wiki — Janet maintains; entries scoped to Mettro Digital marketing operations (Google Ads, GA4, clients, conversion analysis).
updated: 2026-05-22
---

# Marketing Team Wiki — Index

Knowledge base for the Marketing Team agent group. Janet (this agent) maintains it. Read this file FIRST on any query so you can pull from existing pages instead of re-deriving from raw sources.

## How to use this index

Every wiki page should be linked here under its category with a one-line summary. New ingests append entries here AND to `log.md`. Stale or orphan pages are pruned during periodic lint passes.

## Categories

### Entities
*People, clients, agencies, platforms, products.*

- [QLD Capital](entities/qld-capital.md) — Finance/lending client; PMax campaigns; paid traffic phone-over-form behaviour documented (Apr 2026)

### Concepts
*Ideas, frameworks, definitions — e.g. quality score, conversion attribution, audit cadence.*

- [Analyst Spec](concepts/analyst-spec.md) — Analysis rules (critical/warning/positive thresholds), conversion classification, contact engagement logic, output JSON schema
- [Collector Data Schema](concepts/collector-data-schema.md) — What collector.mjs produces: file locations, time periods, Google Ads + GA4 fields, status signal

### Topics
*Threads spanning multiple sources — running investigations, recurring reports, account health themes.*

- [Reporting Pipeline](topics/reporting-pipeline.md) — Daily Collector → Analyst → Reporter pipeline; schedules, scripts, failure handling
- [Client List](topics/client-list.md) — 7 active clients (6 Carpet One locations + Haus Of Rattan); QLD Capital paused Apr 24, 2026; account IDs and MCC structure

### Source Summaries
*One page per ingested source.*

- [v1 Conversation Apr 8 2026](sources/v1-conversation-2026-04-08.md) — Pipeline design session: Collector built, Analyst spec written, Reporter spec aligned, QLD Capital live data pull
- [v1 Scheduled Tasks](sources/v1-scheduled-tasks.md) — Daily pipeline cron task ported from v1; Telegram formatting note

## Cross-wiki links

- Global wiki: `/workspace/global/wiki/index.md` (read-only from this group; promote pages there when they become useful cross-group).
