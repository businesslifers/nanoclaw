/**
 * Per-container CPU + memory stats collector.
 *
 * Runs `docker stats --no-stream` against the containers tagged with this
 * install's label and joins the result against the active session map. Pure
 * parsing helpers are exported separately so tests don't need a docker
 * daemon.
 *
 * Emitted as `system.containers` in the dashboard snapshot. The watchdog in
 * dashboard-pusher.ts uses the readings to flag any container pinned at
 * high CPU for a sustained window.
 */
import { execFile } from 'child_process';
import { promisify } from 'util';

import { CONTAINER_INSTALL_LABEL } from './config.js';

/** Label carrying the pre-seam human-readable container name (`nanoclaw-v2-<folder>-<epoch>`). */
const HUMAN_NAME_LABEL = 'nanoclaw-container-name';
import { CONTAINER_RUNTIME_BIN } from './container-runtime.js';
import { log } from './log.js';

// Async on purpose: `docker stats --no-stream` samples for ~2s (longer under
// load). Run synchronously from the 60s dashboard push it froze the host event
// loop long enough to trip the gateway's 5s health probe and kill every live
// session.
const execFileAsync = promisify(execFile);

export interface ContainerStat {
  /** Container name (e.g. `nanoclaw-v2-foo-1700000000000`). */
  name: string;
  /** Session id this container is bound to, if known. */
  sessionId: string | null;
  /** Agent-group folder parsed from the name, if it matches the convention. */
  folder: string | null;
  cpuPercent: number;
  memUsageBytes: number;
  memLimitBytes: number;
  memPercent: number;
}

/** Raw line shape emitted by `docker stats --format '{{json .}}'`. */
interface DockerStatsRow {
  Name?: string;
  CPUPerc?: string;
  MemUsage?: string;
  MemPerc?: string;
}

/**
 * Parse a docker memory string like `"4.5MiB / 7.7GiB"` into a bytes pair.
 * Returns nulls on anything we don't recognise (test relies on this).
 */
export function parseMemUsage(s: string | undefined): { used: number; limit: number } {
  if (!s) return { used: 0, limit: 0 };
  const [usedRaw, limitRaw] = s.split('/').map((p) => p.trim());
  return { used: parseSize(usedRaw), limit: parseSize(limitRaw) };
}

/** Parse a single size token like `4.5MiB` / `123KB` / `1.2GB`. */
export function parseSize(token: string | undefined): number {
  if (!token) return 0;
  const m = token.match(/^([\d.]+)\s*([KMGT]?i?B)$/i);
  if (!m) return 0;
  const value = parseFloat(m[1]);
  const unit = m[2].toLowerCase();
  const map: Record<string, number> = {
    b: 1,
    kb: 1_000,
    mb: 1_000_000,
    gb: 1_000_000_000,
    tb: 1_000_000_000_000,
    kib: 1024,
    mib: 1024 ** 2,
    gib: 1024 ** 3,
    tib: 1024 ** 4,
  };
  const factor = map[unit] ?? 0;
  return Math.round(value * factor);
}

/** Strip the trailing `%` and convert. Returns 0 on garbage. */
export function parsePercent(token: string | undefined): number {
  if (!token) return 0;
  const n = parseFloat(token.replace('%', '').trim());
  return Number.isFinite(n) ? n : 0;
}

/**
 * Parse one JSONL line from `docker stats --format '{{json .}}'`. Returns
 * null on garbage so callers can `.filter(Boolean)`.
 */
export function parseStatsRow(
  json: string,
  containerNameToSession: Map<string, string>,
  /**
   * Runtime name (`ncl-…`) → the human-readable `nanoclaw-container-name`
   * label. `docker stats` only reports the runtime name, while the session
   * map and the folder parse are both keyed on the human name.
   */
  runtimeToHumanName?: Map<string, string>,
): ContainerStat | null {
  let row: DockerStatsRow;
  try {
    row = JSON.parse(json) as DockerStatsRow;
  } catch {
    return null;
  }
  if (!row.Name) return null;

  const humanName = runtimeToHumanName?.get(row.Name) ?? row.Name;
  const mem = parseMemUsage(row.MemUsage);
  return {
    name: humanName,
    sessionId: containerNameToSession.get(humanName) ?? null,
    folder: parseFolderFromName(humanName),
    cpuPercent: parsePercent(row.CPUPerc),
    memUsageBytes: mem.used,
    memLimitBytes: mem.limit,
    memPercent: parsePercent(row.MemPerc),
  };
}

