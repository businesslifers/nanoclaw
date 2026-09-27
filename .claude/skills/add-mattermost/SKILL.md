---
name: add-mattermost
description: Add Mattermost channel integration via Chat SDK.
---

# Add Mattermost Channel

Adds Mattermost support via the Chat SDK bridge, wrapping the community
[`chat-adapter-mattermost`](https://github.com/thiagoferolla/chat-adapter-mattermost)
package. Events arrive over an outbound WebSocket (`/api/v4/websocket`) — no
public URL or webhook is needed for basic messaging.

## Install

NanoClaw doesn't ship channels in trunk. This skill copies the Mattermost
adapter in from the `channels` branch.

### Pre-flight (idempotent)

Skip to **Credentials** if all of these are already in place:

- `src/channels/mattermost.ts` exists
- `src/channels/index.ts` contains `import './mattermost.js';`
- `chat-adapter-mattermost` is listed in `package.json` dependencies

Otherwise continue. Every step below is safe to re-run.

### 1. Fetch the channels branch

```bash
git fetch origin channels
```

### 2. Copy the adapter and registration test

```bash
git show origin/channels:src/channels/mattermost.ts > src/channels/mattermost.ts
git show origin/channels:src/channels/mattermost-registration.test.ts > src/channels/mattermost-registration.test.ts
```

### 3. Append the self-registration import

Append to `src/channels/index.ts` (skip if the line is already present):

```typescript
import './mattermost.js';
```

### 4. Install the adapter package (pinned)

`chat-adapter-mattermost` is an unscoped, community-maintained package (one
individual maintainer, a handful of releases) — a materially higher risk tier
than the official `@chat-adapter/*` packages, so pin it exactly:

```bash
pnpm install chat-adapter-mattermost@1.1.3
```

### 5. Build and validate

```bash
pnpm run build
pnpm exec vitest run src/channels/mattermost-registration.test.ts
```

`mattermost-registration.test.ts` imports the real channel barrel and asserts
the registry contains `mattermost`. It goes red if the import line is deleted
or drifts, or if `chat-adapter-mattermost` isn't installed (the import
throws). End-to-end delivery against a real server is verified manually once
the service runs.

## Credentials

Mattermost has no interactive OAuth app flow like Slack — auth is a single
bot account token.

### Create the bot account

1. Enable bot account creation if it isn't already: **System Console →
   Integrations → Bot Accounts → "Enable Bot Account Creation"** (requires a
   System Admin).
2. Still in **System Console → Integrations → Bot Accounts**, click **Add Bot
   Account**. Give it a username (e.g. `nanoclaw`) and display name, then
   create it.
3. Copy the **Access Token** shown immediately after creation — it is only
   ever displayed at creation time.
4. Invite the bot to any team/channel it should participate in (add it like a
   regular member, or an admin can add it via the API). Bot accounts don't
   auto-join channels.

If the token is lost, generate a new one from the same Bot Accounts screen
(**select the bot → "Create New Token"**) — this does **not** revoke the old
token; both remain valid simultaneously. Explicitly deactivate the old token
from the same screen if you want it revoked.

### Configure environment

```bash
MATTERMOST_BASE_URL=https://mattermost.example.com
MATTERMOST_BOT_TOKEN=your-bot-access-token
```

`MATTERMOST_BASE_URL` must include the scheme and no trailing slash.

### Confirm the token works

```bash
curl -sf "$MATTERMOST_BASE_URL/api/v4/users/me" -H "Authorization: Bearer $MATTERMOST_BOT_TOKEN" | jq -er '"@" + .username'
```

A failure here means the token is wrong, expired, or the bot account was
deactivated.

### Resolve your DM channel

You'll need the bot's user id (from the same `users/me` call — `jq -er .id`)
and your own Mattermost user id. There's no self-service page that shows your
own ID; resolve it from your bot token instead:

```bash
curl -sf "$MATTERMOST_BASE_URL/api/v4/users/username/<your-username>" -H "Authorization: Bearer $MATTERMOST_BOT_TOKEN" | jq -er '.id'
```

(An admin can also look this up via **System Console → Users**.)

Then open (or fetch) the DM channel and take its id as the conversation
address `mattermost:<channelId>`:

```bash
curl -sf -X POST "$MATTERMOST_BASE_URL/api/v4/channels/direct" -H "Authorization: Bearer $MATTERMOST_BOT_TOKEN" -H "Content-Type: application/json" -d '["<your-user-id>","<bot-user-id>"]' | jq -er '"mattermost:" + .id'
```

## Next Steps

If you're in the middle of `/setup`, return to the setup flow now.

Otherwise, run `/manage-channels` to wire this channel to an agent group.

## Channel Info

- **type**: `mattermost`
- **terminology**: Mattermost has "teams" containing "channels." Channels can be public or private. The bot can also receive direct messages.
- **platform-id-format**: `mattermost:{channelId}` for channels and DMs (e.g. `mattermost:a1b2c3d4e5f6g7h8i9j0k1l2m3`)
- **how-to-find-id**: Open the channel, click its name → "View Info" — the channel ID is shown there. Copying the channel link gives the channel *slug*, not the ID the adapter needs — use "View Info" or the `/api/v4/channels/direct` lookup above for DMs.
- **supports-threads**: yes — Mattermost models replies as optional reply-threads within a channel (a post with no root is top-level; a post with a root id is a thread reply), the same shape as Slack.
- **typical-use**: Interactive chat — team channels or direct messages, self-hosted or Mattermost Cloud
- **default-isolation**: Same agent group for channels where you're the primary user. Separate agent group for channels with different teams or sensitive contexts.

## Troubleshooting

**A token or URL is rejected.** `MATTERMOST_BASE_URL` must include the scheme (`https://` or `http://`) and no trailing slash. The bot token is shown once at creation — regenerate it from System Console → Integrations → Bot Accounts → select the bot → "Create New Token" if lost (old tokens keep working until you deactivate them separately).

**The bot never connects, or connects and repeatedly drops.** Check that `MATTERMOST_BASE_URL` is reachable from the host (not just from a browser behind a VPN or reverse-proxy auth) and that nothing in front of the server (load balancer, CDN) blocks or aggressively idle-times WebSocket upgrades to `/api/v4/websocket`. The adapter retries with backoff and NanoClaw's channel-registry retries adapter setup on network errors, but a very short idle timeout in front of the server will cause repeated reconnects. Check `logs/nanoclaw.error.log` for repeated adapter setup-retry warnings.

**The bot can't see a channel or can't DM someone.** The bot account must be added as a member of any channel it should read/post in — bot accounts don't auto-join. For DMs, the target user must exist and be reachable via `/api/v4/channels/direct`.

**Known feature gaps** (inherent to this community adapter, not a NanoClaw bug):
- File uploads can't be edited after posting — a follow-up edit that adds/changes an attachment posts a new message instead.
- Interactive cards (buttons/selects) are not wired up — the adapter supports rendering them, but only when constructed with a `callbackUrl` for Mattermost to call back on, which this integration doesn't currently configure. Cards fall back to a plain-text rendering.
- Streaming responses fall back to post-and-edit (no native streaming transport), so long responses may appear to "jump" rather than stream in place.
- Slash commands and modals are not supported — only plain message send/receive and reactions.
- Rate-limit responses aren't specially surfaced; sustained high-volume channels may see delivery errors during Mattermost API throttling.
