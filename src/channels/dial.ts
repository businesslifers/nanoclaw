/**
 * Dial channel adapter for NanoClaw v2.
 *
 * Dial (https://getdial.ai) gives an agent a real phone number — SMS and
 * AI-handled voice calls. Native adapter (no Chat SDK bridge).
 *
 *   - Outbound SMS by shelling out to the `dial` CLI (`dial message --json`),
 *     which is already a hard requirement for inbound. Deliberately not the
 *     `@getdial/sdk` client (its `pubnub` dependency drags react-native, Metro
 *     and Hermes into the lockfile for one call) and deliberately not a raw
 *     REST call: the CLI ships in lockstep with the API, so a contract change
 *     arrives with a CLI release instead of breaking a pinned request here.
 *   - Inbound via Dial's documented CLI command-target
 *     (docs.getdial.ai/integrations/agent-clients/nanoclaw): the `dial listen`
 *     daemon runs a spool handler per event; the adapter watches the spool
 *     directory and routes each event.
 *
 * PUBLIC-LINE MODEL. The Dial number is one room shared by many people (a
 * messaging group whose platform_id is the number itself), and each remote
 * correspondent is a THREAD inside it (threadId = their E.164). One wiring +
 * `unknown_sender_policy: 'public'` therefore lets anyone text/call the number
 * and reach the agent with no per-sender approval, while replies still route
 * to the right person via their thread. A pairing code (see dial-pairing.ts)
 * only proves the operator controls a phone: the interceptor records the sender
 * as a pairing CANDIDATE before the message reaches an agent, and nothing more.
 * The owner role is granted solely by the operator-run setup wizard
 * (setup/pair-dial.ts) — an inbound SMS is never trusted to grant itself a role.
 *
 * Unlike other channels one platform_id serves many correspondents, so the
 * line must be a group: per-thread sessions are what keep them apart.
 *
 * Credentials come from Dial's auth file (written by `dial onboard`). If
 * there's no key the factory returns null and the channel is skipped.
 */
import { execFile, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import type { ChannelAdapter, ChannelDefaults, ChannelSetup, InboundMessage, OutboundMessage } from './adapter.js';
import { registerChannelAdapter } from './channel-registry.js';
import { tryConsume } from './dial-pairing.js';
import { DATA_DIR } from '../config.js';
import { getMessagingGroupsByChannel, updateMessagingGroup } from '../db/messaging-groups.js';
import { readEnvFile } from '../env.js';
import { log } from '../log.js';
import { nanoclawUserAgent } from './dial-user-agent.js';
import { getOwners } from '../modules/permissions/db/user-roles.js';
import { upsertUser } from '../modules/permissions/db/users.js';

/**
 * Record a matched pairing sender as a candidate for ownership. This does NOT
 * grant any role: an inbound SMS is not a trusted authority. The operator-run
 * setup wizard (setup/pair-dial.ts) is the only path that grants owner, after
 * it observes the same consumed pairing. Returns the recorded user id.
 */
export async function recordPairingCandidate(
  fromNumber: string,
  at: string = new Date().toISOString(),
): Promise<string> {
  const userId = `dial:${fromNumber}`;
  await upsertUser({ id: userId, kind: 'dial', display_name: null, created_at: at });
  return userId;
}

/** Longest SMS body sent in one shot; longer text is chunked. */
const MAX_CHUNK = 1500;

const execFileAsync = promisify(execFile);

/**
 * Environment for every `dial` invocation.
 *
 * The CLI is a Node script (`#!/usr/bin/env node`), so running it needs `node`
 * on PATH — not just the CLI itself. The service does not inherit the operator's
 * interactive PATH, and both binaries usually live in the same version-manager
 * bin directory, so PATH is widened with the CLI's own directory and the
 * directory of the Node currently running NanoClaw. Without this, an absolute
 * DIAL_CLI_PATH still fails with `env: node: No such file or directory`, the
 * inbound command target is never registered, and the channel comes up
 * connected but deaf.
 */
function cliEnvFor(cliPath: string): NodeJS.ProcessEnv {
  const current = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean);
  // Only an absolute cliPath contributes a directory. The factory falls back to
  // the bare name `dial`, and path.dirname('dial') is '.', which would put the
  // service's working directory on PATH ahead of every real bin dir — letting a
  // stray ./dial in the repo win command lookup over the installed CLI.
  const cliDir = path.isAbsolute(cliPath) ? path.dirname(cliPath) : '';
  const extra = [...new Set([cliDir, path.dirname(process.execPath)])].filter((d) => d && !current.includes(d));
  const merged = [...extra, ...current];
  return { ...process.env, PATH: merged.join(path.delimiter), DIAL_USER_AGENT: nanoclawUserAgent() };
}

/** Ceiling for one outbound send; the delivery layer retries a rejection. */
const SEND_TIMEOUT_MS = 30_000;

