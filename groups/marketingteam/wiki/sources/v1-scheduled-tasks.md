---
type: summary
created: 2026-05-05
updated: 2026-05-05
sources:
  - sources/v1-scheduled-tasks.md
related:
  - wiki/topics/reporting-pipeline.md
---

# Source Summary — v1 Scheduled Tasks

Ported 2026-04-29. Contains the daily Google Ads reporting pipeline task definition migrated from v1 to v2.

## Key content
- Daily cron `0 6 * * *`, always-wake script, full pipeline prompt
- Telegram-specific formatting note (Unicode emoji + standard Markdown; adapter handles MarkdownV2 escaping)
- If reports are mangled check `src/channels/telegram-markdown-sanitize.ts`

All content folded into [Reporting Pipeline](../topics/reporting-pipeline.md).
