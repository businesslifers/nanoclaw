---
name: slack-mrkdwn-conventions
description: Slack mrkdwn formatting rules confirmed by the parent (Janet) for #marketing-team posts
metadata:
  type: concept
---

# Slack mrkdwn conventions (marketing-team channel)

Confirmed by parent dispatch on 2026-07-06 (campaign audit reformat request). Matches the rules already in `CLAUDE.role.md`, now cross-checked against an actual parent request.

- Bullets: `•`, never `- `
- Bold section headers: `*Bold text*`, never `##` or `**double**`
- No numbered lists
- No em dashes anywhere, commas or colons instead
- Links: `<https://url|link text>`
- Severity icons: unicode emoji (🔴 ⚠️ 👀 🗂 ✅) rather than `:shortcode:` aliases that may not render
- Lead with the punchline / headline finding before the itemized sections
- Close with a point-in-time caveat + an @mention for follow-up detail, when the source data is a snapshot

## Structural pattern for audit-style reports

Section ordering that's worked well: critical (account-level first, then live-campaign issues) → caveat/context section (e.g. tracking gaps that could explain false negatives) → "worth a look" (lower urgency, opportunity-shaped) → dormant/paused items with latent risk (e.g. disapprovals that will bite on reactivation).

Related: [[reporter-role-spec]] (not yet filed — full v1 spec lives in parent's workspace at `groups/marketingteam/specs/reporter-role.md`, paste sections in as needed).
