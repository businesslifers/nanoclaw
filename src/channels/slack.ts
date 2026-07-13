/**
 * Slack channel adapter (v2) — uses Chat SDK bridge.
 * Self-registers on import.
 *
 * Socket Mode opt-in: set SLACK_APP_TOKEN (xapp-…) to receive events over an
 * outbound WebSocket instead of an inbound HTTPS webhook.
 */
import { createSlackAdapter } from '@chat-adapter/slack';

import { readEnvFile } from '../env.js';
import type { ChannelDefaults } from './adapter.js';
import { createChatSdkBridge } from './chat-sdk-bridge.js';
import { registerChannelAdapter } from './channel-registry.js';

/** status-tracker passes unicode; chat-sdk's defaultEmojiResolver maps these
 *  normalized names to Slack reaction names (eyes/thinking_face/gear/white_check_mark). */
const STATUS_REACTION_NAMES: Record<string, string> = {
  '👀': 'eyes',
  '🤔': 'thinking',
  '⚙️': 'gear',
  '✅': 'check',
};

/**
 * Dedicated bot app on a threaded platform. group threads:true keeps
 * mention-sticky bounded — engagement sticks per-thread, not forever.
 * dm.threads:false is a deliberate policy choice, not a capability limit:
 * Slack users can open sub-threads inside a DM, but by default the agent
 * replies top-level and all DM sub-threads collapse into the one DM session.
 * This declaration owns that judgment (it used to be hardcoded router
 * behavior); operators who want in-thread DM replies override per wiring
 * with `--threads true`.
 */
const SLACK_DEFAULTS: ChannelDefaults = {
  dm: { engageMode: 'pattern', engagePattern: '.', threads: false, unknownSenderPolicy: 'request_approval' },
  group: { engageMode: 'mention-sticky', threads: true, unknownSenderPolicy: 'request_approval' },
  mentions: 'platform',
};

registerChannelAdapter('slack', {
  factory: () => {
    const env = readEnvFile(['SLACK_BOT_TOKEN', 'SLACK_SIGNING_SECRET', 'SLACK_APP_TOKEN']);
    if (!env.SLACK_BOT_TOKEN) return null;
    // SLACK_APP_TOKEN (xapp-…) enables Socket Mode: events arrive over an
    // outbound WebSocket, so no public HTTPS endpoint is required. When set,
    // the signing secret is optional (Slack signs socket frames separately).
    const useSocketMode = Boolean(env.SLACK_APP_TOKEN);
    const slackAdapter = createSlackAdapter({
      botToken: env.SLACK_BOT_TOKEN,
      signingSecret: env.SLACK_SIGNING_SECRET,
      appToken: env.SLACK_APP_TOKEN,
      mode: useSocketMode ? 'socket' : 'webhook',
    });
    const bridge = createChatSdkBridge({
      adapter: slackAdapter,
      concurrency: 'concurrent',
      supportsThreads: true,
      defaults: SLACK_DEFAULTS,
    });
    bridge.resolveChannelName = async (platformId: string) => {
      try {
        const info = await slackAdapter.fetchThread(platformId);
        return (info as { channelName?: string }).channelName ?? null;
      } catch {
        return null;
      }
    };

    // Slack's reactions API is add/remove individual emojis (vs Telegram's
    // "set the list" replace model), so we track the current reaction per
    // message and clear it before applying the next. Lifecycle is short
    // (~seconds), so the map stays tiny; a host restart mid-flight leaks at
    // most one stuck reaction per in-flight message.
    const currentReaction = new Map<string, string>();
    bridge.setReaction = async (platformId, threadId, platformMsgId, emoji) => {
      const tid = threadId ?? platformId;
      const key = `${tid} ${platformMsgId}`;
      const prev = currentReaction.get(key);
      if (prev) {
        try {
          await slackAdapter.removeReaction(tid, platformMsgId, prev);
        } catch {
          /* reactions are best-effort; ignore (already-removed, rate-limit, etc.) */
        }
        currentReaction.delete(key);
      }
      if (emoji == null) return;
      const name = STATUS_REACTION_NAMES[emoji];
      if (!name) return;
      try {
        await slackAdapter.addReaction(tid, platformMsgId, name);
        currentReaction.set(key, name);
      } catch {
        /* reactions are best-effort */
      }
    };

    return bridge;
  },
  defaults: SLACK_DEFAULTS,
});
