/**
 * Unit tests for the Dial pairing store — code-mint / match / supersede logic,
 * plus the two hardening layers: 6-digit crypto codes with a TTL (expired codes
 * never consume) and a per-line guess rate limit (K wrong codes locks the line;
 * a correct code is refused while locked; a success resets the counter).
 * No DB or network: it's a JSON file under a temp path.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  _resetForTest,
  _setStorePathForTest,
  createPairing,
  extractCode,
  getLineLock,
  getPairing,
  tryConsume,
  waitForPairing,
} from './dial-pairing.js';

let dir: string;
let storeFile: string;
const savedEnv: Record<string, string | undefined> = {};
const ENV_KEYS = [
  'DIAL_PAIRING_TTL_MS',
  'DIAL_PAIRING_MAX_ATTEMPTS',
  'DIAL_PAIRING_ATTEMPT_WINDOW_MS',
  'DIAL_PAIRING_COOLDOWN_MS',
];

const LINE = '+13165550000';

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dial-pairing-'));
  storeFile = path.join(dir, 'dial-pairings.json');
  _setStorePathForTest(storeFile);
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
});
afterEach(() => {
  _resetForTest();
  _setStorePathForTest(null);
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  fs.rmSync(dir, { recursive: true, force: true });
});

/** A 6-digit code guaranteed different from `real`. */
function wrongCode(real: string): string {
  const alt = real === '000000' ? '111111' : '000000';
  return alt;
}
/** Read/patch/write the store file directly (to simulate elapsed time). */
function patchStore(
  mutate: (s: {
    pairings: Array<Record<string, unknown>>;
    lines?: Record<string, { failures: number; windowStart: string; lockedUntil?: string }>;
  }) => void,
): void {
  const s = JSON.parse(fs.readFileSync(storeFile, 'utf8'));
  mutate(s);
  fs.writeFileSync(storeFile, JSON.stringify(s, null, 2));
}
const consume = (text: string, opts: { line?: string; from?: string } = {}) =>
  tryConsume({ text, fromNumber: opts.from ?? '+15551230000', viaLine: opts.line ?? LINE });

describe('extractCode', () => {
  it('accepts a bare 6-digit body only', () => {
    expect(extractCode('123456')).toBe('123456');
    expect(extractCode('  654321 ')).toBe('654321');
    expect(extractCode('my code is 123456')).toBeNull();
    expect(extractCode('1234')).toBeNull(); // old 4-digit length no longer matches
    expect(extractCode('1234567')).toBeNull();
    expect(extractCode('hello')).toBeNull();
  });
});

describe('createPairing / tryConsume', () => {
  it('mints a 6-digit code and consumes it on an exact match', async () => {
    const rec = await createPairing();
    expect(rec.code).toMatch(/^\d{6}$/);
    expect(rec.status).toBe('pending');
    expect(Date.parse(rec.expiresAt)).toBeGreaterThan(Date.parse(rec.createdAt));

    const res = await consume(rec.code, { from: '+15551230000' });
    expect(res.record?.status).toBe('consumed');
    expect(res.record?.consumed?.fromNumber).toBe('+15551230000');
    expect(res.rateLimited).toBe(false);
  });

  it('does not consume a non-matching body', async () => {
    const rec = await createPairing();
    expect((await consume('not a code')).record).toBeNull();
    expect((await consume(wrongCode(rec.code))).record).toBeNull();
    // The real code still works afterward.
    expect((await consume(rec.code)).record?.status).toBe('consumed');
  });

  it('supersedes a prior pending code', async () => {
    const first = await createPairing();
    const second = await createPairing();
    expect(second.code).not.toBe(first.code);
    expect((await consume(first.code)).record).toBeNull(); // invalidated
    expect((await consume(second.code)).record?.status).toBe('consumed');
  });
});

describe('expiry', () => {
  it('does not consume a code past its expiresAt, and sweep invalidates it', async () => {
    const rec = await createPairing();
    // Simulate the TTL having elapsed by backdating the record's expiry.
    patchStore((s) => {
      for (const r of s.pairings) r.expiresAt = new Date(Date.now() - 1000).toISOString();
    });

    const res = await consume(rec.code);
    expect(res.record).toBeNull();
    // The sweep inside tryConsume flipped the stale pending record to invalidated.
    expect(getPairing(rec.code)?.status).toBe('invalidated');
  });

  it('waitForPairing rejects once the code expires', async () => {
    process.env.DIAL_PAIRING_TTL_MS = '40';
    const rec = await createPairing();
    await expect(waitForPairing(rec.code, 10)).rejects.toThrow(/expired/);
  });
});

