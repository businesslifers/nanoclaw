/**
 * Dashboard pusher — collects NanoClaw state and POSTs a JSON
 * snapshot to the dashboard's /api/ingest endpoint every interval.
 */
import fs from 'fs';
import path from 'path';
import http from 'http';
import Database from 'better-sqlite3';

import { getAllAgentGroups, getAgentGroup } from './db/agent-groups.js';
import { listWikis } from './wiki/discovery.js';
// Pricing table — USD per 1M tokens. Dashboard cost columns are
// DEMONSTRATION ONLY: this install authenticates Claude via Claude Max/Pro
// OAuth (~/.claude/.credentials.json has claudeAiOauth + subscriptionType)
// and Codex via ChatGPT Plus OAuth (~/.codex/auth.json). Both are flat-rate
// subscriptions — real spend is your subscription fee, not the numbers
// computed here. These rates exist so the dashboard shows what it *would*
// cost if the subscriptions went away and everything moved to per-token
// API billing; useful for capacity planning and spotting runaway usage.
//
// Values below are published public rates (per 1M tokens):
//   - Anthropic Claude 4.x (claude.ai subscription OR API):
//       opus   — in 15,   out 75,   cache-read 1.5,   cache-write 18.75
//       sonnet — in 3,    out 15,   cache-read 0.3,   cache-write 3.75
//       haiku  — in 1,    out 5,    cache-read 0.1,   cache-write 1.25
//   - OpenAI gpt-5 family (ChatGPT Plus subscription OR API):
//       gpt-5.4      — in 1.25, out 10,   cache-read 0.125, cache-write 1.25
//       gpt-5.4-mini — in 0.25, out 2,    cache-read 0.025, cache-write 0.25
//     OpenAI doesn't charge a separate cache-creation rate; caching is
//     automatic and just discounts reads, so cacheWrite mirrors input.
const PRICING = {
  opus: { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 },
  sonnet: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  haiku: { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
  'gpt-5.4': { input: 1.25, output: 10, cacheRead: 0.125, cacheWrite: 1.25 },
  'gpt-5.4-mini': { input: 0.25, output: 2, cacheRead: 0.025, cacheWrite: 0.25 },
} as const;

function modelFamily(model: string): keyof typeof PRICING | null {
  const m = (model || '').toLowerCase();
  if (m.includes('opus')) return 'opus';
  if (m.includes('sonnet')) return 'sonnet';
  if (m.includes('haiku')) return 'haiku';
  if (m.includes('gpt-5.4-mini') || m.includes('gpt-5-mini') || m.includes('gpt-5.4mini')) return 'gpt-5.4-mini';
  if (m.includes('gpt-5.4') || m.includes('gpt-5')) return 'gpt-5.4';
  return null;
}

interface TokenBag {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

/**
 * Compute USD cost for a token bag against a model's pricing. Numbers are
 * demonstration figures — this install runs both Claude and Codex on flat
 * OAuth subscriptions, so the dashboard shows what per-token API billing
 * WOULD cost rather than what you're actually paying (zero marginal).
 *
 * Unknown models return 0. 1M-context pricing isn't tracked separately —
 * Anthropic doubles above 200K input tokens but we can't reconstruct
 * per-request context from these aggregated bags. Close enough for an
 * at-a-glance figure.
 */
function computeCostUsd(model: string, tokens: TokenBag): number {
  const family = modelFamily(model);
  if (!family) return 0;
  const p = PRICING[family];
  return (
    (tokens.inputTokens / 1_000_000) * p.input +
    (tokens.outputTokens / 1_000_000) * p.output +
    (tokens.cacheReadTokens / 1_000_000) * p.cacheRead +
    (tokens.cacheCreationTokens / 1_000_000) * p.cacheWrite
  );
}
import { getSessionsByAgentGroup } from './db/sessions.js';
import { getAllMessagingGroups, getMessagingGroupAgents } from './db/messaging-groups.js';
// Agent-to-agent and permissions concerns live in module subdirectories in
// v2, not flat under src/db. Import from their canonical locations.
import { getDestinations } from './modules/agent-to-agent/db/agent-destinations.js';
import { getMembers } from './modules/permissions/db/agent-group-members.js';
import { getAllUsers, getUser } from './modules/permissions/db/users.js';
import { getUserRoles, getAdminsOfAgentGroup } from './modules/permissions/db/user-roles.js';
import { getUserDmsForUser } from './modules/permissions/db/user-dms.js';
import { getActiveAdapters, getRegisteredChannelNames } from './channels/channel-registry.js';
import { DATA_DIR, ASSISTANT_NAME } from './config.js';
import { readContainerConfig } from './container-config.js';
import { getActiveContainerNames } from './container-runner.js';
import { collectContainerStats, CpuWatchdog, type ContainerStat } from './container-stats.js';
import { getDb } from './db/connection.js';
import { log } from './log.js';

// One watchdog per host process — keeps a 5-sample (≈5min) CPU history per
// session and surfaces "pinned" sessions through health.reasons. Restarting
// the host resets the window, by design — we'd rather have 5min of warm-up
// after a restart than persist watchdog state and risk false positives from
// stale entries.
const cpuWatchdog = new CpuWatchdog();

interface PusherConfig {
  port: number;
  secret: string;
  intervalMs?: number;
}

let timer: ReturnType<typeof setInterval> | null = null;
let logTimer: ReturnType<typeof setInterval> | null = null;
let logOffset = 0;

export function startDashboardPusher(config: PusherConfig): void {
  const interval = config.intervalMs || 60000;

  // Push immediately on start, then on interval
  push(config).catch((err) => log.error('Dashboard push failed', { err }));
  timer = setInterval(() => {
    push(config).catch((err) => log.error('Dashboard push failed', { err }));
  }, interval);

  // Start log file tailing
  startLogTail(config);

  log.info('Dashboard pusher started', { intervalMs: interval });
}

export function stopDashboardPusher(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  if (logTimer) {
    clearInterval(logTimer);
    logTimer = null;
  }
}

/** Fire-and-forget POST to the dashboard. */
function postJson(config: PusherConfig, urlPath: string, data: unknown): void {
  const body = JSON.stringify(data);
  const req = http.request({
    hostname: '127.0.0.1',
    port: config.port,
    path: urlPath,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      Authorization: `Bearer ${config.secret}`,
    },
  });
  req.on('error', () => {});
  req.write(body);
  req.end();
}

const ANSI_RE = /\x1b\[[0-9;]*m/g;

function startLogTail(config: PusherConfig): void {
  const logFile = path.resolve(process.cwd(), 'logs', 'nanoclaw.log');
  if (!fs.existsSync(logFile)) return;

  // Send last 200 lines as backfill
  try {
    const allLines = fs
      .readFileSync(logFile, 'utf-8')
      .split('\n')
      .filter((l) => l.trim());
    logOffset = fs.statSync(logFile).size;
    const tail = allLines.slice(-200).map((l) => l.replace(ANSI_RE, ''));
    if (tail.length > 0) postJson(config, '/api/logs/push', { lines: tail });
  } catch {
    return;
  }

  // Poll every 2s for new lines
  logTimer = setInterval(() => {
    try {
      const stat = fs.statSync(logFile);
      if (stat.size <= logOffset) {
        logOffset = stat.size;
        return;
      }
      const buf = Buffer.alloc(stat.size - logOffset);
      const fd = fs.openSync(logFile, 'r');
      fs.readSync(fd, buf, 0, buf.length, logOffset);
      fs.closeSync(fd);
      logOffset = stat.size;
      const lines = buf
        .toString()
        .split('\n')
        .filter((l) => l.trim())
        .map((l) => l.replace(ANSI_RE, ''));
      if (lines.length > 0) postJson(config, '/api/logs/push', { lines });
    } catch {
      /* ignore */
    }
  }, 2000);
}

async function push(config: PusherConfig): Promise<void> {
  const snapshot = collectSnapshot();
  postJson(config, '/api/ingest', snapshot);
  log.debug('Dashboard snapshot pushed');
}

function collectSnapshot(): Record<string, unknown> {
  // Collect sessions + channels once so computeHealth can reuse them
  // without a second pass; everything else is independent.
  const sessions = collectSessions();
  const channels = collectChannels();

  // Per-container CPU/memory readings for the active set. This is the
  // input to the CPU watchdog AND a snapshot consumer in its own right
  // (rendered as columns on the dashboard Sessions table).
  const containerStats = collectContainerStats(getActiveContainerNames());
  cpuWatchdog.record(containerStats);

  // Decorate each session row with its current CPU/mem reading so the
  // dashboard can render columns without a second join. Sessions whose
  // container isn't running just get nulls.
  const statsBySession = new Map<string, ContainerStat>();
  for (const s of containerStats) if (s.sessionId) statsBySession.set(s.sessionId, s);
  for (const row of sessions) {
    const sid = row.id as string | undefined;
    const stat = sid ? statsBySession.get(sid) : undefined;
    row.cpu_percent = stat?.cpuPercent ?? null;
    row.mem_percent = stat?.memPercent ?? null;
    row.mem_usage_bytes = stat?.memUsageBytes ?? null;
    row.mem_limit_bytes = stat?.memLimitBytes ?? null;
  }

  const pinned = cpuWatchdog.pinned();

  return {
    timestamp: new Date().toISOString(),
    assistant_name: ASSISTANT_NAME,
    uptime: Math.floor(process.uptime()),
    agent_groups: collectAgentGroups(),
    sessions,
    channels,
    users: collectUsers(),
    tokens: collectTokens(),
    context_windows: collectContextWindows(),
    activity: collectActivity(),
    messages: collectMessages(),
    wikis: collectWikis(),
    system: { containers: containerStats, pinnedSessions: pinned },
    health: computeHealth(sessions, channels, pinned),
  };
}

/**
 * Roll up overall system health from data already in the snapshot.
 * Intentionally narrow: anything observable from sessions, channels, and
 * the error log mtime — no new DB queries or long-lived state.
 *
 *  - operational: at least one channel live, no failed sessions, no recent errors
 *  - degraded:    failed sessions OR error log written in the last 5 minutes
 *  - idle:        nothing's broken, but no live channels (e.g. fresh install)
 */
function computeHealth(
  sessions: Array<Record<string, unknown>>,
  channels: Array<{ isLive: boolean }>,
  pinnedSessions: Array<{ sessionId: string; minPercent: number; samples: number }> = [],
): { status: 'operational' | 'degraded' | 'idle'; reasons: string[] } {
  const failed = sessions.filter((s) => s.container_status === 'crashed' || s.container_status === 'failed').length;
  const live = channels.filter((c) => c.isLive).length;
  const recentErrors = errorLogTouchedRecently();

  const reasons: string[] = [];
  if (failed) reasons.push(`${failed} failed session${failed === 1 ? '' : 's'}`);
  if (recentErrors) reasons.push('recent errors in log');
  if (live === 0) reasons.push('no live channels');

  // Surface runaway containers — same shape as v1's silent 98% loop, except
  // visible. Look up the agent-group name for the message; fall back to
  // session id if the row vanished between collectSessions() and now.
  for (const p of pinnedSessions) {
    const row = sessions.find((s) => s.id === p.sessionId) as Record<string, unknown> | undefined;
    const label = (row?.agent_group_name as string) || (row?.agent_group_folder as string) || p.sessionId;
    reasons.push(`${label} pinned at ≥${Math.round(p.minPercent)}% CPU for ${p.samples} samples`);
  }

  let status: 'operational' | 'degraded' | 'idle';
  if (failed > 0 || recentErrors || pinnedSessions.length > 0) status = 'degraded';
  else if (live === 0) status = 'idle';
  else status = 'operational';

  return { status, reasons };
}

/**
 * True if logs/nanoclaw.error.log has non-zero size and was modified in
 * the last 5 minutes. Cheap (one stat call), avoids parsing the file's
 * date-less timestamp lines.
 */
function errorLogTouchedRecently(thresholdMs = 5 * 60 * 1000): boolean {
  try {
    const errorLog = path.resolve(process.cwd(), 'logs', 'nanoclaw.error.log');
    const stat = fs.statSync(errorLog);
    return stat.size > 0 && Date.now() - stat.mtimeMs < thresholdMs;
  } catch {
    return false;
  }
}

function collectAgentGroups() {
  const allAgentGroups = getAllAgentGroups();
  const agentById = new Map(allAgentGroups.map((g) => [g.id, g] as const));

  // Pre-compute parent + sub-agent-count for every group based on the
  // `parent` destination convention that create_agent sets up. Cheap: one
  // getDestinations() per group, reused below. Agents not created via
  // create_agent (e.g. the Content Team built by scripts) may lack this
  // row and render as top-level, which is correct.
  const parentByChild = new Map<string, string>(); // childId → parentId
  const subAgentCount = new Map<string, number>(); // parentId → count
  for (const ag of allAgentGroups) {
    const dests = getDestinations(ag.id);
    for (const d of dests) {
      if (d.target_type === 'agent' && d.local_name === 'parent') {
        parentByChild.set(ag.id, d.target_id);
        subAgentCount.set(d.target_id, (subAgentCount.get(d.target_id) ?? 0) + 1);
      }
    }
  }

  return allAgentGroups.map((g) => {
    const sessions = getSessionsByAgentGroup(g.id);
    const running = sessions.filter((s) => s.container_status === 'running' || s.container_status === 'idle');
    // Enrich destinations so the UI can render agent vs channel rows
    // differently without a second lookup per row. For agent-type rows
    // include the target's display name, provider, and model so the
    // sub-agent table can show "claude · opus[1m]" / "codex · gpt-5.4"
    // / "claude · default" without extra API calls.
    const destinations = getDestinations(g.id).map((d) => {
      if (d.target_type !== 'agent') return d;
      const t = agentById.get(d.target_id);
      return {
        ...d,
        target_name: t?.name ?? null,
        target_provider: t?.agent_provider ?? null,
        target_model: t?.model ?? null,
      };
    });
    const members = getMembers(g.id).map((m) => {
      const user = getUser(m.user_id);
      return { ...m, display_name: user?.display_name ?? null };
    });
    const admins = getAdminsOfAgentGroup(g.id).map((a) => {
      const user = getUser(a.user_id);
      return { ...a, display_name: user?.display_name ?? null };
    });

    // Wirings
    const db = getDb();
    const wirings = db
      .prepare(
        `SELECT mga.*, mg.channel_type, mg.platform_id, mg.name as mg_name, mg.is_group, mg.unknown_sender_policy
         FROM messaging_group_agents mga
         JOIN messaging_groups mg ON mg.id = mga.messaging_group_id
         WHERE mga.agent_group_id = ?`,
      )
      .all(g.id) as Array<Record<string, unknown>>;

    const parentId = parentByChild.get(g.id) ?? null;
    const parentName = parentId ? (agentById.get(parentId)?.name ?? null) : null;

    return {
      id: g.id,
      name: g.name,
      folder: g.folder,
      agent_provider: g.agent_provider,
      model: g.model,
      parentId,
      parentName,
      subAgentCount: subAgentCount.get(g.id) ?? 0,
      // V2 stores container config in groups/<folder>/container.json on disk,
      // not on the agent_groups row — read it from there so the dashboard
      // sees the real config (or an empty shell if the file is absent).
      container_config: readContainerConfig(g.folder),
      sessionCount: sessions.length,
      runningSessions: running.length,
      wirings,
      destinations,
      members,
      admins,
      created_at: g.created_at,
    };
  });
}

function collectSessions() {
  const db = getDb();
  return db
    .prepare(
      `SELECT s.*, ag.name as agent_group_name, ag.folder as agent_group_folder,
              mg.channel_type, mg.platform_id, mg.name as messaging_group_name
       FROM sessions s
       LEFT JOIN agent_groups ag ON ag.id = s.agent_group_id
       LEFT JOIN messaging_groups mg ON mg.id = s.messaging_group_id
       ORDER BY s.last_active DESC NULLS LAST`,
    )
    .all() as Array<Record<string, unknown>>;
}

function collectChannels() {
  const messagingGroups = getAllMessagingGroups();
  const liveAdapters = getActiveAdapters().map((a) => a.channelType);
  const registeredChannels = getRegisteredChannelNames();

  const byType: Record<string, { channelType: string; isLive: boolean; isRegistered: boolean; groups: unknown[] }> = {};

  for (const mg of messagingGroups) {
    if (!byType[mg.channel_type]) {
      byType[mg.channel_type] = {
        channelType: mg.channel_type,
        isLive: liveAdapters.includes(mg.channel_type),
        isRegistered: registeredChannels.includes(mg.channel_type),
        groups: [],
      };
    }

    const agents = getMessagingGroupAgents(mg.id).map((a) => {
      const group = getAgentGroup(a.agent_group_id);
      return { agent_group_id: a.agent_group_id, agent_group_name: group?.name ?? null, priority: a.priority };
    });

    byType[mg.channel_type].groups.push({
      messagingGroup: {
        id: mg.id,
        platform_id: mg.platform_id,
        name: mg.name,
        is_group: mg.is_group,
        unknown_sender_policy: (mg as unknown as Record<string, unknown>).unknown_sender_policy ?? 'strict',
      },
      agents,
    });
  }

  // Include live adapters with no messaging groups
  for (const ct of liveAdapters) {
    if (!byType[ct]) {
      byType[ct] = { channelType: ct, isLive: true, isRegistered: true, groups: [] };
    }
  }

  return Object.values(byType).sort((a, b) => a.channelType.localeCompare(b.channelType));
}

function collectUsers() {
  return getAllUsers().map((u) => {
    const roles = getUserRoles(u.id);
    const dms = getUserDmsForUser(u.id);

    const db = getDb();
    const memberships = db
      .prepare(
        `SELECT agm.agent_group_id, ag.name as agent_group_name
         FROM agent_group_members agm
         JOIN agent_groups ag ON ag.id = agm.agent_group_id
         WHERE agm.user_id = ?`,
      )
      .all(u.id) as Array<Record<string, unknown>>;

    let privilege = 'none';
    if (roles.some((r) => r.role === 'owner')) privilege = 'owner';
    else if (roles.some((r) => r.role === 'admin' && !r.agent_group_id)) privilege = 'global_admin';
    else if (roles.some((r) => r.role === 'admin')) privilege = 'admin';
    else if (memberships.length > 0) privilege = 'member';

    return {
      id: u.id,
      kind: u.kind,
      display_name: u.display_name,
      privilege,
      roles,
      memberships,
      dmChannels: dms.map((d) => ({ channel_type: d.channel_type })),
      created_at: u.created_at,
    };
  });
}

function collectTokens() {
  const sessionsDir = path.join(DATA_DIR, 'v2-sessions');
  const allEntries: Array<{
    model: string;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheCreationTokens: number;
    agentGroupId: string;
  }> = [];
  const agentGroups = getAllAgentGroups();
  const nameMap = new Map(agentGroups.map((g) => [g.id, g.name]));

  if (fs.existsSync(sessionsDir)) {
    for (const agDir of fs.readdirSync(sessionsDir).filter((d) => d.startsWith('ag-'))) {
      // Claude Code transcript (.claude-shared/projects/*.jsonl)
      const claudeEntries = scanJsonlTokens(path.join(sessionsDir, agDir));
      allEntries.push(...claudeEntries.map((e) => ({ ...e, agentGroupId: agDir })));
      // Codex app-server logs (logs_2.sqlite per session)
      const codexEntries = scanCodexTokens(path.join(sessionsDir, agDir));
      allEntries.push(...codexEntries.map((e) => ({ ...e, agentGroupId: agDir })));
    }
  }

  const byModel: Record<
    string,
    {
      requests: number;
      inputTokens: number;
      outputTokens: number;
      cacheReadTokens: number;
      cacheCreationTokens: number;
      costUsd: number;
    }
  > = {};
  const byGroup: Record<
    string,
    {
      requests: number;
      inputTokens: number;
      outputTokens: number;
      cacheReadTokens: number;
      cacheCreationTokens: number;
      costUsd: number;
      name: string;
    }
  > = {};
  const totals = {
    requests: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    costUsd: 0,
    cacheHitRate: 0,
  };

  for (const e of allEntries) {
    const cost = computeCostUsd(e.model, e);

    if (!byModel[e.model])
      byModel[e.model] = {
        requests: 0,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
        costUsd: 0,
      };
    byModel[e.model].requests++;
    byModel[e.model].inputTokens += e.inputTokens;
    byModel[e.model].outputTokens += e.outputTokens;
    byModel[e.model].cacheReadTokens += e.cacheReadTokens;
    byModel[e.model].cacheCreationTokens += e.cacheCreationTokens;
    byModel[e.model].costUsd += cost;

    if (!byGroup[e.agentGroupId])
      byGroup[e.agentGroupId] = {
        requests: 0,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
        costUsd: 0,
        name: nameMap.get(e.agentGroupId) || e.agentGroupId,
      };
    byGroup[e.agentGroupId].requests++;
    byGroup[e.agentGroupId].inputTokens += e.inputTokens;
    byGroup[e.agentGroupId].outputTokens += e.outputTokens;
    byGroup[e.agentGroupId].cacheReadTokens += e.cacheReadTokens;
    byGroup[e.agentGroupId].cacheCreationTokens += e.cacheCreationTokens;
    byGroup[e.agentGroupId].costUsd += cost;

    totals.requests++;
    totals.inputTokens += e.inputTokens;
    totals.outputTokens += e.outputTokens;
    totals.cacheReadTokens += e.cacheReadTokens;
    totals.cacheCreationTokens += e.cacheCreationTokens;
    totals.costUsd += cost;
  }

  // Cache hit rate over the same denominator as the existing dashboard JS
  // (overview.js uses input + cacheRead + cacheCreation), so old/new agree
  // during rollout. Range [0, 1]; the UI multiplies by 100 for display.
  const denom = totals.inputTokens + totals.cacheReadTokens + totals.cacheCreationTokens;
  totals.cacheHitRate = denom > 0 ? totals.cacheReadTokens / denom : 0;

  return { totals, byModel, byGroup };
}

function scanJsonlTokens(agentDir: string) {
  const claudeDir = path.join(agentDir, '.claude-shared', 'projects');
  if (!fs.existsSync(claudeDir)) return [];

  const entries: Array<{
    model: string;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheCreationTokens: number;
  }> = [];

  const walk = (dir: string): void => {
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith('.jsonl')) {
          try {
            for (const line of fs.readFileSync(full, 'utf-8').split('\n')) {
              if (!line.trim()) continue;
              try {
                const r = JSON.parse(line);
                if (r.type === 'assistant' && r.message?.usage) {
                  // Skip `<synthetic>` entries — Claude Code's marker for
                  // fabricated assistant turns that don't hit the API
                  // (zero tokens, zero cost, pure control-flow plumbing).
                  // Including them pollutes the By Model table with a
                  // row that's always zeros and grows unboundedly.
                  if (r.message.model === '<synthetic>') continue;
                  const u = r.message.usage;
                  entries.push({
                    model: r.message.model || 'unknown',
                    inputTokens: u.input_tokens || 0,
                    outputTokens: u.output_tokens || 0,
                    cacheReadTokens: u.cache_read_input_tokens || 0,
                    cacheCreationTokens: u.cache_creation_input_tokens || 0,
                  });
                }
              } catch {
                /* skip line */
              }
            }
          } catch {
            /* skip file */
          }
        }
      }
    } catch {
      /* skip dir */
    }
  };
  walk(claudeDir);
  return entries;
}

