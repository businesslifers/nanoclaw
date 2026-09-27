import fs from 'fs';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The adapter shells out to the `dial` CLI to send. Intercept execFile so the
// test asserts the exact argv and env handed to it, with no process spawned.
const spawns: Array<{ file: string; args: string[]; opts: Record<string, unknown> }> = [];
let cliResult: { stdout: string } | Error = { stdout: JSON.stringify({ ok: true, message: { id: 'msg_1' } }) };

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  const execFile = (file: string, args: string[], opts: Record<string, unknown>, cb?: unknown) => {
    spawns.push({ file, args, opts });
    const done = cb as ((e: Error | null, r?: { stdout: string }) => void) | undefined;
    if (cliResult instanceof Error) done?.(cliResult);
    else done?.(null, cliResult);
    return undefined as never;
  };
  // promisify(execFile) reads this symbol to build the promise-returning form.
  (execFile as unknown as Record<symbol, unknown>)[Symbol.for('nodejs.util.promisify.custom')] = (
    file: string,
    args: string[],
    opts: Record<string, unknown>,
  ) => {
    spawns.push({ file, args, opts });
    return cliResult instanceof Error ? Promise.reject(cliResult) : Promise.resolve(cliResult);
  };
  return { ...actual, execFile };
});

import type { OutboundMessage } from './adapter.js';
import { createDialAdapter } from './dial.js';
import { nanoclawUserAgent } from './dial-user-agent.js';

/** Send one reply through the adapter and hand back the intercepted spawn. */
async function captureSend(): Promise<{ file: string; args: string[]; opts: Record<string, unknown> }> {
  spawns.length = 0;
  const adapter = createDialAdapter({ apiKey: 'sk_live_test', fromNumber: '+14155550123', cliPath: '/usr/bin/dial' });
  await adapter.deliver('+14155550123', '+15557654321', { content: 'hi' } as unknown as OutboundMessage);
  const sends = spawns.filter((s) => s.args[0] === 'message');
  expect(sends).toHaveLength(1);
  return sends[0];
}

describe('Dial adapter outbound send', () => {
  beforeEach(() => {
    cliResult = { stdout: JSON.stringify({ ok: true, message: { id: 'msg_1' } }) };
  });

  it('passes the NanoClaw user-agent token to the CLI', async () => {
    const { opts } = await captureSend();
    const env = opts.env as Record<string, string>;
    expect(env.DIAL_USER_AGENT).toBe(nanoclawUserAgent());
    expect(env.DIAL_USER_AGENT).toMatch(/^nanoclaw\//);
  });

  it('invokes the resolved CLI path with the documented send arguments', async () => {
    const { file, args } = await captureSend();
    expect(file).toBe('/usr/bin/dial');
    expect(args).toEqual([
      'message',
      '--to',
      '+15557654321',
      '--body',
      'hi',
      '--json',
      '--from-number',
      '+14155550123',
    ]);
  });

  it("prepends the CLI's own directory to PATH so its node shebang resolves", async () => {
    // The CLI is a node script, so spawning it needs `node` on PATH — which the
    // service's PATH may not carry. node and dial share a bin directory, so that
    // directory going on PATH is what makes the shebang resolve.
    spawns.length = 0;
    const adapter = createDialAdapter({
      apiKey: 'sk_live_test',
      fromNumber: '+14155550123',
      cliPath: '/opt/nodebin/dial',
    });
    await adapter.deliver('+14155550123', '+15557654321', { content: 'hi' } as unknown as OutboundMessage);
    const send = spawns.filter((s) => s.args[0] === 'message')[0];
    const dirs = ((send.opts.env as Record<string, string>).PATH ?? '').split(':');
    expect(dirs).toContain('/opt/nodebin');
    expect(dirs).toContain(path.dirname(process.execPath));
  });

  it('never puts the working directory on PATH when the CLI path is a bare name', async () => {
    // The factory falls back to `dial` when DIAL_CLI_PATH is unset, and
    // path.dirname('dial') is '.'. Prepending that would let a stray ./dial in
    // the repo win command lookup over the installed CLI.
    spawns.length = 0;
    const adapter = createDialAdapter({ apiKey: 'sk_live_test', fromNumber: '+14155550123', cliPath: 'dial' });
    await adapter.deliver('+14155550123', '+15557654321', { content: 'hi' } as unknown as OutboundMessage);
    const send = spawns.filter((s) => s.args[0] === 'message')[0];
    const dirs = ((send.opts.env as Record<string, string>).PATH ?? '').split(':');
    expect(dirs).not.toContain('.');
    expect(dirs).not.toContain('');
    // …while node stays resolvable, so the CLI's shebang still works.
    expect(dirs).toContain(path.dirname(process.execPath));
  });

  it('rejects when the CLI exits non-zero so the send lands on the retry path', async () => {
    cliResult = new Error('Command failed: dial message');
    const adapter = createDialAdapter({ apiKey: 'sk_live_test', fromNumber: '+14155550123', cliPath: '/usr/bin/dial' });
    await expect(
      adapter.deliver('+14155550123', '+15557654321', { content: 'hi' } as unknown as OutboundMessage),
    ).rejects.toThrow(/Command failed/);
  });

  it('rejects when the CLI reports ok:false rather than reporting a delivery', async () => {
    cliResult = { stdout: JSON.stringify({ ok: false, error: 'nope' }) };
    const adapter = createDialAdapter({ apiKey: 'sk_live_test', fromNumber: '+14155550123', cliPath: '/usr/bin/dial' });
    await expect(
      adapter.deliver('+14155550123', '+15557654321', { content: 'hi' } as unknown as OutboundMessage),
    ).rejects.toThrow(/failed send/);
  });
});

// The module caches after the first call, so each test re-imports it fresh.
async function freshToken(): Promise<string> {
  vi.resetModules();
  const mod = await import('./dial-user-agent.js');
  return mod.nanoclawUserAgent();
}

describe('nanoclawUserAgent', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is nanoclaw/<semver> from this repo's package.json", async () => {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')) as { version: string };
    expect(await freshToken()).toBe(`nanoclaw/${pkg.version}`);
  });

  it('degrades to nanoclaw/unknown rather than throwing when package.json is unreadable', async () => {
    vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
      throw new Error('ENOENT');
    });
    expect(await freshToken()).toBe('nanoclaw/unknown');
  });

  it('degrades to nanoclaw/unknown when package.json carries no version field', async () => {
    vi.spyOn(fs, 'readFileSync').mockReturnValue('{"name":"nanoclaw"}');
    expect(await freshToken()).toBe('nanoclaw/unknown');
  });

  it('carries no CR/LF, which would make the header itself unsendable', () => {
    expect(nanoclawUserAgent()).not.toMatch(/[\r\n]/);
  });
});
