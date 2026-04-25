/**
 * Status reactions — default module.
 *
 * Sets emoji reactions on the user's most recent inbound message to
 * indicate the agent's lifecycle state on platforms that support it
 * (Telegram via setMessageReaction; others can implement the optional
 * `setReaction` adapter method).
 *
 *   👀 viewed     host saw the message and routed it
 *   🤔 thinking   container is waking, agent is loading
 *   ⚙️ working    agent is actively processing (heartbeat is fresh)
 *   ✅ done       a user-facing reply was delivered (cleared shortly after)
 *
 * Mirror of the typing module: heartbeat-driven, optional adapter
 * capability, no-ops on adapters that don't implement `setReaction`.
 *
 * Default module status:
 *   - Lives in src/modules/ for signaling, but ships on main and is
 *     imported directly by core. No registry, no hook.
 *   - Removing requires editing src/router.ts, src/delivery.ts, and
 *     src/container-runner.ts to drop the calls.
 */
import fs from 'fs';

import { heartbeatPath } from '../../session-manager.js';

const REACT_VIEWED = '👀';
const REACT_THINKING = '🤔';
const REACT_WORKING = '⚙️';
const REACT_DONE = '✅';

const POLL_MS = 1500;
/** Heartbeat must be mtimed within this window for the agent to count
 *  as actively working. Mirrors the typing module's threshold. */
const HEARTBEAT_FRESH_MS = 6000;
/** After ✅ done, wait this long before clearing the reaction. Long
 *  enough for the user to see, short enough that conversation history
 *  isn't littered with checkmarks. */
const POST_DELIVERY_CLEAR_MS = 4000;

interface StatusAdapter {
  setReaction?(
    channelType: string,
    platformId: string,
    threadId: string | null,
    platformMsgId: string,
    emoji: string | null,
  ): Promise<void>;
}

interface StatusTarget {
  agentGroupId: string;
  channelType: string;
  platformId: string;
  threadId: string | null;
  platformMsgId: string;
  current: string | null;
  poll: NodeJS.Timeout;
  clearTimer: NodeJS.Timeout | null;
}

let adapter: StatusAdapter | null = null;
const trackers = new Map<string, StatusTarget>();

/**
 * Bind the status-tracker to the channel delivery adapter so it can call
 * `setReaction`. Called once by `src/delivery.ts` inside
 * `setDeliveryAdapter`. Passing a fresh adapter replaces the prior binding.
 */
export function setStatusAdapter(a: StatusAdapter): void {
  adapter = a;
}

async function applyReaction(target: StatusTarget, emoji: string | null): Promise<void> {
  if (target.current === emoji) return;
  target.current = emoji;
  try {
    await adapter?.setReaction?.(target.channelType, target.platformId, target.threadId, target.platformMsgId, emoji);
  } catch {
    // Reactions are best-effort — never let them fail delivery.
  }
}

function isHeartbeatFresh(agentGroupId: string, sessionId: string): boolean {
  try {
    const stat = fs.statSync(heartbeatPath(agentGroupId, sessionId));
    return Date.now() - stat.mtimeMs < HEARTBEAT_FRESH_MS;
  } catch {
    return false;
  }
}

/**
 * Begin tracking status for a session, anchored to the platform message
 * id of the user's inbound. Idempotent: a second call for the same
 * session re-anchors to the new message and resets the reaction state.
 */
export function startStatusTracking(
  sessionId: string,
  agentGroupId: string,
  channelType: string,
  platformId: string,
  threadId: string | null,
  platformMsgId: string,
): void {
  const existing = trackers.get(sessionId);
  if (existing) {
    if (existing.clearTimer) {
      clearTimeout(existing.clearTimer);
      existing.clearTimer = null;
    }
    existing.platformMsgId = platformMsgId;
    existing.current = null;
    void applyReaction(existing, REACT_VIEWED);
    return;
  }

  const poll: NodeJS.Timeout = setInterval(() => {
    const entry = trackers.get(sessionId);
    if (!entry) return;
    // Promote 🤔 → ⚙️ once a heartbeat shows the agent is doing work.
    if (entry.current === REACT_THINKING && isHeartbeatFresh(entry.agentGroupId, sessionId)) {
      void applyReaction(entry, REACT_WORKING);
    }
  }, POLL_MS);
  poll.unref();

  const target: StatusTarget = {
    agentGroupId,
    channelType,
    platformId,
    threadId,
    platformMsgId,
    current: null,
    poll,
    clearTimer: null,
  };
  trackers.set(sessionId, target);
  void applyReaction(target, REACT_VIEWED);
}

/**
 * Called when the host wakes the container — the agent is loading.
 * Promotes 👀 → 🤔. The poll loop will move to ⚙️ once heartbeats show
 * actual work.
 */
export function onContainerWake(sessionId: string): void {
  const entry = trackers.get(sessionId);
  if (!entry) return;
  void applyReaction(entry, REACT_THINKING);
}

/**
 * Called by the delivery layer after a real user-facing message is
 * delivered. Sets ✅ done, then clears the reaction after a short
 * delay so the message returns to a neutral appearance.
 */
export function onReplyDelivered(sessionId: string): void {
  const entry = trackers.get(sessionId);
  if (!entry) return;
  void applyReaction(entry, REACT_DONE);
  if (entry.clearTimer) clearTimeout(entry.clearTimer);
  entry.clearTimer = setTimeout(() => {
    const stillThere = trackers.get(sessionId);
    if (!stillThere) return;
    void applyReaction(stillThere, null);
    stopStatusTracking(sessionId);
  }, POST_DELIVERY_CLEAR_MS);
  entry.clearTimer.unref();
}

export function stopStatusTracking(sessionId: string): void {
  const entry = trackers.get(sessionId);
  if (!entry) return;
  clearInterval(entry.poll);
  if (entry.clearTimer) clearTimeout(entry.clearTimer);
  // Clear any lingering reaction on the way out so a message doesn't get
  // stuck on 🤔/⚙️ if the container exits before delivering a reply.
  // Idempotent: applyReaction short-circuits when current === null.
  void applyReaction(entry, null);
  trackers.delete(sessionId);
}
