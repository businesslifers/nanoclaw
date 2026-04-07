---
tags: [nanoclaw, changelog, releases]
source: https://docs.nanoclaw.dev/changelog/index
updated: 2026-04-08
---

# NanoClaw — Changelog

Recent releases relevant to our setup. Full history at https://docs.nanoclaw.dev/changelog/index.

## v1.2.52 — 2026-04-05 (current)
- Fixed Gmail OneCLI credential mode detection — properly detects when running under OneCLI Agent Vault
- Reduced setup friction and improved diagnostics output
- Added `.npmrc` with 7-day minimum release age for dependency safety

## v1.2.51 — 2026-04-05
- Fixed writable global memory mount for main agent — corrected the path in container CLAUDE.md
- Fixed three issues in the Karpathy wiki skill
- Updated `init-onecli` skill to use `ONECLI_URL` variable

## v1.2.50 — 2026-04-05
- Lowered auto-compact threshold to 165k tokens for better context fidelity
- **Added `/add-karpathy-llm-wiki` skill** — persistent wiki knowledge base per group (this wiki!)
- Added `/migrate-nanoclaw` skill — intent-based upgrade from far-behind fork
- Added `/migrate-from-openclaw` skill — guided migration from OpenClaw

## v1.2.49 — 2026-04-04
- Added automatic session artifact pruning on startup and daily — stale session JSONLs (7d), debug logs (3d), todo files (3d), telemetry (7d)

## v1.2.48 — 2026-04-04
- Upgraded agent SDK to 0.2.92 with auto-compact at 165k tokens

## v1.2.47 — 2026-04-03
- Main agent now has direct read-write access to the SQLite database — `store/` mounted separately at `/workspace/project/store`
- Added `requiresTrigger` parameter to `register_group` MCP tool (defaults to `false`)

## v1.2.46 — 2026-04-03
- Added reply/quoted message context support — `reply_to_message_id`, `reply_to_message_content`, `reply_to_sender_name` fields
- Reply context rendered as `<quoted_message>` XML in agent prompts

## v1.2.45 — 2026-04-02
- Added `/add-macos-statusbar` utility skill — macOS menu bar status indicator
- Added Telegram channel contributors

## v1.2.43 — 2026-03-29
- Auto-recover from stale Claude Code session IDs
- Removed built-in Ollama MCP from core (now via `/add-ollama-tool` skill)

## v1.2.42 — 2026-03-28
- Setup skill routes credential system by container runtime: Docker → OneCLI Agent Vault; Apple Container → native credential proxy
- Apple Container marked experimental

## v1.2.40 — 2026-03-27
- Fixed message history overflow — when `lastAgentTimestamp` missing, all 200 messages were sent instead of respecting `MAX_MESSAGES_PER_PROMPT`

## v1.2.39 — 2026-03-27
- Security fixes: command injection prevention in `stopContainer`, mount path colon rejection, allowlist caching fix

## v1.2.36 — 2026-03-27 ⚠️ BREAKING
- Replaced `pino` logger with built-in logger module (removes 2 runtime deps)
- WhatsApp users must re-merge the WhatsApp fork to pick up Baileys logger compatibility fix
- Removed `yaml` and `zod` dependencies — core now uses only 3 packages

## v1.2.35 — 2026-03-26 ⚠️ BREAKING
- **OneCLI Agent Vault replaces built-in credential proxy**
- Docker users: run `/init-onecli`
- Apple Container users: re-merge skill branch then run `/convert-to-apple-container` (do NOT run `/init-onecli`)
- Channel tokens (Telegram, Slack, Discord) remain in `.env` — only container-facing credentials migrate to vault

## Related pages

- [NanoClaw overview](nanoclaw-overview.md)
- [Security model](nanoclaw-security.md)
