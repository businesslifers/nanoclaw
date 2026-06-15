import { describe, expect, it } from 'bun:test';

import { CodexProvider } from './codex.js';

describe('CodexProvider', () => {
  it('rejects unsupported reasoning effort values', () => {
    expect(() => new CodexProvider({ effort: 'max' })).toThrow(/Unsupported Codex reasoning effort/);
  });

  it('normalizes supported reasoning effort values', () => {
    expect(new CodexProvider({ effort: 'HIGH' })).toBeInstanceOf(CodexProvider);
  });

  it('accepts supported reasoning effort values', () => {
    expect(new CodexProvider({ effort: 'xhigh' })).toBeInstanceOf(CodexProvider);
  });
});
