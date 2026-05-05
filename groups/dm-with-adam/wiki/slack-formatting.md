# Slack Formatting — Quirks & Rules

Last updated: 2026-04-10

## Emoji — Known Rendering Issues

| Intent | ❌ Does NOT render | ✅ Use this instead |
|--------|-------------------|-------------------|
| Yellow circle | `:yellow_circle:` | `:large_yellow_circle:` |
| Green circle | `:green_circle:` | `:large_green_circle:` |
| Red circle | `:red_circle:` | `:red_circle:` ✓ works fine |
| Blue circle | `:blue_circle:` | `:large_blue_circle:` |

**Source:** Adam flagged Apr 8 — `:yellow_circle:` was rendering as literal text `:yellow_circle:` in the LaunchMate morning report. Corrected to `:large_yellow_circle:`.

## General mrkdwn Rules

- `*bold*` — single asterisks
- `_italic_` — underscores
- `<https://url|link text>` — links (NOT markdown `[text](url)`)
- `•` — bullets (no `- ` dashes, no numbered lists)
- `` `:emoji:` `` — emoji shortcodes
- `>` — block quotes
- No `##` headings — use `*Bold text*` as section headers instead
- No `**double asterisks**`

## See also

- [launchmate-report-format.md](launchmate-report-format.md) — uses these emoji rules
