---
name: add-slack
description: Add Slack channel integration via Chat SDK.
---

# Add Slack Channel

Adds Slack support via the Chat SDK bridge.

## Install

NanoClaw doesn't ship channels in trunk. This skill copies the Slack adapter in from the `channels` branch.

> **Source of truth on this install:** copy from **`private/channels`**, not
> `origin/channels` (the `origin` DR mirror has no `channels` branch) and not
> `upstream/channels`. `upstream/channels` lags our local Slack `setReaction`
> (status-reaction) support — copying from it would silently delete that
> feature. `private/channels` is the canonical, fully-patched source here.

### Pre-flight (idempotent)

Skip to **Credentials** if all of these are already in place:

- `src/channels/slack.ts` exists
- `src/channels/index.ts` contains `import './slack.js';`
- `container/skills/slack-formatting/SKILL.md` exists
- `@chat-adapter/slack@4.30.0` is listed in `package.json` dependencies

Otherwise continue. Every step below is safe to re-run.

### 1. Fetch the channels branch

```bash
git fetch private channels
```

### 2. Copy the adapter

```bash
git show private/channels:src/channels/slack.ts > src/channels/slack.ts
mkdir -p container/skills/slack-formatting
git show private/channels:container/skills/slack-formatting/SKILL.md > container/skills/slack-formatting/SKILL.md
```

`private/channels` ships only `slack.ts` (no separate `slack-registration.test.ts`); registration is verified by the build + barrel import below.

The `slack-formatting` container skill is part of the channel payload: it
reaches agents via `~/.claude/skills` (synced at spawn) and teaches Slack's
mrkdwn syntax. Trunk does not ship it — without this copy step agents send
Slack messages with generic markdown that renders literally.

### 3. Append the self-registration import

Append to `src/channels/index.ts` (skip if the line is already present):

```typescript
import './slack.js';
```

### 4. Install the adapter package (pinned)

```bash
pnpm install @chat-adapter/slack@4.30.0
```

> **Slack 3000-char section limit:** Slack rejects the **entire** message
> (`invalid_blocks`) if any `section` block's text exceeds 3000 chars — which
> used to silently drop long agent replies. As of `@chat-adapter/slack@4.30.0`
> the SDK handles this itself: a `LIMITS` table truncates section text to 3000
> chars, caps `header` text at 150, and slices messages to Slack's 50-block
> max (`dist/blocks.js`). We previously carried a pnpm patch (against `4.27.0`'s
> `dist/index.js`) that *split* oversized sections into multiple blocks rather
> than truncating; that patch was dropped at the 4.30.0 bump. Trade-off to know:
> 4.30.0 **truncates** a single >3000-char section (tail lost) where the old
> patch preserved all content across multiple blocks. The agent formatter
> usually breaks replies into multiple blocks, so single oversized sections are
> rare (mainly long unbroken code blocks). Keep `@chat-adapter/slack`,
> `@chat-adapter/telegram`, and `chat` aligned on the same version — they ship
> in lockstep and share the `chat` core types; a version skew breaks the host
> build (`ChatInstance` type mismatch).

### 5. Build and validate

```bash
pnpm run build
grep -q "import './slack.js';" src/channels/index.ts && echo "slack barrel import OK"
```

The build must be clean and the barrel import must be present before proceeding. The adapter calls core's `createChatSdkBridge(...)` and consumes the typed core API; that consumption — plus the `@chat-adapter/slack` dependency from step 4 — is guarded by `pnpm run build` (a missing dep or drifted import fails the type-check). The `grep` confirms the self-registration line from step 3 is wired so the registry actually picks up `slack` at boot.

End-to-end message delivery against a real Slack workspace is verified manually once the service is running — see Next Steps and the webhook setup above.

## Credentials

### Create Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and click **Create New App** > **From scratch**
2. Name it (e.g., "NanoClaw") and select your workspace
3. Go to **OAuth & Permissions** and add Bot Token Scopes:
   - `chat:write`, `im:write`, `channels:history`, `groups:history`, `im:history`, `channels:read`, `groups:read`, `users:read`, `reactions:write`, `files:read`, `files:write`
4. Click **Install to Workspace** and copy the **Bot User OAuth Token** (`xoxb-...`)
5. Go to **Basic Information** and copy the **Signing Secret**

### Enable DMs

6. Go to **App Home** and enable the **Messages Tab**
7. Check **"Allow users to send Slash commands and messages from the messages tab"**

### Event Subscriptions

8. Go to **Event Subscriptions** and toggle **Enable Events**
9. Set the **Request URL** to `https://your-domain/webhook/slack` — Slack will send a verification challenge; it must pass before you can save
10. Under **Subscribe to bot events**, add:
    - `message.channels`, `message.groups`, `message.im`, `app_mention`
11. Click **Save Changes**

### Interactivity

12. Go to **Interactivity & Shortcuts** and toggle **Interactivity** on
13. Set the **Request URL** to the same `https://your-domain/webhook/slack`
14. Click **Save Changes**
15. Slack will show a banner asking you to **reinstall the app** — click it to apply the new settings

### Configure environment

Add to `.env`:

```bash
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret
```

Sync to container: `mkdir -p data/env && cp .env data/env/env`

### Webhook server

The Chat SDK bridge automatically starts a shared webhook server on port 3000 (configurable via `WEBHOOK_PORT` env var). The server handles `/webhook/slack` for Slack and other webhook-based adapters. This port must be publicly reachable from the internet for Slack to deliver events.

If running locally, discuss options for exposing the server — e.g. ngrok (`ngrok http 3000`), Cloudflare Tunnel, or a reverse proxy on a VPS. The resulting public URL becomes the base for `https://your-domain/webhook/slack`.

## Next Steps

If you're in the middle of `/setup`, return to the setup flow now.

Otherwise, run `/manage-channels` to wire this channel to an agent group.

## Channel Info

- **type**: `slack`
- **terminology**: Slack has "workspaces" containing "channels." Channels can be public (#general) or private. The bot can also receive direct messages.
- **platform-id-format**: `slack:{channelId}` for channels (e.g., `slack:C0123ABC`), `slack:{dmId}` for DMs (e.g., `slack:D0ARWEBLV63`)
- **how-to-find-id**: Right-click a channel name > "View channel details" — the Channel ID is at the bottom (starts with C). For DMs, the ID starts with D. Or copy the channel link — the ID is the last segment of the URL.
- **supports-threads**: yes
- **typical-use**: Interactive chat — team channels or direct messages
- **default-isolation**: Same agent group for channels where you're the primary user. Separate agent group for channels with different teams or sensitive contexts.
