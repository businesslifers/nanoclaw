/**
 * Slack channel adapter (v2) — uses Chat SDK bridge.
 * Self-registers on import.
 */
import { createSlackAdapter } from '@chat-adapter/slack';

import { readEnvFile } from '../env.js';
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

registerChannelAdapter('slack', {
  factory: () => {
    const env = readEnvFile(['SLACK_BOT_TOKEN', 'SLACK_SIGNING_SECRET']);
    if (!env.SLACK_BOT_TOKEN) return null;
    const slackAdapter = createSlackAdapter({
      botToken: env.SLACK_BOT_TOKEN,
      signingSecret: env.SLACK_SIGNING_SECRET,
    });
    const bridge = createChatSdkBridge({ adapter: slackAdapter, concurrency: 'concurrent', supportsThreads: true });
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
});
