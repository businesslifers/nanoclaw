---
type: topic
created: 2026-05-05
updated: 2026-05-05
sources:
  - sources/v1-conversations/2026-04-08-conversation-2312.md
  - sources/v1-scheduled-tasks.md
related:
  - wiki/concepts/analyst-spec.md
  - wiki/concepts/collector-data-schema.md
  - wiki/topics/client-list.md
---

# Daily Reporting Pipeline

Three-stage automated pipeline that runs every morning to produce a per-client Google Ads performance report.

## Stages

### 1. Collector
- **Schedule:** daily at 6am AEST (`0 6 * * *`)
- **Role:** connects to Google Ads API and GA4 for all 8 active clients; pulls campaign performance, search terms, ad copy, disapproved ads, and website metrics across three time periods
- **Output:** one JSON file per client at `data/raw/YYYY-MM-DD/<client-id>.json` + `collector-status.json`
- **Script:** `node /workspace/agent/collector.mjs`
- **Failure handling:** posts a channel warning if all accounts fail; partial failures logged to `data/collector.log` and noted in `collector-status.json`

### 2. Analyst
- **Triggered by:** Collector on completion
- **Role:** reads raw data, applies analysis rules, produces flags and summaries
- **Script:** `node /workspace/agent/analyst.mjs`
- **Output:** `analysis/YYYY-MM-DD.json` — see [Analyst Spec](../concepts/analyst-spec.md)

### 3. Reporter
- **Triggered by:** Analyst on completion
- **Role:** dumb formatter — reads analysis JSON, formats per-client sections, posts to channel
- **Script:** `node /workspace/agent/reporter.mjs`
- **Output:** Telegram message posted to the marketingteam channel

## Janet (conversational layer)
Janet sits across the whole pipeline and can query APIs directly on demand for ad-hoc analysis (e.g. specific date range for a client, contact engagement breakdown).

## Trigger chain (scheduled task)
- **Cron:** `0 6 * * *` (daily 6am AEST)
- **Context mode:** isolated — each fire starts a fresh session
- **Script:** `echo '{"wakeAgent": true}'` (always wakes; no pre-check needed)

Steps in order:
1. `node /workspace/agent/collector.mjs` — wait for completion; stop + warn channel on error
2. `node /workspace/agent/analyst.mjs` — wait for completion; stop + warn on error
3. `node /workspace/agent/reporter.mjs` — wait for completion
4. Read most recent `.txt` from `data/reports/` and post verbatim to channel

**Failure message format:**
`⚠️ *Daily Report* — Pipeline failed at [step name]. Check logs in /workspace/agent/data/. Tag @Janet for details.`

**Telegram note:** standard Markdown bold + Unicode emoji — the Telegram adapter handles MarkdownV2 escaping. If reports are mangled, check `src/channels/telegram-markdown-sanitize.ts`.

## Service account
`janet-marketing-agent@janet-492005.iam.gserviceaccount.com` — must have access granted in each Google Ads account and GA4 property.
