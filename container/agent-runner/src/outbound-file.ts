/**
 * Deliver a provider-generated file to chat.
 *
 * Some providers write files out-of-band rather than through the `send_file`
 * MCP tool — e.g. Codex's native image generation saves PNGs into
 * CODEX_HOME/generated_images/<thread>/ and only emits a `{ type: 'file' }`
 * ProviderEvent. The provider can't address a destination (it has no routing
 * context), so the runner delivers the file itself: to the conversation this
 * session is bound to, exactly where `send_file` lands when the agent omits
 * `to`. Mirrors the outbox mechanism in mcp-tools/core.ts `send_file`.
 */
import fs from 'fs';
import path from 'path';

import { getAllDestinations } from './destinations.js';
import { writeMessageOut } from './db/messages-out.js';
import { getCurrentInReplyTo } from './db/session-state.js';
import { getSessionRouting } from './db/session-routing.js';

function log(msg: string): void {
  console.error(`[outbound-file] ${msg}`);
}

function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Where the file should land, or null if no destination is resolvable. */
function resolveDeliveryTarget(): { channel_type: string; platform_id: string; thread_id: string | null } | null {
  // Primary: the conversation this session replies into (same default
  // `send_file` uses with no `to`). Set by the host on every wake.
  const session = getSessionRouting();
  if (session.channel_type && session.platform_id) {
    return { channel_type: session.channel_type, platform_id: session.platform_id, thread_id: session.thread_id };
  }

  // Fallback (agent-shared / internal sessions have no bound conversation):
  // a lone configured destination, routed by its type as send_file would.
  const all = getAllDestinations();
  if (all.length !== 1) return null;
  const only = all[0];
  if (only.type === 'channel' && only.channelType && only.platformId) {
    return { channel_type: only.channelType, platform_id: only.platformId, thread_id: null };
  }
  if (only.type === 'agent' && only.agentGroupId) {
    return { channel_type: 'agent', platform_id: only.agentGroupId, thread_id: null };
  }
  return null;
}

/**
 * Queue a provider-generated file for delivery. Returns the outbound row id, or
 * null if the file is missing or no destination resolves. Never throws — the
 * poll-loop calls this mid-stream and a delivery hiccup must not abort the turn.
 *
 * `outboxBase` is injectable for tests; production always uses the default
 * mount path the host watches.
 */
export function deliverGeneratedFile(filePath: string, outboxBase = '/workspace/outbox'): string | null {
  try {
    if (!fs.existsSync(filePath)) {
      log(`skip: file not found: ${filePath}`);
      return null;
    }

    const target = resolveDeliveryTarget();
    if (!target) {
      log(`skip: no destination resolvable for ${filePath}`);
      return null;
    }

    const id = generateId();
    const filename = path.basename(filePath);
    const outboxDir = path.join(outboxBase, id);
    fs.mkdirSync(outboxDir, { recursive: true });
    fs.copyFileSync(filePath, path.join(outboxDir, filename));

    writeMessageOut({
      id,
      in_reply_to: getCurrentInReplyTo(),
      kind: 'chat',
      platform_id: target.platform_id,
      channel_type: target.channel_type,
      thread_id: target.thread_id,
      content: JSON.stringify({ text: '', files: [filename] }),
    });

    return id;
  } catch (err) {
    log(`failed to deliver ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}
