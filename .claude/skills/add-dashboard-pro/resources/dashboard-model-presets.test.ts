import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('child_process', () => ({ execFile: vi.fn() }));

import { execFile } from 'child_process';
import {
  findCodexBinary,
  getEffortPresets,
  getModelPresets,
  parseCodexModelCatalog,
  resetModelPresetCacheForTest,
} from './dashboard-model-presets.js';

type ExecCallback = (err: Error | null, stdout: string, stderr: string) => void;

function catalogJson(models: Array<Record<string, unknown>>): string {
  return JSON.stringify({ models });
}

const LIVE_CATALOG = catalogJson([
  { slug: 'gpt-5.4', visibility: 'list', priority: 16 },
  { slug: 'gpt-5.4-mini', visibility: 'list', priority: 23 },
  { slug: 'gpt-5.3-codex', visibility: 'list', priority: 6 },
  { slug: 'gpt-5.2', visibility: 'list', priority: 10 },
  { slug: 'codex-auto-review', visibility: 'hide', priority: 43 },
  { slug: 'gpt-5.5', visibility: 'list', priority: 7 },
]);

beforeEach(() => {
  resetModelPresetCacheForTest();
  vi.mocked(execFile).mockReset();
});

describe('parseCodexModelCatalog', () => {
  it('filters to list-visible slugs sorted by catalog priority', () => {
    expect(parseCodexModelCatalog(LIVE_CATALOG)).toEqual([
      'gpt-5.3-codex',
      'gpt-5.5',
      'gpt-5.2',
      'gpt-5.4',
      'gpt-5.4-mini',
    ]);
  });

  it('drops entries without a slug and sorts missing priority last', () => {
    const out = parseCodexModelCatalog(
      catalogJson([
        { slug: 'no-priority', visibility: 'list' },
        { visibility: 'list', priority: 1 },
        { slug: 'first', visibility: 'list', priority: 2 },
      ]),
    );
    expect(out).toEqual(['first', 'no-priority']);
  });

  it('throws on junk, missing models array, and empty list', () => {
    expect(() => parseCodexModelCatalog('not json')).toThrow();
    expect(() => parseCodexModelCatalog('{"ok":true}')).toThrow();
    expect(() => parseCodexModelCatalog(catalogJson([{ slug: 'x', visibility: 'hide' }]))).toThrow();
  });
});

describe('getModelPresets', () => {
  it('claude presets are the floating SDK aliases plus explicit current-generation ids', () => {
    expect(getModelPresets('claude')).toEqual([
      'opus',
      'sonnet',
      'haiku',
      'fable',
      'opus[1m]',
      'sonnet[1m]',
      'claude-opus-5',
      'claude-sonnet-5',
      'claude-fable-5',
      'claude-haiku-4-5',
    ]);
    expect(getModelPresets(null)).toEqual(getModelPresets('claude'));
    expect(getModelPresets('CLAUDE')).toEqual(getModelPresets('claude'));
  });

  it('unknown providers get an empty list (default + custom only)', () => {
    expect(getModelPresets('opencode')).toEqual([]);
    expect(getModelPresets('ollama')).toEqual([]);
  });

  it('codex returns static fallback immediately and serves the live catalog once refreshed', () => {
    let captured: ExecCallback | undefined;
    vi.mocked(execFile).mockImplementation(((_bin: unknown, _args: unknown, _opts: unknown, cb: ExecCallback) => {
      captured = cb;
      return {} as never;
    }) as never);

    // First call: cache empty → fallback served, refresh kicked off (if a
    // codex bin is resolvable on this machine; otherwise fallback is stamped).
    const first = getModelPresets('codex');
    expect(first).toEqual(['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini']);

    if (captured) {
      captured(null, LIVE_CATALOG, '');
      expect(getModelPresets('codex')).toEqual(['gpt-5.3-codex', 'gpt-5.5', 'gpt-5.2', 'gpt-5.4', 'gpt-5.4-mini']);
    }
  });

  it('codex keeps previous presets when the refresh errors or returns junk', () => {
    let captured: ExecCallback | undefined;
    vi.mocked(execFile).mockImplementation(((_bin: unknown, _args: unknown, _opts: unknown, cb: ExecCallback) => {
      captured = cb;
      return {} as never;
    }) as never);

    getModelPresets('codex');
    if (!captured) return; // no codex bin on this machine — fallback path already covered above

    captured(new Error('boom'), '', '');
    expect(getModelPresets('codex')).toEqual([
      'gpt-5.6-sol',
      'gpt-5.6-terra',
      'gpt-5.6-luna',
      'gpt-5.5',
      'gpt-5.4',
      'gpt-5.4-mini',
    ]);
  });
});

describe('findCodexBinary', () => {
  it('returns a path or null without throwing', () => {
    const result = findCodexBinary();
    expect(result === null || typeof result === 'string').toBe(true);
  });
});

describe('getEffortPresets', () => {
  it('claude gets the agent-sdk EffortLevel vocab; null provider defaults to claude', () => {
    expect(getEffortPresets('claude')).toEqual(['low', 'medium', 'high', 'xhigh', 'max']);
    expect(getEffortPresets(null)).toEqual(['low', 'medium', 'high', 'xhigh', 'max']);
    expect(getEffortPresets('CLAUDE')).toEqual(['low', 'medium', 'high', 'xhigh', 'max']);
  });

  it('codex gets the model_reasoning_effort vocab', () => {
    expect(getEffortPresets('codex')).toEqual(['none', 'minimal', 'low', 'medium', 'high', 'xhigh']);
  });

  it('unknown providers get an empty list (default only)', () => {
    expect(getEffortPresets('opencode')).toEqual([]);
  });
});
