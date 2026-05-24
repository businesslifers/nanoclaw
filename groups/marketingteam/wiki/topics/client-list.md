---
type: topic
created: 2026-05-05
updated: 2026-05-22
sources:
  - sources/v1-conversations/2026-04-08-conversation-2312.md
related:
  - wiki/topics/reporting-pipeline.md
  - wiki/entities/qld-capital.md
---

# Active Clients

7 clients currently active in the daily reporting pipeline (QLD Capital paused Apr 24, 2026 — see below).

## Carpet One (6 locations)

| Client | Google Ads ID | Notes |
|---|---|---|
| Carpet One Redcliffe | 336-687-5793 | |
| Carpet One Caloundra | 713-800-1437 | |
| Carpet One Logan City | 348-046-5964 | |
| Carpet One Maroochydore | 545-352-0645 | GA4 access was missing initially (fixed Apr 8 2026) |
| Carpet One Rockhampton | 538-554-2747 | |
| Carpet One Bundall | 229-901-4578 | |

All Carpet One accounts sit under the `carpetone.com.au mcc` (ID: 226-088-8703).

## Other clients

| Client | Google Ads ID | Notes |
|---|---|---|
| Haus Of Rattan | 420-948-9195 | |
| QLD Capital | 483-764-0439 | Finance/lending — **paused Apr 24, 2026** (client request); excluded from daily pipeline. See [QLD Capital entity page](../entities/qld-capital.md) |

## Account structure
- Top-level MCC: **Lifers PTY LTD** (321-808-2250) — umbrella manager
- Carpet One MCC: **carpetone.com.au mcc** (226-088-8703) — holds all Carpet One accounts
- Haus Of Rattan and QLD Capital have direct service account access (not under either MCC)

## Data files
Raw data collected daily to `data/raw/YYYY-MM-DD/<client-id>.json`. Client IDs in the filename are the numeric Google Ads IDs (no dashes).