/**
 * Pull Codex per-turn token usage from each session's app-server logs.
 *
 * Codex stores structured trace data in `<session>/codex/logs_2.sqlite`;
 * every `response.completed` SSE event carries a JSON usage block like:
 *   "usage":{"input_tokens":N,"input_tokens_details":{"cached_tokens":C},"output_tokens":M,...}
 * Model name is earlier in the same log body as `model=<name>` in the
 * tracing spans. We pair the two to synthesise an entry shaped like the
 * Claude-side bag so both feed the same totals.
 *
 * Cache semantics differ: Claude reports cache read + creation separately,
 * Codex reports cached_tokens (reads only). We bucket them as cacheReadTokens
 * and leave cacheCreationTokens=0 for Codex.
 */
function scanCodexTokens(agentDir: string) {
  const entries: Array<{
    model: string;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheCreationTokens: number;
  }> = [];
  let sessNames: string[];
  try {
    sessNames = fs.readdirSync(agentDir).filter((d) => d.startsWith('sess-'));
  } catch {
    return entries;
  }
  const usageRe = /"usage":\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/;
  for (const sess of sessNames) {
    const dbPath = path.join(agentDir, sess, 'codex', 'logs_2.sqlite');
    if (!fs.existsSync(dbPath)) continue;
    let db: Database.Database | null = null;
    try {
      db = new Database(dbPath, { readonly: true });
      const rows = db
        .prepare(
          `SELECT feedback_log_body FROM logs WHERE feedback_log_body LIKE '%response.completed%' AND feedback_log_body LIKE '%"usage"%'`,
        )
        .all() as Array<{ feedback_log_body: string }>;
      for (const r of rows) {
        const body = r.feedback_log_body;
        const usageMatch = body.match(usageRe);
        if (!usageMatch) continue;
        let usage: Record<string, unknown>;
        try {
          usage = JSON.parse('{' + usageMatch[0] + '}').usage;
        } catch {
          continue;
        }
        const modelMatch = body.match(/model=([A-Za-z0-9.\-_]+)/);
        const model = modelMatch ? modelMatch[1] : 'gpt-5.4-mini';
        const inputTotal = Number(usage.input_tokens) || 0;
        const details = (usage.input_tokens_details as { cached_tokens?: number } | undefined) ?? {};
        const cached = Number(details.cached_tokens) || 0;
        entries.push({
          model,
          // Anthropic semantics: input_tokens = fresh (excludes cached).
          // Codex reports total input + cached separately — subtract to match.
          inputTokens: Math.max(0, inputTotal - cached),
          outputTokens: Number(usage.output_tokens) || 0,
          cacheReadTokens: cached,
          cacheCreationTokens: 0,
        });
      }
    } catch {
      /* skip session */
    } finally {
      db?.close();
    }
  }
  return entries;
}