describe('rate limiting', () => {
  it('locks a line after K wrong codes and refuses even a correct one', async () => {
    process.env.DIAL_PAIRING_MAX_ATTEMPTS = '3';
    process.env.DIAL_PAIRING_ATTEMPT_WINDOW_MS = String(10 * 60_000);
    process.env.DIAL_PAIRING_COOLDOWN_MS = String(15 * 60_000);

    const rec = await createPairing();
    const bad = wrongCode(rec.code);

    // Two wrong guesses: not yet locked.
    expect((await consume(bad)).rateLimited).toBe(false);
    expect((await consume(bad)).rateLimited).toBe(false);
    // Third wrong guess trips the lock.
    expect((await consume(bad)).rateLimited).toBe(true);

    // Correct code while locked is refused, not consumed.
    const locked = await consume(rec.code);
    expect(locked.record).toBeNull();
    expect(locked.rateLimited).toBe(true);

    // A different line is unaffected by this line's lock.
    const other = await consume(rec.code, { line: '+13165559999' });
    expect(other.record?.status).toBe('consumed');
  });

  it('reports the lock to the operator via getLineLock', async () => {
    process.env.DIAL_PAIRING_MAX_ATTEMPTS = '2';
    process.env.DIAL_PAIRING_COOLDOWN_MS = String(15 * 60_000);

    const rec = await createPairing();
    expect(getLineLock(LINE)).toBeNull();

    const bad = wrongCode(rec.code);
    await consume(bad);
    expect(getLineLock(LINE)).toBeNull();
    await consume(bad);

    // Locked: the wizard can now say why pairing went quiet.
    const until = getLineLock(LINE);
    expect(until).not.toBeNull();
    expect(Date.parse(until!)).toBeGreaterThan(Date.now());

    // Scoped to the line that was guessed at, and expired locks read as unlocked.
    expect(getLineLock('+13165559999')).toBeNull();
    expect(getLineLock(LINE, Date.parse(until!) + 1)).toBeNull();
  });

  it('consumes again after the cooldown lifts', async () => {
    process.env.DIAL_PAIRING_MAX_ATTEMPTS = '2';
    process.env.DIAL_PAIRING_ATTEMPT_WINDOW_MS = String(10 * 60_000);
    process.env.DIAL_PAIRING_COOLDOWN_MS = String(15 * 60_000);

    const rec = await createPairing();
    const bad = wrongCode(rec.code);
    await consume(bad);
    expect((await consume(bad)).rateLimited).toBe(true); // locked

    // Simulate the cooldown having elapsed.
    patchStore((s) => {
      if (s.lines) for (const st of Object.values(s.lines)) st.lockedUntil = new Date(Date.now() - 1000).toISOString();
    });

    const res = await consume(rec.code);
    expect(res.record?.status).toBe('consumed');
    expect(res.rateLimited).toBe(false);
  });

  it('resets the line counter after a successful pair', async () => {
    process.env.DIAL_PAIRING_MAX_ATTEMPTS = '3';

    const first = await createPairing();
    await consume(wrongCode(first.code)); // 1 failure
    await consume(wrongCode(first.code)); // 2 failures
    expect((await consume(first.code)).record?.status).toBe('consumed'); // success resets

    // A fresh code: the previous two failures are gone, so two more wrong
    // guesses do NOT lock (would have on the 3rd if the counter had carried).
    const second = await createPairing();
    expect((await consume(wrongCode(second.code))).rateLimited).toBe(false);
    expect((await consume(wrongCode(second.code))).rateLimited).toBe(false);
  });
});

describe('waitForPairing', () => {
  it('resolves once the code is consumed', async () => {
    const rec = await createPairing();
    const waiting = waitForPairing(rec.code, 20);
    await consume(rec.code, { from: '+15559998888' });
    const resolved = await waiting;
    expect(resolved.consumed?.fromNumber).toBe('+15559998888');
  });
});
