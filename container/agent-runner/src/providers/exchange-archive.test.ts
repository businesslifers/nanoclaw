import { afterEach, describe, expect, it } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { archiveProviderExchange } from './exchange-archive.js';

let tmpDir: string | null = null;

afterEach(() => {
  if (tmpDir) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = null;
  }
});

function makeTmpDir(): string {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nanoclaw-archive-'));
  return tmpDir;
}

describe('provider exchange archive', () => {
  it('writes unique exchange-level archives with provider metadata', () => {
    const conversationsDir = makeTmpDir();
    const timestamp = new Date('2026-06-03T12:34:56.789Z');

    const first = archiveProviderExchange({
      conversationsDir,
      provider: 'codex',
      prompt: 'hello',
      result: 'world',
      continuation: 'thread-123',
      status: 'completed',
      timestamp,
    });
    const second = archiveProviderExchange({
      conversationsDir,
      provider: 'codex',
      prompt: 'hello again',
      result: 'world again',
      continuation: 'thread-123',
      status: 'completed',
      timestamp,
    });

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(first).not.toBe(second);

    const content = fs.readFileSync(path.join(conversationsDir, first!), 'utf-8');
    expect(content).toContain('# Codex Exchange');
    expect(content).toContain('Provider: codex');
    expect(content).toContain('Continuation/thread id: thread-123');
    expect(content).toContain('Status: completed');
    expect(content).toContain('**User**: hello');
    expect(content).toContain('**Assistant**: world');
  });

  it('skips empty result text', () => {
    const conversationsDir = makeTmpDir();
    const filename = archiveProviderExchange({
      conversationsDir,
      provider: 'codex',
      prompt: 'hello',
      result: '   ',
      continuation: 'thread-123',
      status: 'completed',
    });

    expect(filename).toBeNull();
    expect(fs.readdirSync(conversationsDir)).toHaveLength(0);
  });
});