function collectContextWindows() {
  const sessionsDir = path.join(DATA_DIR, 'v2-sessions');
  if (!fs.existsSync(sessionsDir)) return [];

  const results: unknown[] = [];
  const agentGroups = getAllAgentGroups();
  const nameMap = new Map(agentGroups.map((g) => [g.id, g.name]));

  for (const agDir of fs.readdirSync(sessionsDir).filter((d) => d.startsWith('ag-'))) {
    const claudeDir = path.join(sessionsDir, agDir, '.claude-shared', 'projects');
    if (!fs.existsSync(claudeDir)) continue;

    // Find most recent JSONL
    const jsonlFiles: string[] = [];
    const walk = (dir: string): void => {
      try {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) walk(full);
          else if (entry.name.endsWith('.jsonl')) jsonlFiles.push(full);
        }
      } catch {
        /* skip */
      }
    };
    walk(claudeDir);
    if (jsonlFiles.length === 0) continue;

    jsonlFiles.sort((a, b) => {
      try {
        return fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs;
      } catch {
        return 0;
      }
    });

    // Read last assistant turn from newest file
    const content = fs.readFileSync(jsonlFiles[0], 'utf-8');
    const lines = content.split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      if (!lines[i].trim()) continue;
      try {
        const r = JSON.parse(lines[i]);
        if (r.type === 'assistant' && r.message?.usage) {
          const u = r.message.usage;
          const model = r.message.model || 'unknown';
          const ctx = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
          // Max context is 1M when the agent group's configured model has a
          // `[1m]` suffix — which is how we flip the Claude Code SDK into its
          // context-1m beta. Otherwise standard 200K. Read from the DB rather
          // than the JSONL because the JSONL only records the full model id
          // (e.g. `claude-opus-4-7`) with no beta indicator.
          const ag = getAgentGroup(agDir);
          const max = ag?.model && /\[1m\]$/i.test(ag.model.trim()) ? 1_000_000 : 200_000;
          results.push({
            agentGroupId: agDir,
            agentGroupName: nameMap.get(agDir),
            sessionId: path.basename(jsonlFiles[0], '.jsonl'),
            model,
            contextTokens: ctx,
            outputTokens: u.output_tokens || 0,
            cacheReadTokens: u.cache_read_input_tokens || 0,
            cacheCreationTokens: u.cache_creation_input_tokens || 0,
            maxContext: max,
            usagePercent: max > 0 ? Math.round((ctx / max) * 100) : 0,
            timestamp: r.timestamp || '',
          });
          break;
        }
      } catch {
        /* skip */
      }
    }
  }

  return results;
}