/**
 * Pull the folder out of a `nanoclaw-v2-<folder>-<epoch>` container name.
 * Folder names can contain hyphens, so strip the trailing `-<digits>` epoch
 * and the `nanoclaw-v2-` prefix. Returns null if the pattern doesn't match.
 *
 * Since the session-driver seam, the RUNTIME name is a key-derived `ncl-…`
 * string, so this must be given the human-readable name carried on the
 * `nanoclaw-container-name` label — never `{{.Names}}`.
 */
export function parseFolderFromName(name: string): string | null {
  const m = name.match(/^nanoclaw-v2-(.+)-\d+$/);
  return m ? m[1] : null;
}

/**
 * Shell out to docker to fetch a one-shot stats snapshot for our containers.
 *
 * Two-step: first `docker ps --filter label=<install>` to get the names
 * (because `docker stats --filter` only supports id/name), then pass those
 * names into `docker stats --no-stream`. Returns [] on any failure — stats
 * are best-effort and shouldn't take down the snapshot push.
 *
 * Since the session-driver seam the runtime name is key-derived (`ncl-…`),
 * so `ps` also reads the `nanoclaw-container-name` label: `stats` is invoked
 * with runtime names, but the session join and the folder parse both need the
 * human-readable name. Without the label the join silently misses every row
 * and the dashboard's CPU/memory columns go blank.
 */
export async function collectContainerStats(activeContainers: Map<string, string>): Promise<ContainerStat[]> {
  let names: string[];
  const runtimeToHumanName = new Map<string, string>();
  try {
    const { stdout: out } = await execFileAsync(
      CONTAINER_RUNTIME_BIN,
      [
        'ps',
        '--filter',
        `label=${CONTAINER_INSTALL_LABEL}`,
        '--format',
        `{{.Names}}\t{{.Label "${HUMAN_NAME_LABEL}"}}`,
      ],
      { encoding: 'utf-8', timeout: 5000 },
    );
    names = [];
    for (const line of out.trim().split('\n').filter(Boolean)) {
      const [runtimeName, humanName] = line.split('\t');
      if (!runtimeName) continue;
      names.push(runtimeName);
      if (humanName) runtimeToHumanName.set(runtimeName, humanName);
    }
  } catch (err) {
    log.debug('container-stats: docker ps failed', { err });
    return [];
  }
  if (names.length === 0) return [];

  const nameToSession = new Map<string, string>();
  for (const [sid, cname] of activeContainers) nameToSession.set(cname, sid);

  let raw: string;
  try {
    ({ stdout: raw } = await execFileAsync(
      CONTAINER_RUNTIME_BIN,
      ['stats', '--no-stream', '--format', '{{json .}}', ...names],
      { encoding: 'utf-8', timeout: 10000 },
    ));
  } catch (err) {
    log.debug('container-stats: docker stats failed', { err });
    return [];
  }

  const stats: ContainerStat[] = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    const stat = parseStatsRow(line, nameToSession, runtimeToHumanName);
    if (stat) stats.push(stat);
  }
  return stats;
}

/**
 * In-process CPU history per session. The window is small; we keep at most
 * `maxSamples` recent readings keyed by session id. Sessions that disappear
 * from the active set get GC'd on each `record()` call.
 *
 * Time window = maxSamples × snapshot interval (60s). Default 5 → 5 minutes
 * of high CPU before we flag, matching the user's described scenario.
 */
export class CpuWatchdog {
  private history = new Map<string, number[]>();

  constructor(
    private readonly maxSamples: number = 5,
    private readonly thresholdPercent: number = 80,
  ) {}

  /** Record this round's stats. Drops history for any session not present. */
  record(stats: ContainerStat[]): void {
    const seen = new Set<string>();
    for (const s of stats) {
      if (!s.sessionId) continue;
      seen.add(s.sessionId);
      const arr = this.history.get(s.sessionId) ?? [];
      arr.push(s.cpuPercent);
      while (arr.length > this.maxSamples) arr.shift();
      this.history.set(s.sessionId, arr);
    }
    for (const sid of [...this.history.keys()]) {
      if (!seen.has(sid)) this.history.delete(sid);
    }
  }

  /**
   * Sessions whose last `maxSamples` readings are all above `thresholdPercent`.
   * Returns sessionId + the lowest reading in the window so callers can
   * include it in a human-readable reason.
   */
  pinned(): Array<{ sessionId: string; minPercent: number; samples: number }> {
    const out: Array<{ sessionId: string; minPercent: number; samples: number }> = [];
    for (const [sid, arr] of this.history) {
      if (arr.length < this.maxSamples) continue;
      const min = Math.min(...arr);
      if (min >= this.thresholdPercent) out.push({ sessionId: sid, minPercent: min, samples: arr.length });
    }
    return out;
  }

  /** Test helper. */
  _historyFor(sessionId: string): number[] | undefined {
    return this.history.get(sessionId);
  }
}
