/**
 * Tests for deliverGeneratedFile — the runner's delivery path for files a
 * provider produces out-of-band (e.g. Codex's native image generation), which
 * arrive as `{ type: 'file' }` ProviderEvents with no destination attached.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { initTestSessionDb, closeSessionDb, getInboundDb } from './db/connection.js';
import { getUndeliveredMessages } from './db/messages-out.js';
import { setCurrentInReplyTo, clearCurrentInReplyTo } from './current-batch.js';
import { deliverGeneratedFile } from './outbound-file.js';

let tmpDir: string;
let outbox: string;
let imgPath: string;

beforeEach(() => {
  initTestSessionDb();
  // session_routing is host-written (not in the container's spawn schema);
  // create it here to simulate the host having committed this session's
  // reply routing, the same shape as src/db/schema.ts.
  getInboundDb()
    .prepare(
      `CREATE TABLE IF NOT EXISTS session_routing (
         id           INTEGER PRIMARY KEY CHECK (id = 1),
         channel_type TEXT,
         platform_id  TEXT,
         thread_id    TEXT
       )`,
    )
    .run();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'genfile-'));
  outbox = path.join(tmpDir, 'outbox');
  imgPath = path.join(tmpDir, 'render.png');
  fs.writeFileSync(imgPath, 'fake-png-bytes');
});

afterEach(() => {
  clearCurrentInReplyTo();
  closeSessionDb();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function seedSessionRouting(channel_type: string, platform_id: string, thread_id: string | null): void {
  getInboundDb()
    .prepare('INSERT INTO session_routing (id, channel_type, platform_id, thread_id) VALUES (1, ?, ?, ?)')
    .run(channel_type, platform_id, thread_id);
}

function seedSingleChannelDestination(): void {
  getInboundDb()
    .prepare(
      `INSERT INTO destinations (name, display_name, type, channel_type, platform_id, agent_group_id)
       VALUES ('chan', 'Chan', 'channel', 'slack', 'C-only', NULL)`,
    )
    .run();
}

describe('deliverGeneratedFile', () => {
  it('delivers to the session-bound conversation, preserving thread + in_reply_to', () => {
    seedSessionRouting('slack', 'C123', 'T-thread');
    setCurrentInReplyTo('inbound-7');

    const id = deliverGeneratedFile(imgPath, outbox);
    expect(id).not.toBeNull();

    const out = getUndeliveredMessages();
    expect(out).toHaveLength(1);
    expect(out[0].channel_type).toBe('slack');
    expect(out[0].platform_id).toBe('C123');
    expect(out[0].thread_id).toBe('T-thread');
    expect(out[0].in_reply_to).toBe('inbound-7');
    expect(JSON.parse(out[0].content)).toEqual({ text: '', files: ['render.png'] });

    // File copied into the outbox under the row id.
    expect(fs.existsSync(path.join(outbox, id!, 'render.png'))).toBe(true);
  });

  it('falls back to a lone configured destination when no session routing exists', () => {
    seedSingleChannelDestination();

    const id = deliverGeneratedFile(imgPath, outbox);
    expect(id).not.toBeNull();

    const out = getUndeliveredMessages();
    expect(out).toHaveLength(1);
    expect(out[0].channel_type).toBe('slack');
    expect(out[0].platform_id).toBe('C-only');
  });

  it('skips (returns null, no row) when no destination resolves', () => {
    const id = deliverGeneratedFile(imgPath, outbox);
    expect(id).toBeNull();
    expect(getUndeliveredMessages()).toHaveLength(0);
  });

  it('skips a missing file without throwing', () => {
    seedSessionRouting('slack', 'C123', null);
    const id = deliverGeneratedFile(path.join(tmpDir, 'does-not-exist.png'), outbox);
    expect(id).toBeNull();
    expect(getUndeliveredMessages()).toHaveLength(0);
  });
});