function collectActivity() {
  const now = Date.now();
  const buckets: Record<string, { inbound: number; outbound: number }> = {};

  for (let i = 0; i < 24; i++) {
    const key = new Date(now - i * 3600000).toISOString().slice(0, 13);
    buckets[key] = { inbound: 0, outbound: 0 };
  }

  const sessionsDir = path.join(DATA_DIR, 'v2-sessions');
  if (!fs.existsSync(sessionsDir)) return toBucketArray(buckets);

  const cutoff = new Date(now - 86400000).toISOString();

  try {
    for (const agDir of fs.readdirSync(sessionsDir).filter((d) => d.startsWith('ag-'))) {
      const agPath = path.join(sessionsDir, agDir);
      for (const sessDir of fs.readdirSync(agPath).filter((d) => d.startsWith('sess-'))) {
        for (const [dbName, direction] of [
          ['outbound.db', 'outbound'],
          ['inbound.db', 'inbound'],
        ] as const) {
          const dbPath = path.join(agPath, sessDir, dbName);
          if (!fs.existsSync(dbPath)) continue;
          try {
            const db = new Database(dbPath, { readonly: true });
            const table = direction === 'outbound' ? 'messages_out' : 'messages_in';
            const rows = db.prepare(`SELECT timestamp FROM ${table} WHERE timestamp > ?`).all(cutoff) as {
              timestamp: string;
            }[];
            for (const row of rows) {
              const key = row.timestamp.slice(0, 13);
              if (buckets[key]) buckets[key][direction]++;
            }
            db.close();
          } catch {
            /* skip */
          }
        }
      }
    }
  } catch {
    /* skip */
  }

  return toBucketArray(buckets);
}

