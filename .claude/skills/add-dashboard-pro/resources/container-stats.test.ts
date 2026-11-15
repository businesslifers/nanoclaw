// Pure-parser + watchdog tests for container-stats. The docker shell-out
// path is exercised in production; here we cover what we can run hermetically.
import { describe, expect, it } from 'vitest';

import {
  CpuWatchdog,
  parseFolderFromName,
  parseMemUsage,
  parsePercent,
  parseSize,
  parseStatsRow,
} from './container-stats.js';

describe('parseSize', () => {
  it('converts decimal SI units', () => {
    expect(parseSize('1KB')).toBe(1_000);
    expect(parseSize('1.5GB')).toBe(1_500_000_000);
  });
  it('converts binary IEC units', () => {
    expect(parseSize('1KiB')).toBe(1024);
    expect(parseSize('1.5GiB')).toBe(Math.round(1.5 * 1024 ** 3));
  });
  it('handles whitespace and case', () => {
    expect(parseSize('4.5 mib')).toBe(Math.round(4.5 * 1024 ** 2));
  });
  it('returns 0 on garbage', () => {
    expect(parseSize('')).toBe(0);
    expect(parseSize(undefined)).toBe(0);
    expect(parseSize('huh')).toBe(0);
  });
});

describe('parseMemUsage', () => {
  it('splits used / limit', () => {
    const r = parseMemUsage('4.5MiB / 7.7GiB');
    expect(r.used).toBe(Math.round(4.5 * 1024 ** 2));
    expect(r.limit).toBe(Math.round(7.7 * 1024 ** 3));
  });
  it('handles missing input', () => {
    expect(parseMemUsage(undefined)).toEqual({ used: 0, limit: 0 });
  });
});

describe('parsePercent', () => {
  it('strips percent sign', () => {
    expect(parsePercent('98.4%')).toBeCloseTo(98.4);
    expect(parsePercent('0.00%')).toBe(0);
  });
  it('returns 0 on garbage', () => {
    expect(parsePercent(undefined)).toBe(0);
    expect(parsePercent('--')).toBe(0);
  });
});

describe('parseFolderFromName', () => {
  it('extracts simple folder', () => {
    expect(parseFolderFromName('nanoclaw-v2-foo-1700000000000')).toBe('foo');
  });
  it('preserves hyphens inside the folder name', () => {
    expect(parseFolderFromName('nanoclaw-v2-content-team-1700000000000')).toBe('content-team');
  });
  it('returns null for non-matching names', () => {
    expect(parseFolderFromName('some-other-container')).toBeNull();
    expect(parseFolderFromName('nanoclaw-v2-foo-bar')).toBeNull(); // no epoch
  });
});

describe('parseStatsRow', () => {
  it('parses a real-shaped docker stats line', () => {
    const json = JSON.stringify({
      Name: 'nanoclaw-v2-foo-1700000000000',
      CPUPerc: '12.34%',
      MemUsage: '4.5MiB / 7.7GiB',
      MemPerc: '0.06%',
    });
    // parseStatsRow takes containerName → sessionId
    const nameToSession = new Map([['nanoclaw-v2-foo-1700000000000', 'sess-abc']]);
    const stat = parseStatsRow(json, nameToSession);
    expect(stat).not.toBeNull();
    expect(stat!.name).toBe('nanoclaw-v2-foo-1700000000000');
    expect(stat!.sessionId).toBe('sess-abc');
    expect(stat!.folder).toBe('foo');
    expect(stat!.cpuPercent).toBeCloseTo(12.34);
    expect(stat!.memPercent).toBeCloseTo(0.06);
  });

  it('returns null on invalid JSON', () => {
    expect(parseStatsRow('not json', new Map())).toBeNull();
  });

  it('returns null when Name field missing', () => {
    expect(parseStatsRow('{"CPUPerc":"5%"}', new Map())).toBeNull();
  });

  it('leaves sessionId null for unknown containers', () => {
    const json = JSON.stringify({ Name: 'unknown', CPUPerc: '0%', MemUsage: '0B / 0B', MemPerc: '0%' });
    const stat = parseStatsRow(json, new Map());
    expect(stat!.sessionId).toBeNull();
  });
});

describe('CpuWatchdog', () => {
  const stat = (sessionId: string | null, cpuPercent: number) => ({
    name: 'c',
    sessionId,
    folder: null,
    cpuPercent,
    memUsageBytes: 0,
    memLimitBytes: 0,
    memPercent: 0,
  });

  it('does not flag until window is full', () => {
    const w = new CpuWatchdog(3, 80);
    w.record([stat('sess-a', 95)]);
    w.record([stat('sess-a', 95)]);
    expect(w.pinned()).toEqual([]);
    w.record([stat('sess-a', 95)]);
    expect(w.pinned()).toHaveLength(1);
  });

  it('clears the flag when CPU drops below threshold within the window', () => {
    const w = new CpuWatchdog(3, 80);
    w.record([stat('sess-a', 95)]);
    w.record([stat('sess-a', 95)]);
    w.record([stat('sess-a', 95)]);
    expect(w.pinned()).toHaveLength(1);
    w.record([stat('sess-a', 10)]);
    expect(w.pinned()).toEqual([]);
  });

  it('garbage-collects sessions that disappear from the active set', () => {
    const w = new CpuWatchdog(3, 80);
    w.record([stat('sess-a', 95)]);
    expect(w._historyFor('sess-a')).toBeDefined();
    w.record([]); // sess-a gone
    expect(w._historyFor('sess-a')).toBeUndefined();
  });

  it('ignores stats without a sessionId', () => {
    const w = new CpuWatchdog(3, 80);
    w.record([stat(null, 99)]);
    expect(w.pinned()).toEqual([]);
  });

  it('reports the lowest reading in the window so the message reflects sustained load', () => {
    const w = new CpuWatchdog(3, 80);
    w.record([stat('sess-a', 99)]);
    w.record([stat('sess-a', 81)]);
    w.record([stat('sess-a', 95)]);
    const [p] = w.pinned();
    expect(p.minPercent).toBe(81);
  });
});

describe('runtime-name → human-name mapping (session-driver seam)', () => {
  it('joins on the nanoclaw-container-name label, not the ncl-… runtime name', () => {
    const sessions = new Map([['nanoclaw-v2-foo-1700000000000', 'sess-1']]);
    const runtimeToHuman = new Map([['ncl-abc123', 'nanoclaw-v2-foo-1700000000000']]);
    const row = JSON.stringify({
      Name: 'ncl-abc123',
      CPUPerc: '12.5%',
      MemUsage: '100MiB / 1GiB',
      MemPerc: '9.8%',
    });

    const stat = parseStatsRow(row, sessions, runtimeToHuman);
    expect(stat?.sessionId).toBe('sess-1');
    expect(stat?.folder).toBe('foo');
    expect(stat?.name).toBe('nanoclaw-v2-foo-1700000000000');
  });

  it('falls back to the runtime name when the label is absent', () => {
    const row = JSON.stringify({
      Name: 'ncl-abc123',
      CPUPerc: '1%',
      MemUsage: '1MiB / 1GiB',
      MemPerc: '0.1%',
    });
    const stat = parseStatsRow(row, new Map(), new Map());
    expect(stat?.sessionId).toBeNull();
    expect(stat?.folder).toBeNull();
    expect(stat?.name).toBe('ncl-abc123');
  });
});