/** Dedup window — the listen daemon retries a failed handler invocation once. */
const DEDUP_TTL_MS = 5 * 60_000;

/**
 * Outbound delivery verdicts. `dial message` returns as soon as Dial ACCEPTS a
 * message; the carrier's verdict comes later as a `message.status_changed`
 * event (https://docs.getdial.ai/api-reference/events/message-status-changed).
 * The listen stream is presence-based and replays at most ~2 minutes of missed
 * events, so every send is also tracked here and, once it has gone quiet for
 * STATUS_GRACE_MS without a verdict, read back through `dial message list`.
 */
const STATUS_GRACE_MS = 3 * 60_000;
/** Stop tracking a send that never got a verdict; carriers settle well inside this. */
const STATUS_TRACK_TTL_MS = 24 * 60 * 60_000;
const STATUS_RECONCILE_INTERVAL_MS = 60_000;

/**
 * Every notice the adapter itself writes into a thread (delivery failures,
 * transcripts) opens with this so no reader mistakes it for something the
 * correspondent typed. The notice has to carry a sender to pass the line's
 * sender policy, and the thread's own correspondent is the only identity the
 * router already admits; NanoClaw has no first-class system sender yet.
 */
const SYSTEM_NOTICE = 'NanoClaw system notice:';

/**
 * A failure notice wakes the agent in the thread whose SMS just bounced. If the
 * agent answers it, that answer goes out over the same broken route, bounces,
 * and would raise another notice: a loop that costs a send and an agent turn
 * per lap. One notice per (line, correspondent) per window breaks it; the
 * notice itself also tells the agent not to reply over SMS.
 */
const FAILURE_NOTICE_COOLDOWN_MS = 60 * 60_000;

/**
 * `dial message list` returns at most this many rows, newest first, with no
 * paging. A busier account can push an old quiet send past the edge.
 */
const LIST_CAP = 100;

/**
 * Anything a correspondent typed, or said on a call, is rewritten so it cannot
 * pose as one of the adapter's own notices. Text is the only channel the
 * notice has, so the prefix is only worth something if nobody else can use it.
 */
function neutraliseNoticePrefix(text: string): string {
  return text.split(SYSTEM_NOTICE).join('(sender-typed) NanoClaw system notice:');
}

/**
 * Transcript text is routed to the agent inline (the sandbox usually has no
 * `dial` CLI to fetch it with). Longer transcripts are clipped; the notice
 * names the call id so the full text stays one `dial call get` away.
 */
const TRANSCRIPT_MAX_CHARS = 4000;

interface TrackedSend {
  to: string;
  from: string;
  /** Epoch ms of the send. */
  at: number;
}

/** Dial listen-daemon event envelope (the subset we consume). */
interface DialEventEnvelope {
  id?: string;
  type?: string;
  createdAt?: string;
  data?: Record<string, unknown>;
}

interface DialConfig {
  /**
   * Presence signal only — proof the host is signed in, which is what gates the
   * channel starting at all. The adapter never sends it: the CLI authenticates
   * itself from the same auth file this value was read out of, so there is one
   * credential path rather than two that can disagree.
   */
  apiKey: string;
  /** The account's Dial number (E.164). Used as the shared line's platform_id. */
  fromNumber: string;
  cliPath: string;
}

function chunkText(text: string, limit: number): string[] {
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= limit) {
      chunks.push(remaining);
      break;
    }
    let splitAt = remaining.lastIndexOf('\n', limit);
    if (splitAt <= 0) splitAt = limit;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).replace(/^\n/, '');
  }
  return chunks;
}

/**
 * The handler script Dial's listen daemon runs per event: it spools the event
 * JSON (passed as the final positional argument) into a directory the adapter
 * watches, written atomically (temp + rename). Runs with a clean env (PATH +
 * HOME only), so the spool dir is baked in as an absolute path.
 */
function handlerScript(spoolDir: string): string {
  return `#!/usr/bin/env bash
# Auto-generated by NanoClaw's Dial channel adapter (src/channels/dial.ts).
# Dial CLI command target: https://docs.getdial.ai/integrations/methods/cli-command-target
set -euo pipefail
[ "$#" -eq 0 ] && exit 0
spool=${JSON.stringify(spoolDir)}
mkdir -p "$spool"
event="\${!#}"   # value of the last positional parameter = the event JSON
tmp="$spool/.tmp.$$.\${RANDOM}"
printf '%s' "$event" > "$tmp"
mv -f "$tmp" "$spool/$(date +%s).$$.\${RANDOM}.json"
exit 0
`;
}

/**
 * `threads: true` gives each correspondent their own thread/session so replies
 * route back correctly. `strict` is the safe default for a row the router
 * auto-creates — a phone number is guessable, and an admitted sender gets a turn
 * with an agent holding account-scoped Dial credentials. Opening a line is the
 * operator's explicit per-line choice: the install skills pass
 * `--unknown-sender-policy` to `ncl messaging-groups create`.
 */
