/**
 * Provider-aware model preset lists for the dashboard's model-edit dropdown.
 *
 * Claude presets are agent-sdk aliases — they float to the newest model per
 * family at container spawn (sonnet → claude-sonnet-5 etc.), so a static
 * alias list never goes stale. Codex slugs are concrete model ids whose
 * availability is server-side and changes without any CLI update (gpt-5.5
 * appeared only in the live catalog, not the bundled one), so the codex
 * list is refreshed from `codex debug models` — the same catalog the codex
 * picker itself renders — filtered to visibility === "list" and sorted by
 * the catalog's priority field.
 *
 * The pusher calls getModelPresets on every push, so the codex refresh is
 * async + cached: callers always get the current cache (or the static
 * fallback) immediately; a stale cache just kicks off a background refresh.
 * The `codex` bin is a `#!/usr/bin/env node` shim living next to its node
 * binary (nvm layout), and the systemd service PATH carries neither — so we
 * resolve the shim ourselves and prepend its directory to PATH for the
 * child process.
 */
import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { log } from './log.js';

const CLAUDE_PRESETS = ['opus', 'sonnet', 'haiku', 'fable', 'opus[1m]', 'sonnet[1m]'];
const CODEX_FALLBACK = ['gpt-5.4', 'gpt-5.4-mini'];

// Effort vocab is per-provider and stable (an SDK/CLI enum, not a server-side
// catalog), so static lists don't go stale the way codex model slugs do.
// claude: agent-sdk EffortLevel (default 'high' when unset); codex: the
// model_reasoning_effort values codex-app-server accepts.
const CLAUDE_EFFORT_PRESETS = ['low', 'medium', 'high', 'xhigh', 'max'];
const CODEX_EFFORT_PRESETS = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh'];
const CODEX_TTL_MS = 60 * 60 * 1000;
const CODEX_TIMEOUT_MS = 20_000;

let codexCache: { list: string[]; fetchedAt: number } | null = null;
let codexRefreshing = false;

/** Parse `codex debug models` stdout → list-visible slugs, catalog-priority order. */
export function parseCodexModelCatalog(stdout: string): string[] {
  const parsed = JSON.parse(stdout) as {
    models?: Array<{ slug?: unknown; visibility?: unknown; priority?: unknown }>;
  };
  if (!Array.isArray(parsed.models)) throw new Error('codex catalog: no models array');
  const rows = parsed.models
    .filter((m) => typeof m.slug === 'string' && m.slug.length > 0 && m.visibility === 'list')
    .map((m) => ({
      slug: m.slug as string,
      priority: typeof m.priority === 'number' ? m.priority : Number.MAX_SAFE_INTEGER,
    }));
  rows.sort((a, b) => a.priority - b.priority);
  if (rows.length === 0) throw new Error('codex catalog: no list-visible models');
  return rows.map((r) => r.slug);
}

/** Find the codex bin: service PATH first, then nvm installs (any node version). */
export function findCodexBinary(): string | null {
  for (const dir of (process.env.PATH ?? '').split(path.delimiter)) {
    if (!dir) continue;
    const candidate = path.join(dir, 'codex');
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {
      /* keep looking */
    }
  }
  const nvmBase = path.join(os.homedir(), '.nvm', 'versions', 'node');
  try {
    for (const version of fs.readdirSync(nvmBase).sort().reverse()) {
      const candidate = path.join(nvmBase, version, 'bin', 'codex');
      try {
        fs.accessSync(candidate, fs.constants.X_OK);
        return candidate;
      } catch {
        /* keep looking */
      }
    }
  } catch {
    /* no nvm */
  }
  return null;
}

function refreshCodexModels(): void {
  if (codexRefreshing) return;
  const bin = findCodexBinary();
  if (!bin) {
    log.warn('codex bin not found; model presets stay on static fallback');
    // Stamp the fallback so we don't re-scan the filesystem on every push.
    codexCache = { list: codexCache?.list ?? CODEX_FALLBACK, fetchedAt: Date.now() };
    return;
  }
  codexRefreshing = true;
  const env = { ...process.env, PATH: `${path.dirname(bin)}${path.delimiter}${process.env.PATH ?? ''}` };
  execFile(bin, ['debug', 'models'], { timeout: CODEX_TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024, env }, (err, stdout) => {
    codexRefreshing = false;
    if (err) {
      log.warn('codex debug models failed; keeping previous presets', { err: err.message });
      codexCache = { list: codexCache?.list ?? CODEX_FALLBACK, fetchedAt: Date.now() };
      return;
    }
    try {
      codexCache = { list: parseCodexModelCatalog(stdout), fetchedAt: Date.now() };
    } catch (parseErr) {
      log.warn('codex model catalog unparseable; keeping previous presets', {
        err: (parseErr as Error).message,
      });
      codexCache = { list: codexCache?.list ?? CODEX_FALLBACK, fetchedAt: Date.now() };
    }
  });
}

/**
 * Preset model names for a provider's dropdown. Never blocks: codex reads
 * the cache and triggers a background refresh when stale. Unknown providers
 * (opencode etc.) get an empty list — "default" + custom free text only.
 */
export function getModelPresets(provider: string | null | undefined): string[] {
  const p = (provider ?? 'claude').toLowerCase();
  if (p === 'claude') return CLAUDE_PRESETS;
  if (p === 'codex') {
    if (!codexCache || Date.now() - codexCache.fetchedAt > CODEX_TTL_MS) refreshCodexModels();
    return codexCache?.list ?? CODEX_FALLBACK;
  }
  return [];
}

/**
 * Preset effort levels for a provider's dropdown. Like model presets these
 * are a convenience, not a gate — the mutator stores any short string.
 * Unknown providers get an empty list ("default" only).
 */
export function getEffortPresets(provider: string | null | undefined): string[] {
  const p = (provider ?? 'claude').toLowerCase();
  if (p === 'claude') return CLAUDE_EFFORT_PRESETS;
  if (p === 'codex') return CODEX_EFFORT_PRESETS;
  return [];
}

/** Test hook: clear module-level cache state. */
export function resetModelPresetCacheForTest(): void {
  codexCache = null;
  codexRefreshing = false;
}
