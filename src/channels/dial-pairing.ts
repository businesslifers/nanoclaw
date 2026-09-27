/**
 * Dial pairing — proves the operator controls a phone before it's registered.
 *
 * Setup mints a one-time 6-digit code; the operator texts exactly those 6
 * digits to the Dial number from the phone they want registered. The inbound
 * interceptor in dial.ts matches the code and records the sender's number as a
 * pairing candidate — before the message reaches an agent, and without granting
 * any role. The operator-run setup wizard (setup/pair-dial.ts) observes the same
 * consumed pairing and is the sole authority that grants the owner role. The
 * message must be exactly the 6 digits; a text that merely contains a 6-digit
 * number does NOT match.
 *
 * Hardening (defense in depth against a guessed code):
 *   - Codes are cryptographically random (node:crypto), 6 digits.
 *   - Codes EXPIRE (DIAL_PAIRING_TTL_MS, default 10 min): an expired pending
 *     code is swept to `invalidated` and never consumes.
 *   - Guesses are RATE-LIMITED per inbound line: after DIAL_PAIRING_MAX_ATTEMPTS
 *     wrong codes inside DIAL_PAIRING_ATTEMPT_WINDOW_MS the line is locked for
 *     DIAL_PAIRING_COOLDOWN_MS — even a correct code is refused while locked. A
 *     successful pair resets the line's counter.
 *
 * Storage is a JSON file at data/dial-pairings.json — single-process,
 * read-modify-write under an in-process mutex. Mirrors telegram-pairing.ts.
 */
import { randomInt } from 'node:crypto';
import fs from 'fs';
import path from 'path';

import { DATA_DIR } from '../config.js';
import { log } from '../log.js';

export type PairingStatus = 'pending' | 'consumed' | 'invalidated' | 'unknown';

export interface ConsumedDetails {
  /** The phone number (E.164) that sent the code. */
  fromNumber: string;
  consumedAt: string;
}

export interface PairingRecord {
  code: string;
  createdAt: string;
  /** ISO deadline after which a still-pending code is invalidated, never consumed. */
  expiresAt: string;
  status: Exclude<PairingStatus, 'unknown'>;
  consumed?: ConsumedDetails;
}

/** Per-inbound-line guess accounting, so a brute force on one line can't spill onto others. */
interface LineAttemptState {
  /** Failed (wrong-code) attempts inside the current window. */
  failures: number;
  /** ISO start of the current attempt window. */
  windowStart: string;
  /** ISO time until which the line is locked (guesses refused), if locked. */
  lockedUntil?: string;
}

interface Store {
  pairings: PairingRecord[];
  /** Keyed by the inbound Dial line (E.164) the guess arrived on. */
  lines?: Record<string, LineAttemptState>;
}

/** Outcome of an inbound-code match attempt. `record` is non-null only on consume. */
export interface ConsumeResult {
  record: PairingRecord | null;
  /** The line is currently locked (too many wrong guesses); nothing was consumed. */
  rateLimited: boolean;
}

const FILE_NAME = 'dial-pairings.json';

/** Reads env at call time so tests (and operators) can override without a restart dance. */
function envMs(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
function ttlMs(): number {
  return envMs('DIAL_PAIRING_TTL_MS', 10 * 60_000);
}
function maxAttempts(): number {
  return envMs('DIAL_PAIRING_MAX_ATTEMPTS', 5);
}
function attemptWindowMs(): number {
  return envMs('DIAL_PAIRING_ATTEMPT_WINDOW_MS', 10 * 60_000);
}
function cooldownMs(): number {
  return envMs('DIAL_PAIRING_COOLDOWN_MS', 15 * 60_000);
}

let storePathOverride: string | null = null;
export function _setStorePathForTest(p: string | null): void {
  storePathOverride = p;
}

function storePath(): string {
  return storePathOverride ?? path.join(DATA_DIR, FILE_NAME);
}

let mutex: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => Promise<T> | T): Promise<T> {
  const next = mutex.then(() => fn());
  mutex = next.catch(() => {});
  return next;
}

function readStore(): Store {
  try {
    const parsed = JSON.parse(fs.readFileSync(storePath(), 'utf8')) as Store;
    if (!Array.isArray(parsed.pairings)) return { pairings: [] };
    return parsed;
  } catch {
    return { pairings: [] };
  }
}