const DIAL_DEFAULTS: ChannelDefaults = {
  dm: { engageMode: 'pattern', engagePattern: '.', threads: true, unknownSenderPolicy: 'strict' },
  group: { engageMode: 'pattern', engagePattern: '.', threads: true, unknownSenderPolicy: 'strict' },
  mentions: 'dm-only',
};

export function createDialAdapter(config: DialConfig): ChannelAdapter {
  /**
   * The one outbound call this adapter makes: `dial message … --json`.
   *
   * The CLI is already a hard requirement (it registers the inbound command
   * target) and it authenticates from the same auth file this adapter reads, so
   * there is no second credential path. Every failure — non-zero exit, timeout,
   * unparseable output, `ok:false` — rejects, which is what puts the send on
   * delivery.ts's bounded retry path rather than marking it delivered
   * (see deliver()).
   */
  async function sendViaCli(params: { to: string; body: string; fromNumber?: string }): Promise<string | undefined> {
    const args = ['message', '--to', params.to, '--body', params.body, '--json'];
    if (params.fromNumber) args.push('--from-number', params.fromNumber);
    const { stdout } = await execFileAsync(config.cliPath, args, {
      encoding: 'utf8',
      timeout: SEND_TIMEOUT_MS,
      env: cliEnvFor(config.cliPath),
    });
    // `--json` prints {"ok":true,"message":{…}} on success. A non-zero exit
    // already rejected above; an unparseable stdout means the CLI changed shape
    // under us, which is a failure too — not a silent "delivered, no id".
    const parsed = JSON.parse(stdout) as { ok?: boolean; message?: { id?: string } };
    if (!parsed.ok) throw new Error(`Dial CLI reported a failed send: ${stdout.trim()}`);
    return parsed.message?.id;
  }
  const spoolDir = path.join(DATA_DIR, 'dial', 'inbound');
  const handlerPath = path.join(DATA_DIR, 'dial', 'handle-dial-event.sh');
  // Fallback line for events that don't name the number they arrived on. Each
  // event's actual destination (data.to) takes precedence, so the adapter
  // serves every number on the account, not just this one. Resolved lazily via
  // wiredLine() because the group doesn't exist yet when the adapter connects.
  const line = (): Promise<string> => wiredLine();

  let setup: ChannelSetup | null = null;
  let connected = false;
  let watcher: fs.FSWatcher | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let draining = false;
  const seen = new Map<string, number>();

  // Sends awaiting a carrier verdict, keyed by Dial message id. Persisted so a
  // host restart does not turn an undelivered reply into a silent one.
  const pendingPath = path.join(DATA_DIR, 'dial', 'pending-sends.json');
  const pending = new Map<string, TrackedSend>();
  let reconcileTimer: ReturnType<typeof setInterval> | null = null;
  let reconciling = false;
  // (line|peer) → epoch ms of the last failure notice routed to that thread.
  const lastFailureNotice = new Map<string, number>();
  let listCapWarned = false;

  function loadPending(): void {
    try {
      const raw = JSON.parse(fs.readFileSync(pendingPath, 'utf8')) as Record<string, TrackedSend>;
      for (const [id, t] of Object.entries(raw)) {
        if (t && typeof t.at === 'number')
          pending.set(id, { to: String(t.to ?? ''), from: String(t.from ?? ''), at: t.at });
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') log.warn('Dial: could not read pending sends', { err });
    }
  }

  function savePending(): void {
    try {
      fs.mkdirSync(path.dirname(pendingPath), { recursive: true });
      const tmp = `${pendingPath}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(Object.fromEntries(pending)));
      fs.renameSync(tmp, pendingPath);
    } catch (err) {
      log.warn('Dial: could not persist pending sends', { err });
    }
  }

  function trackSend(id: string, to: string, from: string): void {
    pending.set(id, { to, from, at: Date.now() });
    savePending();
  }

  function untrack(id: string): void {
    if (pending.delete(id)) savePending();
  }

  function seenBefore(id: string): boolean {
    const now = Date.now();
    for (const [k, ts] of seen) if (now - ts > DEDUP_TTL_MS) seen.delete(k);
    if (seen.has(id)) return true;
    seen.set(id, now);
    return false;
  }

  async function sendSms(to: string, body: string, from?: string): Promise<string | undefined> {
    // Send from the number the conversation is on (`from`); fall back to the
    // wired line. This is what lets one adapter serve multiple Dial numbers —
    // each reply goes out from the number the person actually texted.
    const fromNumber = from || (await wiredLine());
    let lastId: string | undefined;
    for (const chunk of body.length <= MAX_CHUNK ? [body] : chunkText(body, MAX_CHUNK)) {
      const sentId = await sendViaCli({
        to,
        body: chunk,
        ...(fromNumber ? { fromNumber } : {}),
      });
      if (sentId) trackSend(sentId, to, fromNumber || '');
      lastId = sentId ?? lastId;
    }
    return lastId;
  }

  /**
   * Pairing interceptor: if an inbound SMS body is exactly a pending 6-digit
   * code, consume it — record the sender's number as a pairing candidate (owner
   * is granted only by the setup wizard, never from an inbound SMS), confirm by
   * SMS — and swallow the message so it never reaches an agent. Returns true
   * when consumed. Wrong codes are rate-limited per line; while a line is locked
   * even a correct code is refused and the message falls through to the normal
   * sender-policy path (dropped for unknown senders).
   */
  async function consumePairing(fromNumber: string, text: string, viaLine: string): Promise<boolean> {
    let result;
    try {
      result = await tryConsume({ text, fromNumber, viaLine });
    } catch (err) {
      log.warn('Dial: pairing consume failed', { err });
      return false;
    }
    if (result.rateLimited) {
      log.warn('Dial: pairing attempts rate-limited for line', { line: viaLine });
    }
    if (!result.record) return false;

    await recordPairingCandidate(fromNumber);
    log.info('Dial: pairing code matched, recorded candidate — owner grant deferred to setup', {
      fromNumber,
      promotedToOwner: false,
    });
    try {
      await sendSms(fromNumber, 'Paired ✅ — your NanoClaw assistant is set up. Text me anytime.', viaLine);
    } catch (err) {
      log.warn('Dial: pairing confirmation SMS failed', { err });
    }
    return true;
  }

  /**
   * `is_group` is only written when the row is created, so a line registered
   * before its first message stays a DM — which collapses every correspondent
   * into one shared session. Runs per event, not just at startup: the line is
   * usually registered after the adapter connects. Also repairs older installs.
   *
   * Repairs `is_group` ONLY. `unknown_sender_policy` is operator state — set per
   * line at creation and changeable with `ncl` — so the adapter never writes it.
   */
  async function ensureLinesAreGroups(): Promise<void> {
    try {
      for (const mg of await getMessagingGroupsByChannel('dial')) {
        if (mg.is_group === 1) continue;
        await updateMessagingGroup(mg.id, { is_group: 1 });
        log.info('Dial: reconciled line to a group', { platformId: mg.platform_id });
      }
    } catch (err) {
      log.warn('Dial: could not reconcile the line — correspondents may share one session', { err });
    }
  }

  /**
   * The line this install is wired to. `config.fromNumber` comes from the auth
   * file, which `dial onboard` fills with the account's oldest number — not
   * necessarily the one setup wired — so prefer the registered group's own
   * platform_id and keep auth only as a pre-registration fallback.
   */
  async function wiredLine(): Promise<string> {
    try {
      const groups = await getMessagingGroupsByChannel('dial');
      if (groups.length === 1) return groups[0].platform_id;
    } catch (err) {
      log.warn('Dial: could not resolve the wired line', { err });
    }
    return config.fromNumber;
  }

  /** The paired operator's E.164, or '' if the install has no Dial owner yet. */
  async function ownerNumber(): Promise<string> {
    try {
      const owner = (await getOwners()).find((r) => r.user_id.startsWith('dial:'));
      return owner ? owner.user_id.slice('dial:'.length) : '';
    } catch (err) {
      log.warn('Dial: could not resolve the paired owner', { err });
      return '';
    }
  }

  /**
   * Apply one outbound delivery verdict, from a `message.status_changed` event
   * or from a reconcile read-back. Only the delivery axis matters: Dial reports
   * reads on a separate axis that SMS never populates. `pending` and
   * `unconfirmed` are not verdicts, so the send stays tracked.
   */
  async function applyDeliveryStatus(data: Record<string, unknown>, at?: string): Promise<void> {
    if (data.changed !== undefined && data.changed !== 'delivery') return;
    const messageId = typeof data.messageId === 'string' ? data.messageId : '';
    if (!messageId) return;
    const state = typeof data.deliveryState === 'string' ? data.deliveryState : '';
    const tracked = pending.get(messageId);
    if (!tracked) {
      // A verdict for a send this adapter did not make: the agent using the
      // `dial` CLI inside its sandbox, the operator on the dashboard, another
      // install on the same account. Not ours to route into a thread — doing
      // so would open sessions on lines this install never served.
      log.info('Dial: delivery verdict for a send this adapter did not make — ignoring', { messageId, state });
      return;
    }
    const to = (typeof data.to === 'string' && data.to) || tracked.to;
    const from = (typeof data.from === 'string' && data.from) || tracked.from;

    if (state === 'delivered') {
      untrack(messageId);
      log.info('Dial: outbound SMS delivered', { messageId, to });
      return;
    }
    if (state === 'unconfirmed' || state === 'unknown') {
      // This rail sends no delivery receipts (iMessage, some RCS): nothing
      // further will ever come for the delivery axis, so stop waiting.
      untrack(messageId);
      log.info('Dial: outbound message accepted on a rail without delivery receipts', { messageId, to, state });
      return;
    }
    if (state !== 'undelivered' && state !== 'failed') return;

    untrack(messageId);
    const reason =
      typeof data.deliveryError === 'string' && data.deliveryError ? data.deliveryError : 'The carrier gave no reason.';
    log.error('Dial: outbound SMS was not delivered', { messageId, to, from, state, reason });
    await notifyDeliveryFailure({ messageId, to, from, state, reason, at });
  }

  /**
   * Tell the agent that sent the message. The notice goes into the same line +
   * thread the reply went out on, attributed to the correspondent (the thread's
   * known sender, so it passes the line's sender policy) and opened with
   * SYSTEM_NOTICE so the attribution cannot mislead. It deliberately does NOT
   * go back out over SMS: that is the route that just failed.
   */
  async function notifyDeliveryFailure(f: {
    messageId: string;
    to: string;
    from: string;
    state: string;
    reason: string;
    at?: string;
  }): Promise<void> {
    if (!setup || !f.to) return;
    const activeLine = f.from || (await line());
    const platformId = activeLine || f.to;
    const threadId = activeLine ? f.to : null;

    const key = `${platformId}|${f.to}`;
    const last = lastFailureNotice.get(key) ?? 0;
    if (Date.now() - last < FAILURE_NOTICE_COOLDOWN_MS) {
      log.warn('Dial: further SMS to this correspondent bounced — notice already sent, not repeating', {
        messageId: f.messageId,
        to: f.to,
        state: f.state,
      });
      return;
    }
    lastFailureNotice.set(key, Date.now());

    const text = `[${SYSTEM_NOTICE} your SMS to ${f.to} was not delivered (${f.state}). ${f.reason} Assume ${f.to} did not receive your last message. Do not reply to this notice and do not resend over SMS: it will bounce the same way. If ${f.to} must be reached, tell the operator.]`;
    const msg: InboundMessage = {
      id: `${f.messageId}:delivery`,
      kind: 'chat',
      content: { text, sender: f.to, senderId: `dial:${f.to}`, senderName: f.to },
      isMention: true,
      isGroup: true,
      timestamp: f.at || new Date().toISOString(),
    };
    try {
      await setup.onInbound(platformId, threadId, msg);
    } catch (err) {
      log.error('Dial: could not route the delivery failure to the agent', { messageId: f.messageId, err });
    }
  }

  /**
   * Safety net for verdicts the event stream did not deliver (daemon down past
   * its ~2-minute replay window, host restart). Reads back every outbound
   * message since the oldest quiet send and applies any verdict it finds.
   * Messages have no get-by-id endpoint, so this is list-and-match.
   */
  async function reconcilePending(): Promise<void> {
    if (reconciling || !setup) return;
    const now = Date.now();
    const quiet: string[] = [];
    let oldest = now;
    let expired = false;
    for (const [id, t] of pending) {
      if (now - t.at > STATUS_TRACK_TTL_MS) {
        pending.delete(id);
        expired = true;
        log.warn('Dial: no delivery verdict for an outbound SMS after 24h — no longer tracking it', {
          messageId: id,
          to: t.to,
        });
        continue;
      }
      if (now - t.at < STATUS_GRACE_MS) continue;
      quiet.push(id);
      if (t.at < oldest) oldest = t.at;
    }
    if (expired) savePending();
    if (quiet.length === 0) return;

    reconciling = true;
    try {
      const since = new Date(oldest - 60_000).toISOString();
      const { stdout } = await execFileAsync(
        config.cliPath,
        ['message', 'list', '--json', '--direction', 'outbound', '--since', since],
        { encoding: 'utf8', timeout: SEND_TIMEOUT_MS, env: cliEnvFor(config.cliPath) },
      );
      const parsed = JSON.parse(stdout) as { ok?: boolean; messages?: Array<Record<string, unknown>> };
      if (!parsed.ok || !Array.isArray(parsed.messages)) {
        throw new Error(`unexpected \`dial message list\` output: ${stdout.trim().slice(0, 200)}`);
      }
      if (parsed.messages.length >= LIST_CAP && !listCapWarned) {
        listCapWarned = true;
        log.warn('Dial: `dial message list` returned its cap — older quiet sends may never be reconciled', {
          cap: LIST_CAP,
          pending: quiet.length,
        });
      }
      const wanted = new Set(quiet);
      for (const row of parsed.messages) {
        const id = typeof row.id === 'string' ? row.id : '';
        // An event may have settled this id while the list call was in flight.
        if (!wanted.has(id) || !pending.has(id)) continue;
        // `deliveryState`/`deliveryError` is the current shape; `status`/
        // `statusError` are the older aliases the API still returns.
        const state =
          typeof row.deliveryState === 'string' ? row.deliveryState : typeof row.status === 'string' ? row.status : '';
        const error =
          typeof row.deliveryError === 'string'
            ? row.deliveryError
            : typeof row.statusError === 'string'
              ? row.statusError
              : undefined;
        await applyDeliveryStatus(
          { messageId: id, deliveryState: state, deliveryError: error, to: row.to, from: row.from },
          typeof row.createdAt === 'string' ? row.createdAt : undefined,
        );
      }
    } catch (err) {
      log.warn('Dial: could not reconcile outbound delivery status', { pending: quiet.length, err });
    } finally {
      reconciling = false;
    }
  }

  /**
   * Read one call record through the CLI. `call.transcribed` is a thin event
   * (call id only), so direction, numbers and the transcript itself all come
   * from here. Returns null when the record cannot be read.
   */
  async function fetchCall(callId: string): Promise<{
    direction: string;
    from: string;
    to: string;
    duration: number | null;
    transcript: string;
  } | null> {
    try {
      const { stdout } = await execFileAsync(config.cliPath, ['call', 'get', callId, '--json'], {
        encoding: 'utf8',
        timeout: SEND_TIMEOUT_MS,
        env: cliEnvFor(config.cliPath),
      });
      const parsed = JSON.parse(stdout) as { ok?: boolean; call?: Record<string, unknown> } & Record<string, unknown>;
      if (parsed.ok === false) throw new Error(`Dial CLI could not read the call: ${stdout.trim().slice(0, 200)}`);
      const c = (parsed.call ?? parsed) as Record<string, unknown>;
      return {
        direction: typeof c.direction === 'string' ? c.direction : '',
        from: typeof c.from === 'string' ? c.from : '',
        to: typeof c.to === 'string' ? c.to : '',
        duration: typeof c.duration === 'number' ? c.duration : null,
        transcript: typeof c.transcript === 'string' ? c.transcript.trim() : '',
      };
    } catch (err) {
      log.warn('Dial: could not read the call record', { callId, err });
      return null;
    }
  }

  /** Route one inbound event — SMS text, call notifications and transcripts, outbound delivery verdicts. */
  async function routeEvent(env: DialEventEnvelope): Promise<void> {
    if (!setup) return;
    if (env.id && seenBefore(env.id)) return;
    const data = env.data ?? {};

    let peer = '';
    let text = '';
    // Set by branches whose natural id (the call id) is shared with another
    // event for the same call, so the two never collapse into one message.
    let messageId = '';
    // The Dial number this event arrived on (data.to for SMS; our own side of
    // a call). Used as the messaging group's platform_id so one adapter can
    // serve multiple Dial numbers — each number is its own group/line.
    let eventLine = '';
    if (env.type === 'message.received') {
      if (data.source && data.source !== 'external') return; // ignore Dial-synthesized test SMS
      peer = typeof data.from === 'string' ? data.from : '';
      eventLine = typeof data.to === 'string' ? data.to : '';
      text = typeof data.body === 'string' ? data.body : '';
      text = neutraliseNoticePrefix(text);
      // Pairing codes are consumed before any agent sees them. Confirm from the
      // number the code was sent to (falls back to the account default).
      if (peer && (await consumePairing(peer, text, eventLine || (await line())))) return;
    } else if (env.type === 'call.ended') {
      const outbound = data.direction === 'outbound';
      const mine = outbound ? data.from : data.to;
      eventLine = typeof mine === 'string' ? mine : '';
      const callee = typeof data.to === 'string' ? data.to : '';

      if (outbound) {
        // The outcome belongs to the operator who asked for the call, not to
        // the person we dialled.
        peer = await ownerNumber();
        if (!peer) {
          log.warn('Dial: outbound call ended but no paired owner to notify — dropping event', { callee });
          return;
        }
      } else {
        peer = typeof data.from === 'string' ? data.from : '';
      }

      const dur = typeof data.durationSeconds === 'number' ? `, ${data.durationSeconds}s` : '';
      const callId = typeof data.callId === 'string' ? data.callId : '';
      const transcript =
        data.transcriptAvailable && callId ? ` Run \`dial call get ${callId}\` for the transcript.` : '';
      const to = outbound && callee ? ` to ${callee}` : '';
      text = `[Voice call ${outbound ? 'outbound' : 'inbound'}${to} ${data.status ?? 'ended'}${data.canceled ? ' (canceled)' : ''}${dur}.${transcript}]`;
    } else if (env.type === 'call.transcribed') {
      // Fires once per call, shortly after call.ended, and carries only the
      // call id. Route the transcript to the same thread the call notice went
      // to: the caller for an inbound call, the operator for an outbound one.
      const callId = typeof data.callId === 'string' ? data.callId : '';
      if (!callId) return;
      const call = await fetchCall(callId);
      if (!call) return;
      const outbound = call.direction === 'outbound';
      eventLine = outbound ? call.from : call.to;
      if (outbound) {
        peer = await ownerNumber();
        if (!peer) {
          log.warn('Dial: outbound call transcribed but no paired owner to notify — dropping event', { callId });
          return;
        }
      } else {
        peer = call.from;
      }
      const who = outbound ? (call.to ? ` to ${call.to}` : '') : call.from ? ` from ${call.from}` : '';
      const dur = call.duration !== null ? ` (${call.duration}s)` : '';
      const dir = outbound ? 'outbound' : 'inbound';
      if (call.transcript) {
        call.transcript = neutraliseNoticePrefix(call.transcript);
        const clipped =
          call.transcript.length > TRANSCRIPT_MAX_CHARS
            ? `${call.transcript.slice(0, TRANSCRIPT_MAX_CHARS)}… (clipped — run \`dial call get ${callId}\` for the full transcript)`
            : call.transcript;
        text = `[${SYSTEM_NOTICE} transcript of the ${dir} call${who}${dur}:\n${clipped}]`;
      } else {
        text = `[${SYSTEM_NOTICE} transcript ready for the ${dir} call${who}${dur}. Run \`dial call get ${callId}\` to read it.]`;
      }
      messageId = `${callId}:transcript`;
    } else if (env.type === 'message.status_changed') {
      await applyDeliveryStatus(data, env.createdAt);
      return;
    } else {
      return;
    }
    if (!peer || !text) return;

    const id =
      messageId || [data.messageId, data.callId, env.id].find((v): v is string => typeof v === 'string' && !!v);
    // Public-line model: the Dial number itself is the messaging group; the peer
    // is the thread, so replies route back to them and every sender shares one
    // (public) wiring. `eventLine` is the number this event hit; fall back to the
    // account default when the event omits it (keeps single-number installs
    // unchanged).
    const activeLine = eventLine || (await line());
    const platformId = activeLine || peer;
    const threadId = activeLine ? peer : null;
    await ensureLinesAreGroups();
    const msg: InboundMessage = {
      id: id ?? peer,
      kind: 'chat',
      content: { text, sender: peer, senderId: `dial:${peer}`, senderName: peer },
      isMention: true,
      // One line serves many people; a DM would collapse them into one session.
      isGroup: true,
      timestamp: env.createdAt || new Date().toISOString(),
    };
    void Promise.resolve(setup.onInbound(platformId, threadId, msg)).catch((err) =>
      log.error('Dial: onInbound failed', { peer, err }),
    );
    log.info('Dial inbound routed', { peer, type: env.type });
  }

  function processSpoolFile(file: string): void {
    const full = path.join(spoolDir, file);
    let raw: string;
    try {
      raw = fs.readFileSync(full, 'utf8');
    } catch {
      return; // already consumed by a concurrent tick
    }
    try {
      fs.unlinkSync(full);
    } catch {
      /* best-effort */
    }
    if (!raw.trim()) return;
    let env: DialEventEnvelope;
    try {
      env = JSON.parse(raw) as DialEventEnvelope;
    } catch (err) {
      log.warn('Dial: unparseable spooled event', { file, err });
      return;
    }
    void routeEvent(env).catch((err) => log.error('Dial: routeEvent failed', { err }));
  }

  /** Drain the spool directory once, in filename (roughly chronological) order. */
  function drainSpool(): void {
    if (draining) return;
    draining = true;
    try {
      for (const f of fs
        .readdirSync(spoolDir)
        .filter((f) => f.endsWith('.json'))
        .sort()) {
        processSpoolFile(f);
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') log.debug('Dial: spool drain error', { err });
    } finally {
      draining = false;
    }
  }

  /**
   * Write the handler script and register it as a Dial CLI command target.
   * Returns true when the target is CONFIRMED registered.
   *
   * Still never throws, and the caller still connects on false, because a
   * failure here does not mean the target is missing: the /add-dial skill runs
   * `dial local-target add cmd` itself, so a working install can reach this code
   * with the target already in place and only the re-assert failing. Blocking
   * connect on false would take down a channel that receives fine — and would
   * kill outbound with it, including the operator's own error notification.
   *
   * What false DOES mean is that nothing here verified inbound can route, so it
   * is reported at error level and the connect line is stamped `unverified`
   * rather than presenting as unqualified health.
   */
  function ensureCommandTarget(): boolean {
    try {
      fs.mkdirSync(path.dirname(handlerPath), { recursive: true });
      fs.writeFileSync(handlerPath, handlerScript(spoolDir), { mode: 0o755 });
      fs.chmodSync(handlerPath, 0o755);
    } catch (err) {
      log.error('Dial: could not write command-target handler — inbound will not route', { handlerPath, err });
      return false;
    }
    const cliEnv = cliEnvFor(config.cliPath);
    try {
      const listed = execFileSync(config.cliPath, ['local-target', 'list', '--json'], {
        encoding: 'utf8',
        timeout: 15_000,
        env: cliEnv,
      });
      if (!listed.includes(handlerPath)) {
        execFileSync(config.cliPath, ['local-target', 'add', 'cmd', handlerPath], {
          stdio: 'ignore',
          timeout: 15_000,
          env: cliEnv,
        });
        log.info('Dial: registered CLI command target', { handlerPath });
      }
      return true;
    } catch (err) {
      // Two distinct failures land here, and the second is easy to miss: the
      // `dial` binary is a `#!/usr/bin/env node` script, so an absolute
      // DIAL_CLI_PATH fixes discovery but the shebang still needs `node` on the
      // service's PATH. A service unit that hardcodes an absolute node path to
      // start the host, yet omits that directory from PATH, turns ENOENT into
      // `env: node: No such file or directory`. Both are named here so the log
      // line is enough to fix either one.
      log.error(
        'Dial: could not register command target — inbound SMS and calls may not route. ' +
          'Set DIAL_CLI_PATH to the absolute `dial` path, make sure the service PATH can resolve `node` ' +
          '(the CLI is a node script), and check `dial listen install` has run.',
        { cliPath: config.cliPath, err },
      );
      return false;
    }
  }

  const adapter: ChannelAdapter = {
    name: 'dial',
    channelType: 'dial',
    supportsThreads: true,
    defaults: DIAL_DEFAULTS,

    async setup(cfg: ChannelSetup): Promise<void> {
      setup = cfg;
      await ensureLinesAreGroups();
      fs.mkdirSync(spoolDir, { recursive: true });
      const commandTarget = ensureCommandTarget() ? 'ok' : 'unverified';

      loadPending(); // before the spool: a verdict spooled while we were down must find its send
      drainSpool(); // anything spooled while we were down
      void reconcilePending(); // verdicts that never reached the spool
      reconcileTimer = setInterval(() => void reconcilePending(), STATUS_RECONCILE_INTERVAL_MS);
      try {
        watcher = fs.watch(spoolDir, () => drainSpool());
      } catch (err) {
        log.debug('Dial: fs.watch unavailable, relying on poll', { err });
      }
      pollTimer = setInterval(drainSpool, 2000); // fallback — fs.watch misses events on some mounts

      connected = true;
      log.info('Dial channel connected', { line: config.fromNumber || '(account default)', commandTarget });
    },

    async teardown(): Promise<void> {
      connected = false;
      watcher?.close();
      watcher = null;
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
      if (reconcileTimer) clearInterval(reconcileTimer);
      reconcileTimer = null;
      log.info('Dial channel disconnected');
    },

    isConnected(): boolean {
      return connected;
    },

    async deliver(platformId: string, threadId: string | null, message: OutboundMessage): Promise<string | undefined> {
      const content = message.content as Record<string, unknown> | string | undefined;
      const text =
        typeof content === 'string'
          ? content
          : content && typeof content === 'object' && typeof content.text === 'string'
            ? content.text
            : '';
      if (!text) return undefined;

      // Public-line model: the correspondent is the thread. Reply to threadId;
      // platformId is the Dial line this conversation is on. Never text the
      // line's own number, and send the reply FROM that line so multi-number
      // installs answer from the number the person texted.
      const recipient = threadId || platformId;
      if (!recipient || recipient === platformId) {
        log.warn('Dial: no reply recipient (no thread) — dropping outbound', { platformId, threadId });
        return undefined;
      }
      // Let a failed send throw. `undefined` means "delivered, no platform id"
      // in the adapter contract, so catching here would have delivery.ts mark
      // the message delivered and clear the outbox — a silent loss. Throwing
      // puts Dial on the bounded retry path (3 attempts, then
      // markDeliveryFailed), which logs the failure.
      //
      // Deliberate trade-off: sendSms chunks long bodies, so if chunk 1 sends
      // and chunk 2 throws, the retry resends chunk 1 and a long message can
      // arrive twice. A duplicate SMS is preferable to a silently dropped one.
      return await sendSms(recipient, text, platformId);
    },
  };

  return adapter;
}

// ---------------------------------------------------------------------------
// Self-registration
// ---------------------------------------------------------------------------

registerChannelAdapter('dial', {
  factory: () => {
    // Credentials come from Dial's own auth file (written by `dial onboard`).
    const authFile = path.join(
      process.env.XDG_DATA_HOME || path.join(homedir(), '.local', 'share'),
      'dial',
      'auth.v1.json',
    );
    let apiKey = '';
    let fromNumber = '';
    try {
      const auth = JSON.parse(fs.readFileSync(authFile, 'utf8')) as { apiKey?: string; phoneNumber?: string };
      apiKey = auth.apiKey ?? '';
      fromNumber = auth.phoneNumber ?? '';
    } catch {
      /* no auth file — not signed in */
    }
    if (!apiKey) {
      log.debug('Dial: not signed in (run `dial signup` + `dial onboard`), skipping channel');
      return null;
    }

    const env = readEnvFile(['DIAL_CLI_PATH']);
    const cliPath = process.env.DIAL_CLI_PATH || env.DIAL_CLI_PATH || 'dial';
    return createDialAdapter({ apiKey, fromNumber, cliPath });
  },
  defaults: DIAL_DEFAULTS,
});