function toBucketArray(buckets: Record<string, { inbound: number; outbound: number }>) {
  return Object.entries(buckets)
    .map(([hour, counts]) => ({ hour, ...counts }))
    .sort((a, b) => a.hour.localeCompare(b.hour));
}

function collectMessages() {
  const sessionsDir = path.join(DATA_DIR, 'v2-sessions');
  if (!fs.existsSync(sessionsDir)) return [];

  const results: Array<{
    agentGroupId: string;
    sessionId: string;
    inbound: unknown[];
    outbound: unknown[];
    totalIn: number;
    totalOut: number;
    pendingIn: number;
  }> = [];
  const limit = 50;

  try {
    for (const agDir of fs.readdirSync(sessionsDir).filter((d) => d.startsWith('ag-'))) {
      const agPath = path.join(sessionsDir, agDir);
      for (const sessDir of fs.readdirSync(agPath).filter((d) => d.startsWith('sess-'))) {
        const inbound: unknown[] = [];
        const outbound: unknown[] = [];
        let totalIn = 0;
        let totalOut = 0;
        let pendingIn = 0;

        const inDbPath = path.join(agPath, sessDir, 'inbound.db');
        if (fs.existsSync(inDbPath)) {
          try {
            const db = new Database(inDbPath, { readonly: true });
            const rows = db.prepare('SELECT * FROM messages_in ORDER BY seq DESC LIMIT ?').all(limit);
            inbound.push(...(rows as unknown[]).reverse());
            totalIn = (db.prepare('SELECT COUNT(*) AS n FROM messages_in').get() as { n: number }).n;
            // Pending = queued for the agent but not yet handled. messages_in.status
            // defaults to 'pending' on insert; container-runner advances it.
            pendingIn = (
              db.prepare("SELECT COUNT(*) AS n FROM messages_in WHERE status = 'pending'").get() as { n: number }
            ).n;
            db.close();
          } catch {
            /* skip */
          }
        }

        const outDbPath = path.join(agPath, sessDir, 'outbound.db');
        if (fs.existsSync(outDbPath)) {
          try {
            const db = new Database(outDbPath, { readonly: true });
            const rows = db.prepare('SELECT * FROM messages_out ORDER BY seq DESC LIMIT ?').all(limit);
            outbound.push(...(rows as unknown[]).reverse());
            totalOut = (db.prepare('SELECT COUNT(*) AS n FROM messages_out').get() as { n: number }).n;
            db.close();
          } catch {
            /* skip */
          }
        }

        if (totalIn > 0 || totalOut > 0) {
          results.push({ agentGroupId: agDir, sessionId: sessDir, inbound, outbound, totalIn, totalOut, pendingIn });
        }
      }
    }
  } catch {
    /* skip */
  }

  return results;
}

function collectWikis() {
  const groups = getAllAgentGroups().map((g) => ({
    id: g.id,
    name: g.name,
    folder: g.folder,
  }));
  return listWikis(process.cwd(), groups);
}