function writeStore(store: Store): void {
  const p = storePath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = `${p}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
  fs.renameSync(tmp, p);
}

function isExpired(record: PairingRecord, now: number): boolean {
  return record.status === 'pending' && Date.parse(record.expiresAt) <= now;
}

/**
 * Keep the store small and current: invalidate any pending code that's past its
 * expiry, drop line-attempt state whose lock has lifted and window has aged out,
 * and retain the most recent 50 pairing records.
 */
function sweep(store: Store, now = Date.now()): void {
  for (const r of store.pairings) {
    if (isExpired(r, now)) r.status = 'invalidated';
  }
  if (store.pairings.length > 50) store.pairings = store.pairings.slice(-50);
  if (store.lines) {
    for (const [line, state] of Object.entries(store.lines)) {
      const lockActive = state.lockedUntil ? Date.parse(state.lockedUntil) > now : false;
      const windowActive = Date.parse(state.windowStart) + attemptWindowMs() > now;
      if (!lockActive && !windowActive) delete store.lines[line];
    }
    if (Object.keys(store.lines).length === 0) delete store.lines;
  }
}

function generateCode(active: Set<string>): string {
  for (let i = 0; i < 50; i++) {
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    if (!active.has(code)) return code;
  }
  throw new Error('Could not allocate a free pairing code');
}

/** Mint a fresh pairing code, superseding any prior pending one. */
export async function createPairing(): Promise<PairingRecord> {
  return withLock(() => {
    const store = readStore();
    sweep(store);
    for (const r of store.pairings) {
      if (r.status === 'pending') r.status = 'invalidated';
    }
    const active = new Set(store.pairings.filter((r) => r.status === 'pending').map((r) => r.code));
    const now = Date.now();
    const record: PairingRecord = {
      code: generateCode(active),
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + ttlMs()).toISOString(),
      status: 'pending',
    };
    store.pairings.push(record);
    writeStore(store);
    log.info('Dial pairing created', { code: record.code, expiresAt: record.expiresAt });
    return record;
  });
}

/** A 6-digit-only body is a code candidate; anything else is not. */
export function extractCode(text: string): string | null {
  const m = text.trim().match(/^(\d{6})$/);
  return m ? m[1] : null;
}

/** Record a wrong-code guess for a line; returns whether the line is now locked. */
function registerFailure(store: Store, line: string, now: number): boolean {
  const lines = (store.lines ??= {});
  const state = lines[line] ?? { failures: 0, windowStart: new Date(now).toISOString() };
  // Fresh window if the previous one has aged out.
  if (Date.parse(state.windowStart) + attemptWindowMs() <= now) {
    state.windowStart = new Date(now).toISOString();
    state.failures = 0;
  }
  state.failures += 1;
  if (state.failures >= maxAttempts()) {
    state.lockedUntil = new Date(now + cooldownMs()).toISOString();
  }
  lines[line] = state;
  return !!state.lockedUntil && Date.parse(state.lockedUntil) > now;
}

/**
 * Match an inbound SMS body against a pending pairing. On a code candidate that
 * matches a live (non-expired, non-locked) pending record, marks it consumed and
 * returns it. A wrong code counts against the line's rate limit; once the line is
 * locked, even a correct code is refused until the cooldown lifts. A successful
 * consume resets the line's counter. `record` is null unless a code was consumed.
 */
export async function tryConsume(input: { text: string; fromNumber: string; viaLine: string }): Promise<ConsumeResult> {
  const code = extractCode(input.text);
  // Not a code candidate at all — not a guess, not rate-limited. Let it fall through.
  if (!code) return { record: null, rateLimited: false };
  return withLock(() => {
    const now = Date.now();
    const store = readStore();
    sweep(store, now);

    // Locked line: refuse everything (even the right code) until the cooldown lifts.
    const state = store.lines?.[input.viaLine];
    if (state?.lockedUntil && Date.parse(state.lockedUntil) > now) {
      writeStore(store); // persist any sweep changes
      return { record: null, rateLimited: true };
    }

    const record = store.pairings.find((r) => r.code === code && r.status === 'pending' && !isExpired(r, now));
    if (!record) {
      const nowLocked = registerFailure(store, input.viaLine, now);
      writeStore(store);
      return { record: null, rateLimited: nowLocked };
    }

    record.status = 'consumed';
    record.consumed = { fromNumber: input.fromNumber, consumedAt: new Date(now).toISOString() };
    // A real pair clears the line's guess history.
    if (store.lines) delete store.lines[input.viaLine];
    writeStore(store);
    log.info('Dial pairing consumed', { code, fromNumber: input.fromNumber });
    return { record, rateLimited: false };
  });
}

export function getPairing(code: string): PairingRecord | null {
  const store = readStore();
  return store.pairings.find((p) => p.code === code) ?? null;
}

/**
 * ISO time a line's guess lockout lifts, or null if it isn't locked. A lockout is
 * otherwise invisible to the operator — it doesn't touch the pairing record the
 * wizard watches, so without this the wizard would sit on "waiting…" through a
 * cooldown it can't explain. Read-only; nothing is surfaced to the sender.
 */
export function getLineLock(line: string, now = Date.now()): string | null {
  const until = readStore().lines?.[line]?.lockedUntil;
  return until && Date.parse(until) > now ? until : null;
}

/**
 * Resolve when the pairing is consumed; reject when it is superseded/invalidated
 * OR when the code's TTL expires. Uses fs.watch + a slow poll fallback, and
 * checks expiry on every tick so a code the operator never texted stops the wait
 * rather than hanging until the wizard's own timeout.
 */
export async function waitForPairing(code: string, pollMs = 1000): Promise<PairingRecord> {
  const initial = getPairing(code);
  if (!initial) throw new Error(`Unknown pairing code: ${code}`);

  return new Promise<PairingRecord>((resolve, reject) => {
    let watcher: fs.FSWatcher | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;
    let settled = false;

    const cleanup = () => {
      settled = true;
      try {
        watcher?.close();
      } catch {
        /* ignore */
      }
      if (interval) clearInterval(interval);
    };

    const check = () => {
      if (settled) return;
      const r = getPairing(code);
      if (!r) {
        cleanup();
        reject(new Error(`Pairing ${code} disappeared`));
        return;
      }
      if (r.status === 'consumed') {
        cleanup();
        resolve(r);
      } else if (r.status === 'invalidated') {
        cleanup();
        reject(new Error(`Pairing ${code} was superseded`));
      } else if (isExpired(r, Date.now())) {
        cleanup();
        reject(new Error(`Pairing ${code} expired`));
      }
    };

    try {
      const dir = path.dirname(storePath());
      fs.mkdirSync(dir, { recursive: true });
      watcher = fs.watch(dir, (_e, fname) => {
        if (!fname || fname.toString().startsWith(path.basename(storePath()))) check();
      });
    } catch {
      /* fs.watch unsupported — poll-only */
    }
    interval = setInterval(check, pollMs);
    check();
  });
}

/** Test helper — wipe the store. */
export function _resetForTest(): void {
  try {
    fs.unlinkSync(storePath());
  } catch {
    /* ignore */
  }
}
