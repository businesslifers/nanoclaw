import fs from 'fs';
import http from 'http';
import path from 'path';

import {
  ASSISTANT_NAME,
  GROUPS_DIR,
  MAX_CONCURRENT_CONTAINERS,
  TIMEZONE,
} from './config.js';
import {
  getAllChats,
  getAllSessions,
  getAllTasks,
  getBotReplyAfter,
  getMessageActivity,
  getMessageContent,
  getReactionStats,
  getRecentTaskRunLogs,
  getTaskRunLogs,
  getUsageByGroup,
  getUsageDaily,
  getUsageRecent,
  getUsageTotals,
} from './db.js';
import { readEnvFile } from './env.js';
import { GroupQueue } from './group-queue.js';
import { logger } from './logger.js';
import { StatusState, StatusTracker } from './status-tracker.js';
import { Channel, RegisteredGroup } from './types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DashboardDeps {
  queue: GroupQueue;
  statusTracker: StatusTracker;
  channels: Channel[];
  registeredGroups: () => Record<string, RegisteredGroup>;
  startedAt: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MS_PER_DAY = 86_400_000;
const LOG_SIZE_LIMIT = 102_400;
const PROMPT_TRUNCATE_LENGTH = 80;
const REACTION_DISPLAY_LIMIT = 8;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stateBadgeClass(state: string): string {
  if (state === 'done') return 'badge-green';
  if (state === 'failed') return 'badge-red';
  if (state === 'working') return 'badge-yellow';
  return 'badge-blue';
}

function emptyRow(colspan: number, msg: string): string {
  return `<tr><td colspan="${colspan}" class="empty">${msg}</td></tr>`;
}

function fmtDuration(ms: number): string {
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ${secs % 60}s`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

function ago(ms: number): string {
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ${hrs % 24}h ago`;
}

function elapsedStr(ms: number): string {
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ${secs % 60}s`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

function stateLabel(state: number, terminal: string | null): string {
  if (terminal === 'done') return 'done';
  if (terminal === 'failed') return 'failed';
  if (state === StatusState.RECEIVED) return 'received';
  if (state === StatusState.THINKING) return 'thinking';
  if (state === StatusState.WORKING) return 'working';
  return 'unknown';
}

function stateEmoji(state: number, terminal: string | null): string {
  if (terminal === 'done') return '\u2705';
  if (terminal === 'failed') return '\u274C';
  if (state === StatusState.RECEIVED) return '\uD83D\uDC40';
  if (state === StatusState.THINKING) return '\uD83D\uDCAD';
  if (state === StatusState.WORKING) return '\uD83D\uDD04';
  return '\u2753';
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-AU', {
      timeZone: TIMEZONE,
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return iso;
  }
}

function fmtTokens(n: number): string {
  return n >= 1_000_000
    ? (n / 1_000_000).toFixed(1) + 'M'
    : n >= 1_000
      ? (n / 1_000).toFixed(1) + 'K'
      : String(n);
}

function cacheHitPct(read: number, creation: number): string {
  const total = read + creation;
  return total === 0 ? '-' : Math.round((read / total) * 100) + '%';
}

function statusDot(ok: boolean): string {
  return ok
    ? '<span class="dot dot-green"></span>'
    : '<span class="dot dot-red"></span>';
}

// ---------------------------------------------------------------------------
// CSS
// ---------------------------------------------------------------------------

const CSS = `
:root {
  --bg: #0d1117; --bg2: #161b22; --bg3: #21262d;
  --fg: #c9d1d9; --fg2: #8b949e; --accent: #58a6ff;
  --green: #3fb950; --red: #f85149; --yellow: #d29922; --blue: #58a6ff;
  --border: #30363d; --radius: 6px;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
  background: var(--bg); color: var(--fg); line-height: 1.5; }
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }

.nav { background: var(--bg2); border-bottom: 1px solid var(--border); padding: 0 1.5rem; display: flex; align-items: center; gap: 1.5rem; height: 3rem; }
.nav-brand { font-weight: 600; font-size: 1rem; color: var(--fg); }
.nav a { color: var(--fg2); font-size: 0.875rem; }
.nav a:hover, .nav a.active { color: var(--fg); text-decoration: none; }

.container { max-width: 1200px; margin: 0 auto; padding: 1.5rem; }
.container.wide { max-width: none; }
h1 { font-size: 1.25rem; font-weight: 600; margin-bottom: 1rem; }
h2 { font-size: 1rem; font-weight: 600; margin-bottom: 0.75rem; color: var(--fg2); }

.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
.card { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius); padding: 1rem; }
.card-label { font-size: 0.75rem; color: var(--fg2); text-transform: uppercase; letter-spacing: 0.05em; }
.card-value { font-size: 1.5rem; font-weight: 600; margin-top: 0.25rem; }

.table-wrap { overflow-x: auto; margin-bottom: 1.5rem; }
table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
th { text-align: left; color: var(--fg2); font-weight: 500; padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--border); }
td { padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--border); }
tr:hover td { background: var(--bg2); }

.badge { display: inline-block; padding: 0.125rem 0.5rem; border-radius: 1rem; font-size: 0.75rem; font-weight: 500; }
.badge-green { background: rgba(63,185,80,0.15); color: var(--green); }
.badge-red { background: rgba(248,81,73,0.15); color: var(--red); }
.badge-yellow { background: rgba(210,153,34,0.15); color: var(--yellow); }
.badge-blue { background: rgba(88,166,255,0.15); color: var(--blue); }

.dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 0.375rem; }
.dot-green { background: var(--green); }
.dot-red { background: var(--red); }
.dot-yellow { background: var(--yellow); }

.pulse { animation: pulse 2s infinite; }
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }

.empty { color: var(--fg2); font-style: italic; padding: 1rem 0; }
.mono { font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 0.8125rem; }
.truncate { max-width: 300px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.truncate-wide { max-width: 500px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.log-view { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 1rem; font-family: monospace; font-size: 0.8125rem; white-space: pre-wrap;
  max-height: 600px; overflow-y: auto; line-height: 1.4; color: var(--fg2); }

.section { margin-bottom: 2rem; }

@media (max-width: 640px) {
  .cards { grid-template-columns: 1fr 1fr; }
  .container { padding: 1rem; }
}
`;

// ---------------------------------------------------------------------------
// Inline JS (polling)
// ---------------------------------------------------------------------------

const POLL_JS_HELPERS = `
function esc(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML;}
function fmtElapsed(ms){var s=Math.floor(ms/1000);if(s<60)return s+'s';var m=Math.floor(s/60);if(m<60)return m+'m '+(s%60)+'s';var h=Math.floor(m/60);return h+'h '+(m%60)+'m';}
function fmtAgo(ms){var s=Math.floor(ms/1000);if(s<60)return s+'s ago';var m=Math.floor(s/60);if(m<60)return m+'m ago';var h=Math.floor(m/60);return h+'h '+(m%60)+'m ago';}
`;

const POLL_JS_STATUS = `
setInterval(function(){
  fetch('/api/status').then(function(r){return r.json()}).then(function(d){
    var el=document.getElementById('status-cards');if(!el)return;
    var ch=d.channels.map(function(c){return '<span class="dot dot-'+(c.connected?'green':'red')+'"></span> '+esc(c.name)}).join('&nbsp;&nbsp;');
    var h='';
    h+='<div class="card"><div class="card-label">Uptime</div><div class="card-value">'+fmtElapsed(d.uptime)+'</div></div>';
    h+='<div class="card"><div class="card-label">Containers</div><div class="card-value">'+d.containers.active+' / '+d.containers.max+'</div></div>';
    h+='<div class="card"><div class="card-label">Channels</div><div class="card-value">'+ch+'</div></div>';
    h+='<div class="card"><div class="card-label">Scheduled Tasks</div><div class="card-value">'+d.tasks.active+' active</div></div>';
    el.textContent='';el.insertAdjacentHTML('beforeend',h);
  }).catch(function(){});
},5000);
`;

const POLL_JS_ACTIVITY = `
setInterval(function(){
  fetch('/api/activity').then(function(r){return r.json()}).then(function(data){
    var el=document.getElementById('msg-table');if(!el)return;
    var badges={done:'badge-green',failed:'badge-red',working:'badge-yellow',received:'badge-blue',thinking:'badge-blue'};
    var h='<tr><th></th><th>Group</th><th>State</th><th>Age</th><th style="width:50%">Activity</th></tr>';
    if(data.length===0){h+='<tr><td colspan="5" class="empty">No tracked messages right now</td></tr>';}
    else{for(var i=0;i<data.length;i++){var m=data[i];h+='<tr><td>'+esc(m.emoji)+'</td><td>'+esc(m.groupName)+'</td><td><span class="badge '+(badges[m.state]||'badge-blue')+'">'+esc(m.state)+'</span></td><td>'+fmtAgo(m.age)+'</td><td class="truncate-wide">'+esc(m.activity)+'</td></tr>';}}
    el.textContent='';el.insertAdjacentHTML('beforeend',h);
  }).catch(function(){});
},3000);
`;

const POLL_JS_HISTORY = `
setInterval(function(){
  fetch('/api/history').then(function(r){return r.json()}).then(function(data){
    var el=document.getElementById('history-table');if(!el)return;
    var h='<tr><th></th><th>User Message</th><th>Bot Reply</th><th>Group</th><th>Duration</th><th>Completed</th></tr>';
    if(data.length===0){h+='<tr><td colspan="6" class="empty">No completed messages yet</td></tr>';}
    else{for(var i=0;i<data.length;i++){var m=data[i];var emoji=m.terminal==='done'?'\\u2705':'\\u274C';h+='<tr><td>'+emoji+'</td><td class="truncate-wide" title="'+esc(m.userPreview)+'">'+esc(m.userPreview)+'</td><td class="truncate-wide" title="'+esc(m.botPreview)+'">'+esc(m.botPreview)+'</td><td>'+esc(m.groupName)+'</td><td>'+fmtElapsed(m.durationMs)+'</td><td>'+fmtAgo(Date.now()-m.completedAt)+'</td></tr>';}}
    el.textContent='';el.insertAdjacentHTML('beforeend',h);
  }).catch(function(){});
},3000);
`;

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

function layout(
  title: string,
  activePath: string,
  body: string,
  wide = false,
): string {
  const nav = [
    ['/', 'Overview'],
    ['/wiki', 'Wiki'],
    ['/teams', 'Teams'],
    ['/messages', 'Messages'],
    ['/usage', 'Usage'],
    ['/tasks', 'Tasks'],
    ['/containers', 'Containers'],
  ];
  const navHtml = nav
    .map(
      ([href, label]) =>
        `<a href="${href}"${activePath === href ? ' class="active"' : ''}>${label}</a>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)} - ${escapeHtml(ASSISTANT_NAME)}</title>
<style>${CSS}</style>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"></script>
</head><body>
<nav class="nav"><span class="nav-brand">${escapeHtml(ASSISTANT_NAME)}</span>${navHtml}</nav>
<div class="container${wide ? ' wide' : ''}">${body}</div>
</body></html>`;
}

// ---------------------------------------------------------------------------
// API responses
// ---------------------------------------------------------------------------

function apiStatus(deps: DashboardDeps) {
  const snap = deps.queue.getSnapshot();
  const channelStatus = deps.channels.map((ch) => ({
    name: ch.name,
    connected: ch.isConnected(),
  }));
  const tasks = getAllTasks();
  return {
    assistant: ASSISTANT_NAME,
    timezone: TIMEZONE,
    uptime: Date.now() - deps.startedAt,
    containers: {
      active: snap.activeCount,
      max: MAX_CONCURRENT_CONTAINERS,
      running: snap.active,
      waiting: snap.waitingGroups,
      pendingTasks: snap.totalPendingTasks,
      retrying: snap.totalRetrying,
    },
    channels: channelStatus,
    tasks: {
      total: tasks.length,
      active: tasks.filter((t) => t.status === 'active').length,
      due: tasks.filter(
        (t) =>
          t.status === 'active' &&
          t.next_run &&
          t.next_run <= new Date().toISOString(),
      ).length,
    },
  };
}

interface AgentDef {
  name: string;
  description?: string;
}

function loadGroupAgents(folder: string): AgentDef[] {
  try {
    const agentsPath = path.join(GROUPS_DIR, folder, 'agents.json');
    const raw = JSON.parse(fs.readFileSync(agentsPath, 'utf-8'));

    // Format 1: bare array [ { name, description, ... }, ... ]
    if (Array.isArray(raw)) {
      return raw.map((a: { name: string; description?: string }) => ({
        name: a.name,
        description: a.description,
      }));
    }

    // Format 2: { "agents": [ { name, description, ... }, ... ] }
    if (Array.isArray(raw.agents)) {
      return raw.agents.map((a: { name: string; description?: string }) => ({
        name: a.name,
        description: a.description,
      }));
    }

    // Format 3 (standard): { "AgentName": { description, prompt, ... }, ... }
    return Object.entries(raw).map(([name, def]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      description: (def as { description?: string }).description || undefined,
    }));
  } catch {
    return [];
  }
}

function loadGroupRole(folder: string): string {
  try {
    const mdPath = path.join(GROUPS_DIR, folder, 'CLAUDE.md');
    const content = fs.readFileSync(mdPath, 'utf-8');
    const roleMatch = content.match(/##\s+(?:Role|Identity)\s*\n+([^\n#]+)/);
    if (roleMatch) return roleMatch[1].trim();
    const lines = content
      .split('\n')
      .filter((l) => l.trim() && !l.startsWith('#'));
    return lines[0]?.trim() || '';
  } catch {
    return '';
  }
}

function apiGroups(deps: DashboardDeps) {
  const groups = deps.registeredGroups();
  const chats = getAllChats();
  const chatMap = new Map(chats.map((c) => [c.jid, c]));
  const sessions = getAllSessions();

  return Object.entries(groups).map(([jid, g]) => {
    const agentId = g.isMain
      ? `${ASSISTANT_NAME} (default)`
      : g.folder.toLowerCase().replace(/_/g, '-');
    const subAgents = loadGroupAgents(g.folder);
    const role = loadGroupRole(g.folder);

    return {
      jid,
      name: g.name,
      folder: g.folder,
      trigger: g.trigger,
      isMain: g.isMain || false,
      requiresTrigger: g.requiresTrigger ?? true,
      lastActivity: chatMap.get(jid)?.last_message_time || null,
      channel: chatMap.get(jid)?.channel || null,
      hasSession: !!sessions[g.folder],
      containerActive: deps.queue.isActive(jid),
      agentId,
      subAgents,
      role,
    };
  });
}

function apiTasks() {
  const tasks = getAllTasks();
  const recentRuns = getRecentTaskRunLogs(200);
  const runsByTask = new Map<string, typeof recentRuns>();
  for (const run of recentRuns) {
    const list = runsByTask.get(run.task_id) || [];
    list.push(run);
    runsByTask.set(run.task_id, list);
  }

  return tasks.map((t) => {
    const runs = runsByTask.get(t.id) || [];
    const successCount = runs.filter((r) => r.status === 'success').length;
    return {
      id: t.id,
      groupFolder: t.group_folder,
      prompt: t.prompt,
      scheduleType: t.schedule_type,
      scheduleValue: t.schedule_value,
      status: t.status,
      nextRun: t.next_run,
      lastRun: t.last_run,
      lastResult: t.last_result,
      recentRuns: runs.slice(0, 5),
      stats: {
        totalRuns: runs.length,
        successRate:
          runs.length > 0
            ? Math.round((successCount / runs.length) * 100)
            : null,
        avgDuration:
          runs.length > 0
            ? Math.round(
                runs.reduce((s, r) => s + r.duration_ms, 0) / runs.length,
              )
            : null,
      },
    };
  });
}

function apiActivity(deps: DashboardDeps) {
  const groups = deps.registeredGroups();
  const nameByJid = new Map(
    Object.entries(groups).map(([jid, g]) => [jid, g.name]),
  );
  return deps.statusTracker.getSnapshot().map((m) => ({
    messageId: m.messageId,
    chatJid: m.chatJid,
    groupName: nameByJid.get(m.chatJid) ?? m.chatJid,
    state: stateLabel(m.state, m.terminal),
    emoji: stateEmoji(m.state, m.terminal),
    trackedAt: m.trackedAt,
    age: Date.now() - m.trackedAt,
    activity: m.activity ?? '',
  }));
}

function apiHistory(deps: DashboardDeps) {
  const groups = deps.registeredGroups();
  const nameByJid = new Map(
    Object.entries(groups).map(([jid, g]) => [jid, g.name]),
  );
  return deps.statusTracker
    .getHistory()
    .map((e) => {
      const userMsg = getMessageContent(e.messageId, e.chatJid);
      const botReply = userMsg
        ? getBotReplyAfter(e.chatJid, userMsg.timestamp)
        : undefined;
      return {
        messageId: e.messageId,
        chatJid: e.chatJid,
        groupName: nameByJid.get(e.chatJid) ?? e.chatJid,
        terminal: e.terminal,
        durationMs: e.durationMs,
        completedAt: e.completedAt,
        userPreview: userMsg?.content?.slice(0, 120) ?? '(not found)',
        userSender: userMsg?.sender_name ?? '',
        botPreview: botReply?.content?.slice(0, 120) ?? '(pending)',
      };
    })
    .reverse();
}

function apiContainerLogs(folder: string): string[] | null {
  const logDir = path.join(GROUPS_DIR, folder, 'logs');
  try {
    return fs
      .readdirSync(logDir)
      .filter((f) => f.startsWith('container-') && f.endsWith('.log'))
      .sort()
      .reverse()
      .slice(0, 20);
  } catch {
    return null;
  }
}

function apiContainerLogContent(folder: string, file: string): string | null {
  if (file.includes('/') || file.includes('..')) return null;
  if (!file.startsWith('container-') || !file.endsWith('.log')) return null;

  const logPath = path.join(GROUPS_DIR, folder, 'logs', file);
  try {
    const stat = fs.statSync(logPath);
    if (stat.size > LOG_SIZE_LIMIT) {
      const fd = fs.openSync(logPath, 'r');
      const buf = Buffer.alloc(LOG_SIZE_LIMIT);
      fs.readSync(fd, buf, 0, LOG_SIZE_LIMIT, stat.size - LOG_SIZE_LIMIT);
      fs.closeSync(fd);
      return (
        '... (truncated, showing last 100KB) ...\n' + buf.toString('utf-8')
      );
    }
    return fs.readFileSync(logPath, 'utf-8');
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// HTML pages
// ---------------------------------------------------------------------------

function pageOverview(deps: DashboardDeps): string {
  const status = apiStatus(deps);
  const snap = deps.queue.getSnapshot();
  const activity = apiActivity(deps);

  const channelDots = status.channels
    .map((ch) => `${statusDot(ch.connected)} ${escapeHtml(ch.name)}`)
    .join('&nbsp;&nbsp;');

  const activeRows =
    snap.active.length === 0
      ? emptyRow(4, 'No containers running')
      : snap.active
          .map(
            (c) => `<tr>
        <td>${escapeHtml(c.groupFolder || c.groupJid)}</td>
        <td class="mono">${escapeHtml(c.containerName || '-')}</td>
        <td>${c.isTask ? '<span class="badge badge-blue">task</span>' : '<span class="badge badge-green">messages</span>'}</td>
        <td>${c.runningTaskId ? escapeHtml(c.runningTaskId.slice(0, 8)) : '-'}</td>
      </tr>`,
          )
          .join('');

  // Message activity (24h)
  const oneDayAgo = new Date(Date.now() - MS_PER_DAY).toISOString();
  const msgActivity = getMessageActivity(oneDayAgo);
  const groups = deps.registeredGroups();
  const groupNameByJid = new Map(
    Object.entries(groups).map(([jid, g]) => [jid, g.name]),
  );

  const msgRows =
    msgActivity.length === 0
      ? emptyRow(3, 'No message activity')
      : msgActivity
          .map(
            (m) => `<tr>
        <td>${escapeHtml(groupNameByJid.get(m.chat_jid) || m.chat_jid)}</td>
        <td>${m.recent_count}</td>
        <td>${m.total_count}</td>
      </tr>`,
          )
          .join('');

  // Reactions
  const reactions = getReactionStats();
  const reactionHtml =
    reactions.length > 0
      ? reactions
          .slice(0, REACTION_DISPLAY_LIMIT)
          .map(
            (r) =>
              `<span style="margin-right:1rem">${r.emoji} ${r.count}</span>`,
          )
          .join('')
      : '<span class="empty">No reactions recorded</span>';

  const activityRows =
    activity.length === 0
      ? emptyRow(4, 'No tracked messages')
      : activity
          .map(
            (m) => `<tr>
        <td>${m.emoji}</td>
        <td class="mono">${escapeHtml(m.messageId.slice(0, 12))}</td>
        <td><span class="badge ${stateBadgeClass(m.state)}">${m.state}</span></td>
        <td>${ago(m.age)}</td>
      </tr>`,
          )
          .join('');

  // Build the container status sub-text (pending / retrying counts)
  let containerSubText = '';
  if (snap.totalPendingTasks > 0 || snap.totalRetrying > 0) {
    const parts: string[] = [];
    if (snap.totalPendingTasks > 0)
      parts.push(snap.totalPendingTasks + ' pending');
    if (snap.totalRetrying > 0) parts.push(snap.totalRetrying + ' retrying');
    containerSubText = `<div style="font-size:0.75rem;color:var(--fg2);margin-top:0.25rem">${parts.join(', ')}</div>`;
  }

  return layout(
    'Overview',
    '/',
    `
<h1>Overview</h1>
<div class="cards" id="status-cards">
  <div class="card"><div class="card-label">Uptime</div><div class="card-value">${elapsedStr(status.uptime)}</div></div>
  <div class="card"><div class="card-label">Containers</div><div class="card-value">${status.containers.active} / ${status.containers.max}</div>${containerSubText}</div>
  <div class="card"><div class="card-label">Channels</div><div class="card-value">${channelDots}</div></div>
  <div class="card"><div class="card-label">Scheduled Tasks</div><div class="card-value">${status.tasks.active} active</div></div>
</div>

<div class="section">
  <h2>Active Containers${snap.active.length > 0 ? ' <span class="dot dot-green pulse"></span>' : ''}</h2>
  <div class="table-wrap"><table>
    <tr><th>Group</th><th>Container</th><th>Type</th><th>Task ID</th></tr>
    ${activeRows}
  </table></div>
  ${snap.waitingGroups.length > 0 ? `<p style="color:var(--yellow)">Waiting: ${snap.waitingGroups.map(escapeHtml).join(', ')}</p>` : ''}
</div>

<div class="section">
  <h2>Message Flow</h2>
  <div class="table-wrap"><table>
    <tr><th></th><th>Message</th><th>State</th><th>Age</th></tr>
    ${activityRows}
  </table></div>
</div>

<div class="section">
  <h2>Message Activity (24h)</h2>
  <div class="table-wrap"><table>
    <tr><th>Chat</th><th>Last 24h</th><th>Total</th></tr>
    ${msgRows}
  </table></div>
</div>

<div class="section">
  <h2>Reactions</h2>
  <p>${reactionHtml}</p>
</div>

<script>${POLL_JS_HELPERS}${POLL_JS_STATUS}</script>
`,
  );
}

function pageGroups(deps: DashboardDeps): string {
  // Filter to team groups only (exclude personal/main chats like Adam, Raels)
  const groups = apiGroups(deps).filter(
    (g) => g.folder.includes('-team') || g.subAgents.length > 0,
  );
  groups.sort((a, b) => a.name.localeCompare(b.name));

  const teamCards =
    groups.length === 0
      ? '<p class="empty">No teams registered</p>'
      : groups
          .map((g) => {
            const mainBadge = g.isMain
              ? ' <span class="badge badge-blue">main</span>'
              : '';
            const statusHtml = g.containerActive
              ? '<span class="dot dot-green pulse"></span> Running'
              : '<span class="dot dot-red"></span> Idle';
            const roleHtml = g.role
              ? `<p style="color:var(--fg2);font-size:0.8125rem;margin:0.5rem 0">${escapeHtml(g.role)}</p>`
              : '';

            let agentsHtml = '';
            if (g.subAgents.length > 0) {
              const agentItems = g.subAgents
                .map((a) => {
                  const desc = a.description
                    ? `<span style="color:var(--fg2)"> — ${escapeHtml(a.description)}</span>`
                    : '';
                  // When team container is active, agents show green (available to be called)
                  const agentDot = g.containerActive
                    ? '<span class="dot dot-green pulse" data-agent-dot></span>'
                    : '<span class="dot dot-red" data-agent-dot></span>';
                  return `<div style="padding:0.25rem 0">${agentDot}<span class="badge badge-blue">${escapeHtml(a.name)}</span>${desc}</div>`;
                })
                .join('');
              agentsHtml = `<div style="margin-top:0.75rem" data-agents><div style="font-size:0.75rem;color:var(--fg2);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem">Agents</div>${agentItems}</div>`;
            }

            const meta = [
              `Agent: <span class="mono">${escapeHtml(g.agentId)}</span>`,
              g.trigger ? `Trigger: ${escapeHtml(g.trigger)}` : '',
              g.channel ? `Channel: ${escapeHtml(g.channel)}` : '',
            ]
              .filter(Boolean)
              .join(' <span style="color:var(--border)">|</span> ');

            return `<div class="card" style="padding:1.25rem" data-team-card="${escapeHtml(g.jid)}">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="font-weight:600;font-size:1rem">${escapeHtml(g.name)}${mainBadge}</div>
          <div style="font-size:0.8125rem" data-team-status>${statusHtml}</div>
        </div>
        ${roleHtml}
        <div style="font-size:0.75rem;color:var(--fg2);margin-top:0.5rem">${meta}</div>
        <div style="font-size:0.75rem;color:var(--fg2);margin-top:0.25rem" data-team-activity>${g.lastActivity ? `Last active: ${ago(Date.now() - new Date(g.lastActivity).getTime())}` : ''}</div>
        ${agentsHtml}
      </div>`;
          })
          .join('');

  return layout(
    'Teams',
    '/teams',
    `
<h1>Teams</h1>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(350px,1fr));gap:1rem" id="teams-grid">
  ${teamCards}
</div>
<script>
${POLL_JS_HELPERS}
setInterval(function(){
  fetch('/api/teams').then(function(r){return r.json()}).then(function(teams){
    teams.forEach(function(t){
      var card = document.querySelector('[data-team-card="'+t.jid+'"]');
      if(!card) return;
      // Update team status dot
      var statusEl = card.querySelector('[data-team-status]');
      if(statusEl){
        statusEl.innerHTML = t.containerActive
          ? '<span class="dot dot-green pulse"></span> Running'
          : '<span class="dot dot-red"></span> Idle';
      }
      // Update last activity
      var actEl = card.querySelector('[data-team-activity]');
      if(actEl){
        actEl.textContent = t.lastActivity ? 'Last active: '+fmtAgo(Date.now()-new Date(t.lastActivity).getTime()) : '';
      }
      // Update agent dots
      var dots = card.querySelectorAll('[data-agent-dot]');
      dots.forEach(function(dot){
        if(t.containerActive){
          dot.className = 'dot dot-green pulse';
        } else {
          dot.className = 'dot dot-red';
        }
      });
    });
  }).catch(function(){});
}, 3000);
</script>
`,
    true,
  );
}

function buildScheduleTimeline(
  tasks: ReturnType<typeof apiTasks>,
): { groups: string[]; hours: number[]; slots: Map<string, Set<number>> } {
  const now = new Date();
  const activeCron = tasks.filter(
    (t) => t.status === 'active' && t.scheduleType === 'cron',
  );

  const groups = [...new Set(activeCron.map((t) => t.groupFolder))].sort();
  const hours: number[] = [];
  for (let i = 0; i < 24; i++) {
    hours.push((now.getHours() + i) % 24);
  }

  // Map each group to the set of hour slots (0-23) where tasks fire in the next 24h
  const slots = new Map<string, Set<number>>();
  for (const group of groups) {
    slots.set(group, new Set<number>());
  }

  for (const t of activeCron) {
    if (!t.nextRun) continue;
    // Compute up to 24 firings by walking the cron expression
    try {
      const { CronExpressionParser } = require('cron-parser') as typeof import('cron-parser');
      const interval = CronExpressionParser.parse(t.scheduleValue, {
        tz: TIMEZONE,
        currentDate: now,
      });
      for (let i = 0; i < 24; i++) {
        const next = interval.next();
        const nextDate = next.toDate();
        if (nextDate.getTime() - now.getTime() > 24 * 60 * 60 * 1000) break;
        const localHour = parseInt(
          nextDate.toLocaleString('en-AU', {
            timeZone: TIMEZONE,
            hour: '2-digit',
            hour12: false,
          }),
          10,
        );
        slots.get(t.groupFolder)?.add(localHour);
      }
    } catch {
      // If cron parse fails, use nextRun as fallback
      const nextDate = new Date(t.nextRun);
      if (nextDate.getTime() - now.getTime() <= 24 * 60 * 60 * 1000) {
        const localHour = parseInt(
          nextDate.toLocaleString('en-AU', {
            timeZone: TIMEZONE,
            hour: '2-digit',
            hour12: false,
          }),
          10,
        );
        slots.get(t.groupFolder)?.add(localHour);
      }
    }
  }

  return { groups, hours, slots };
}

function pageTasks(query: URLSearchParams): string {
  const allTasks = apiTasks();
  const filterGroup = query.get('group') || '';
  const tasks = filterGroup
    ? allTasks.filter((t) => t.groupFolder === filterGroup)
    : allTasks;

  // Aggregate stats across all tasks (unfiltered for summary)
  const totalRuns = allTasks.reduce((s, t) => s + t.stats.totalRuns, 0);
  const totalSuccesses = allTasks.reduce(
    (s, t) =>
      s +
      (t.stats.successRate !== null
        ? Math.round((t.stats.successRate / 100) * t.stats.totalRuns)
        : 0),
    0,
  );
  const avgDuration =
    totalRuns > 0
      ? Math.round(
          allTasks.reduce(
            (s, t) => s + (t.stats.avgDuration || 0) * t.stats.totalRuns,
            0,
          ) / totalRuns,
        )
      : 0;
  const overallSuccessRate =
    totalRuns > 0 ? Math.round((totalSuccesses / totalRuns) * 100) : null;

  // Group filter bar
  const uniqueGroups = [...new Set(allTasks.map((t) => t.groupFolder))].sort();
  const filterBar =
    uniqueGroups.length > 1
      ? `<p style="margin-bottom:1rem"><a href="/tasks"${!filterGroup ? ' style="font-weight:600;color:var(--fg)"' : ''}>All</a>${uniqueGroups.map((g) => ` &middot; <a href="/tasks?group=${encodeURIComponent(g)}"${g === filterGroup ? ' style="font-weight:600;color:var(--fg)"' : ''}>${escapeHtml(g)}</a>`).join('')}</p>`
      : '';

  const rows =
    tasks.length === 0
      ? emptyRow(8, 'No scheduled tasks')
      : tasks
          .map((t) => {
            const statusBadge =
              t.status === 'active'
                ? 'badge-green'
                : t.status === 'paused'
                  ? 'badge-yellow'
                  : 'badge-blue';
            const prompt =
              t.prompt.length > PROMPT_TRUNCATE_LENGTH
                ? t.prompt.slice(0, PROMPT_TRUNCATE_LENGTH) + '...'
                : t.prompt;
            const nextRun = t.nextRun
              ? ago(
                  Math.max(0, new Date(t.nextRun).getTime() - Date.now()),
                ).replace(' ago', '')
              : '-';

            const runHistoryHtml =
              t.recentRuns.length === 0
                ? ''
                : `<tr><td colspan="8" style="padding:0"><table style="margin:0.5rem 1rem;width:calc(100% - 2rem)">
          <tr><th>Run At</th><th>Duration</th><th>Status</th><th>Result</th></tr>
          ${t.recentRuns
            .map((r) => {
              const rb = r.status === 'success' ? 'badge-green' : 'badge-red';
              const result = r.result || r.error || '';
              const excerpt =
                result.length > 60 ? result.slice(0, 60) + '...' : result;
              return `<tr>
            <td>${fmtTime(r.run_at)}</td>
            <td>${elapsedStr(r.duration_ms)}</td>
            <td><span class="badge ${rb}">${r.status}</span></td>
            <td class="truncate">${escapeHtml(excerpt)}</td>
          </tr>`;
            })
            .join('')}
        </table></td></tr>`;

            return `<tr>
        <td class="truncate">${escapeHtml(prompt)}</td>
        <td class="mono">${escapeHtml(t.groupFolder)}</td>
        <td>${escapeHtml(t.scheduleType)}</td>
        <td class="mono">${escapeHtml(t.scheduleValue)}</td>
        <td><span class="badge ${statusBadge}">${t.status}</span></td>
        <td>${t.nextRun ? 'in ' + nextRun : '-'}</td>
        <td>${t.stats.successRate !== null ? t.stats.successRate + '%' : '-'}</td>
        <td>${t.stats.avgDuration !== null ? elapsedStr(t.stats.avgDuration) : '-'}</td>
      </tr>${runHistoryHtml}`;
          })
          .join('');

  // Build 24h timeline
  const timeline = buildScheduleTimeline(allTasks);
  const nowHour = new Date().getHours();

  // Count tasks per hour across all groups for density warnings
  const hourDensity = new Map<number, number>();
  for (const hourSet of timeline.slots.values()) {
    for (const h of hourSet) {
      hourDensity.set(h, (hourDensity.get(h) || 0) + 1);
    }
  }

  const timelineHtml =
    timeline.groups.length === 0
      ? ''
      : `<div class="section">
  <h2>24h Schedule Timeline (${TIMEZONE})</h2>
  <div class="table-wrap"><table style="table-layout:fixed">
    <tr>
      <th style="width:160px">Team</th>
      ${timeline.hours.map((h) => {
        const density = hourDensity.get(h) || 0;
        const isCurrent = h === nowHour;
        const style = isCurrent
          ? 'font-weight:600;color:var(--accent)'
          : density >= 3
            ? 'color:var(--yellow)'
            : '';
        return `<th style="width:32px;text-align:center;font-size:0.7rem;${style}">${String(h).padStart(2, '0')}</th>`;
      }).join('')}
    </tr>
    ${timeline.groups.map((group) => {
      const groupSlots = timeline.slots.get(group) || new Set();
      return `<tr>
        <td class="mono" style="font-size:0.75rem">${escapeHtml(group.replace('whatsapp_', ''))}</td>
        ${timeline.hours.map((h) => {
          if (!groupSlots.has(h)) return '<td></td>';
          const density = hourDensity.get(h) || 0;
          const color =
            density >= 3
              ? 'var(--yellow)'
              : 'var(--green)';
          return `<td style="text-align:center"><div style="width:16px;height:16px;border-radius:3px;background:${color};margin:auto;opacity:0.8" title="${group} @ ${h}:00 (${density} teams this hour)"></div></td>`;
        }).join('')}
      </tr>`;
    }).join('')}
    <tr>
      <td style="font-size:0.7rem;color:var(--fg2)">Density</td>
      ${timeline.hours.map((h) => {
        const d = hourDensity.get(h) || 0;
        if (d === 0) return '<td></td>';
        const color = d >= 3 ? 'var(--yellow)' : 'var(--fg2)';
        return `<td style="text-align:center;font-size:0.7rem;color:${color}">${d}</td>`;
      }).join('')}
    </tr>
  </table></div>
  <p style="font-size:0.75rem;color:var(--fg2);margin-top:0.5rem">
    <span style="display:inline-block;width:10px;height:10px;background:var(--green);border-radius:2px;opacity:0.8"></span> task scheduled
    &nbsp;&nbsp;
    <span style="display:inline-block;width:10px;height:10px;background:var(--yellow);border-radius:2px;opacity:0.8"></span> 3+ teams same hour
    &nbsp;&nbsp;
    Current hour highlighted in blue
  </p>
</div>`;

  return layout(
    'Tasks',
    '/tasks',
    `
<h1>Scheduled Tasks</h1>
<div class="cards">
  <div class="card"><div class="card-label">Total Runs</div><div class="card-value">${totalRuns}</div></div>
  <div class="card"><div class="card-label">Avg Duration</div><div class="card-value">${totalRuns > 0 ? elapsedStr(avgDuration) : '-'}</div></div>
  <div class="card"><div class="card-label">Success Rate</div><div class="card-value">${overallSuccessRate !== null ? overallSuccessRate + '%' : '-'}</div></div>
  <div class="card"><div class="card-label">Active Tasks</div><div class="card-value">${allTasks.filter((t) => t.status === 'active').length}</div></div>
</div>
${timelineHtml}
${filterBar}
<div class="section">
  <h2>All Tasks</h2>
  <div class="table-wrap"><table>
    <tr><th>Prompt</th><th>Group</th><th>Type</th><th>Schedule</th><th>Status</th><th>Next Run</th><th>Success Rate</th><th>Avg Duration</th></tr>
    ${rows}
  </table></div>
</div>
`,
  );
}

function pageContainers(deps: DashboardDeps, query: URLSearchParams): string {
  const snap = deps.queue.getSnapshot();
  const groups = deps.registeredGroups();
  const folders = [
    ...new Set(Object.values(groups).map((g) => g.folder)),
  ].sort();
  const selectedFolder = query.get('folder') || '';

  const activeRows =
    snap.active.length === 0
      ? emptyRow(7, 'No containers running')
      : snap.active
          .map(
            (c) => `<tr>
        <td>${escapeHtml(c.groupFolder || c.groupJid)}</td>
        <td class="mono">${escapeHtml(c.containerName || '-')}</td>
        <td>${c.isTask ? '<span class="badge badge-blue">task</span>' : '<span class="badge badge-green">messages</span>'}</td>
        <td>${c.runningTaskId ? escapeHtml(c.runningTaskId.slice(0, 8)) : '-'}</td>
        <td>${c.pendingMessages ? 'yes' : '-'}${c.pendingTaskCount > 0 ? ` + ${c.pendingTaskCount} tasks` : ''}</td>
        <td>${c.retryCount > 0 ? String(c.retryCount) : '-'}</td>
        <td>${c.idleWaiting ? '<span class="badge badge-yellow">idle</span>' : '-'}</td>
      </tr>`,
          )
          .join('');

  let logSection = '';
  if (selectedFolder) {
    const files = apiContainerLogs(selectedFolder);
    if (files === null) {
      logSection = '<p class="empty">No logs directory found</p>';
    } else if (files.length === 0) {
      logSection = '<p class="empty">No log files</p>';
    } else {
      const logFile = query.get('file') || '';
      const fileLinks = files
        .map((f) => {
          const cls =
            f === logFile ? ' style="font-weight:600;color:var(--fg)"' : '';
          return `<a href="/containers?folder=${encodeURIComponent(selectedFolder)}&file=${encodeURIComponent(f)}"${cls}>${escapeHtml(f)}</a>`;
        })
        .join(' &middot; ');
      logSection = `<p>${fileLinks}</p>`;

      if (logFile) {
        const content = apiContainerLogContent(selectedFolder, logFile);
        if (content !== null) {
          logSection += `<div class="log-view">${escapeHtml(content)}</div>`;
        } else {
          logSection += '<p class="empty">Could not read log file</p>';
        }
      }
    }
  }

  const folderOptions = folders
    .map((f) => {
      const cls =
        f === selectedFolder ? ' style="font-weight:600;color:var(--fg)"' : '';
      return `<a href="/containers?folder=${encodeURIComponent(f)}"${cls}>${escapeHtml(f)}</a>`;
    })
    .join(' &middot; ');

  return layout(
    'Containers',
    '/containers',
    `
<h1>Containers</h1>

<div class="section">
  <h2>Active${snap.active.length > 0 ? ' <span class="dot dot-green pulse"></span>' : ''}</h2>
  <div class="table-wrap"><table>
    <tr><th>Group</th><th>Container</th><th>Type</th><th>Task ID</th><th>Pending</th><th>Retries</th><th>State</th></tr>
    ${activeRows}
  </table></div>
  ${snap.waitingGroups.length > 0 ? `<p style="color:var(--yellow)">Queue: ${snap.waitingGroups.map(escapeHtml).join(', ')}</p>` : ''}
</div>

<div class="section">
  <h2>Container Logs</h2>
  <p style="margin-bottom:0.75rem">${folderOptions || '<span class="empty">No groups</span>'}</p>
  ${logSection}
</div>
`,
  );
}

function pageMessages(deps: DashboardDeps): string {
  const activity = apiActivity(deps);

  const activeRows =
    activity.length === 0
      ? emptyRow(5, 'No tracked messages right now')
      : activity
          .map(
            (m) => `<tr>
        <td>${m.emoji}</td>
        <td>${escapeHtml(m.groupName)}</td>
        <td><span class="badge ${stateBadgeClass(m.state)}">${m.state}</span></td>
        <td>${ago(m.age)}</td>
        <td class="truncate-wide">${escapeHtml(m.activity)}</td>
      </tr>`,
          )
          .join('');

  const history = apiHistory(deps);
  const historyRows =
    history.length === 0
      ? emptyRow(6, 'No completed messages yet')
      : history
          .map(
            (m) => `<tr>
        <td>${m.terminal === 'done' ? '\u2705' : '\u274C'}</td>
        <td class="truncate-wide" title="${escapeHtml(m.userPreview)}">${escapeHtml(m.userPreview)}</td>
        <td class="truncate-wide" title="${escapeHtml(m.botPreview)}">${escapeHtml(m.botPreview)}</td>
        <td>${escapeHtml(m.groupName)}</td>
        <td>${fmtDuration(m.durationMs)}</td>
        <td>${ago(Date.now() - m.completedAt)}</td>
      </tr>`,
          )
          .join('');

  return layout(
    'Messages',
    '/messages',
    `
<h1>Message Flow</h1>
<p style="color:var(--fg2);margin-bottom:1rem">
  Shows messages currently being tracked through the processing pipeline.
  States: \uD83D\uDC40 received \u2192 \uD83D\uDCAD thinking \u2192 \uD83D\uDD04 working \u2192 \u2705 done / \u274C failed
</p>
<div class="table-wrap"><table id="msg-table">
  <tr><th></th><th>Group</th><th>State</th><th>Age</th><th style="width:50%">Activity</th></tr>
  ${activeRows}
</table></div>

<h2 style="margin-top:1.5rem">Recent Completions</h2>
<p style="color:var(--fg2);margin-bottom:0.75rem">Last 10 completed messages with their bot replies.</p>
<div class="table-wrap"><table id="history-table">
  <tr><th></th><th>User Message</th><th>Bot Reply</th><th>Group</th><th>Duration</th><th>Completed</th></tr>
  ${historyRows}
</table></div>

<script>${POLL_JS_HELPERS}${POLL_JS_ACTIVITY}${POLL_JS_HISTORY}</script>
`,
  );
}

function pageUsage(): string {
  const totals = getUsageTotals();
  const byGroup = getUsageByGroup();
  const recent = getUsageRecent(30);
  const daily = getUsageDaily();

  // Prepare chart data: aggregate daily tokens across all groups
  const daySet = [...new Set(daily.map((d) => d.day))].sort();
  const groupSet = [...new Set(daily.map((d) => d.group_folder))].sort();

  // Chart colours per group
  const CHART_COLORS = [
    '#58a6ff',
    '#3fb950',
    '#d29922',
    '#f85149',
    '#bc8cff',
    '#39d2c0',
    '#f0883e',
    '#8b949e',
  ];
  const groupColorMap = new Map(
    groupSet.map((g, i) => [g, CHART_COLORS[i % CHART_COLORS.length]]),
  );

  // Build stacked bar datasets for daily token usage (output tokens — most meaningful)
  const tokenDatasets = groupSet.map((group) => {
    const dataByDay = new Map(
      daily.filter((d) => d.group_folder === group).map((d) => [d.day, d]),
    );
    return {
      label: group.replace('whatsapp_', ''),
      data: daySet.map((day) => {
        const entry = dataByDay.get(day);
        return entry ? entry.output_tokens : 0;
      }),
      backgroundColor: groupColorMap.get(group),
    };
  });

  // Build doughnut data for cost by group
  const costLabels = byGroup.map((g) =>
    g.group_folder.replace('whatsapp_', ''),
  );
  const costData = byGroup.map((g) => g.total_cost_usd);
  const costColors = byGroup.map(
    (g) => groupColorMap.get(g.group_folder) || '#8b949e',
  );

  const chartDataJson = JSON.stringify({
    tokenLabels: daySet,
    tokenDatasets,
    costLabels,
    costData,
    costColors,
  });

  const groupRows =
    byGroup.length === 0
      ? emptyRow(
          6,
          'No usage data yet. Data collection begins after the container image is rebuilt with usage tracking.',
        )
      : byGroup
          .map(
            (g) => `<tr>
        <td class="mono">${escapeHtml(g.group_folder)}</td>
        <td>${fmtTokens(g.total_input)}</td>
        <td>${fmtTokens(g.total_output)}</td>
        <td>$${g.total_cost_usd.toFixed(4)}</td>
        <td>${cacheHitPct(g.total_cache_read, g.total_cache_creation)}</td>
        <td>${g.run_count}</td>
      </tr>`,
          )
          .join('');

  const recentRows =
    recent.length === 0
      ? emptyRow(7, 'No usage entries')
      : recent
          .map(
            (r) => `<tr>
        <td class="mono">${escapeHtml(r.group_folder)}</td>
        <td>${fmtTokens(r.input_tokens)}</td>
        <td>${fmtTokens(r.output_tokens)}</td>
        <td>$${r.cost_usd.toFixed(4)}</td>
        <td>${fmtTokens(r.cache_read_tokens)}</td>
        <td>${fmtTime(r.logged_at)}</td>
      </tr>`,
          )
          .join('');

  return layout(
    'Usage',
    '/usage',
    `
<h1>Token Usage</h1>
<div class="cards">
  <div class="card"><div class="card-label">Total Input Tokens</div><div class="card-value">${fmtTokens(totals.total_input)}</div></div>
  <div class="card"><div class="card-label">Total Output Tokens</div><div class="card-value">${fmtTokens(totals.total_output)}</div></div>
  <div class="card"><div class="card-label">Total Cost</div><div class="card-value">$${totals.total_cost_usd.toFixed(4)}</div></div>
  <div class="card"><div class="card-label">Total Runs</div><div class="card-value">${totals.run_count}</div></div>
  <div class="card"><div class="card-label">Cache Hit Ratio</div><div class="card-value">${cacheHitPct(totals.total_cache_read, totals.total_cache_creation)}</div></div>
  <div class="card"><div class="card-label">Cache Tokens Saved</div><div class="card-value">${fmtTokens(totals.total_cache_read)}</div></div>
</div>

<div class="section" style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;">
  <div>
    <h2>Output Tokens by Day</h2>
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:1rem;">
      <canvas id="tokenChart" height="280"></canvas>
    </div>
  </div>
  <div>
    <h2>Cost by Group</h2>
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:1rem;">
      <canvas id="costChart" height="280"></canvas>
    </div>
  </div>
</div>

<div class="section">
  <h2>By Group</h2>
  <div class="table-wrap"><table>
    <tr><th>Group</th><th>Input Tokens</th><th>Output Tokens</th><th>Cost</th><th>Cache Hit</th><th>Runs</th></tr>
    ${groupRows}
  </table></div>
</div>

<div class="section">
  <h2>Recent</h2>
  <div class="table-wrap"><table>
    <tr><th>Group</th><th>Input</th><th>Output</th><th>Cost</th><th>Cache</th><th>Time</th></tr>
    ${recentRows}
  </table></div>
</div>

<script>
(function(){
  var cd = ${chartDataJson};
  var gridColor = 'rgba(48,54,61,0.6)';
  var textColor = '#8b949e';
  Chart.defaults.color = textColor;

  // Stacked bar — daily output tokens
  new Chart(document.getElementById('tokenChart'), {
    type: 'bar',
    data: { labels: cd.tokenLabels, datasets: cd.tokenDatasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12 } },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              var v = ctx.parsed.y;
              var s = v >= 1000000 ? (v/1000000).toFixed(1)+'M' : v >= 1000 ? (v/1000).toFixed(1)+'K' : v;
              return ctx.dataset.label + ': ' + s + ' tokens';
            }
          }
        }
      },
      scales: {
        x: { stacked: true, grid: { color: gridColor } },
        y: {
          stacked: true,
          grid: { color: gridColor },
          ticks: { callback: function(v) { return v >= 1000000 ? (v/1000000).toFixed(0)+'M' : v >= 1000 ? (v/1000).toFixed(0)+'K' : v; } }
        }
      }
    }
  });

  // Doughnut — cost by group
  new Chart(document.getElementById('costChart'), {
    type: 'doughnut',
    data: {
      labels: cd.costLabels,
      datasets: [{ data: cd.costData, backgroundColor: cd.costColors, borderWidth: 0 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12 } },
        tooltip: {
          callbacks: {
            label: function(ctx) { return ctx.label + ': $' + ctx.parsed.toFixed(2); }
          }
        }
      }
    }
  });
})();
</script>
`,
  );
}

// ---------------------------------------------------------------------------
// Wiki
// ---------------------------------------------------------------------------

interface WikiGroupStats {
  folder: string;
  name: string;
  pageCount: number;
  sourceCount: number;
  lastIngest: string | null;
  lastLint: string | null;
  totalLogEntries: number;
}

function scanWikiDir(dirPath: string): number {
  try {
    return fs
      .readdirSync(dirPath)
      .filter((f) => f.endsWith('.md') && f !== 'index.md' && f !== 'log.md')
      .length;
  } catch {
    return 0;
  }
}

function scanSourcesDir(dirPath: string): number {
  try {
    return fs.readdirSync(dirPath).filter((f) => !f.startsWith('.')).length;
  } catch {
    return 0;
  }
}

function parseLastLogEntry(logPath: string, type: string): string | null {
  try {
    const content = fs.readFileSync(logPath, 'utf-8');
    const lines = content.split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].match(new RegExp(`^## \\[.*\\] ${type}`))) {
        const match = lines[i].match(/^## \[(\d{4}-\d{2}-\d{2})\]/);
        return match ? match[1] : null;
      }
    }
  } catch {
    // no log file
  }
  return null;
}

function countLogEntries(logPath: string): number {
  try {
    const content = fs.readFileSync(logPath, 'utf-8');
    return (content.match(/^## \[/gm) || []).length;
  } catch {
    return 0;
  }
}

function apiWiki(deps: DashboardDeps): WikiGroupStats[] {
  const groups = deps.registeredGroups();
  const results: WikiGroupStats[] = [];

  // Global wiki
  const globalWikiDir = path.join(GROUPS_DIR, 'global', 'wiki');
  const globalSourcesDir = path.join(GROUPS_DIR, 'global', 'sources');
  const globalLogPath = path.join(globalWikiDir, 'log.md');
  if (fs.existsSync(globalWikiDir)) {
    results.push({
      folder: 'global',
      name: 'Shared Business Wiki',
      pageCount: scanWikiDir(globalWikiDir),
      sourceCount: scanSourcesDir(globalSourcesDir),
      lastIngest: parseLastLogEntry(globalLogPath, 'ingest'),
      lastLint: parseLastLogEntry(globalLogPath, 'lint'),
      totalLogEntries: countLogEntries(globalLogPath),
    });
  }

  // Per-group wikis
  for (const [, g] of Object.entries(groups)) {
    const wikiDir = path.join(GROUPS_DIR, g.folder, 'wiki');
    if (!fs.existsSync(wikiDir)) continue;
    const sourcesDir = path.join(GROUPS_DIR, g.folder, 'sources');
    const logPath = path.join(wikiDir, 'log.md');
    results.push({
      folder: g.folder,
      name: g.name,
      pageCount: scanWikiDir(wikiDir),
      sourceCount: scanSourcesDir(sourcesDir),
      lastIngest: parseLastLogEntry(logPath, 'ingest'),
      lastLint: parseLastLogEntry(logPath, 'lint'),
      totalLogEntries: countLogEntries(logPath),
    });
  }

  return results;
}

function pageWiki(deps: DashboardDeps): string {
  const wikis = apiWiki(deps);

  const totalPages = wikis.reduce((sum, w) => sum + w.pageCount, 0);
  const totalSources = wikis.reduce((sum, w) => sum + w.sourceCount, 0);
  const activeWikis = wikis.filter(
    (w) => w.pageCount > 0 || w.sourceCount > 0,
  ).length;

  const rows =
    wikis.length === 0
      ? emptyRow(6, 'No wikis configured')
      : wikis
          .map((w) => {
            const globalBadge =
              w.folder === 'global'
                ? ' <span class="badge badge-blue">shared</span>'
                : '';
            const activeBadge =
              w.pageCount > 0 ? ' <span class="dot dot-green"></span>' : '';
            return `<tr>
        <td>${escapeHtml(w.name)}${globalBadge}${activeBadge}</td>
        <td class="mono">${escapeHtml(w.folder)}</td>
        <td>${w.pageCount}</td>
        <td>${w.sourceCount}</td>
        <td>${w.lastIngest || '<span class="empty">never</span>'}</td>
        <td>${w.lastLint || '<span class="empty">never</span>'}</td>
      </tr>`;
          })
          .join('');

  return layout(
    'Wiki',
    '/wiki',
    `
<h1>Wiki Knowledge Bases</h1>
<div class="cards">
  <div class="card"><div class="card-label">Total Pages</div><div class="card-value">${totalPages}</div></div>
  <div class="card"><div class="card-label">Total Sources</div><div class="card-value">${totalSources}</div></div>
  <div class="card"><div class="card-label">Active Wikis</div><div class="card-value">${activeWikis} / ${wikis.length}</div></div>
</div>

<div class="section">
  <h2>Per-Group Wikis</h2>
  <div class="table-wrap"><table>
    <tr><th>Group</th><th>Folder</th><th>Pages</th><th>Sources</th><th>Last Ingest</th><th>Last Lint</th></tr>
    ${rows}
  </table></div>
</div>

<div class="section">
  <h2>How It Works</h2>
  <p>Each group maintains a persistent wiki that compounds knowledge over time. Send sources (URLs, PDFs, images, voice notes) to any group and ask the agent to <strong>ingest</strong> them. <strong>Query</strong> the wiki by asking questions. Weekly <strong>lint</strong> tasks check for contradictions and gaps.</p>
</div>
`,
  );
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

export function startDashboard(deps: DashboardDeps): http.Server | null {
  const envVars = readEnvFile(['DASHBOARD_PORT', 'DASHBOARD_AUTH_TOKEN']);
  const portStr = process.env.DASHBOARD_PORT || envVars.DASHBOARD_PORT;
  if (!portStr) return null;

  const port = parseInt(portStr, 10);
  if (isNaN(port)) return null;

  const authToken =
    process.env.DASHBOARD_AUTH_TOKEN || envVars.DASHBOARD_AUTH_TOKEN || null;

  const server = http.createServer((req, res) => {
    // Auth check
    if (authToken) {
      const header = req.headers['authorization'] ?? '';
      const cookie = req.headers['cookie'] ?? '';
      const tokenInCookie = cookie
        .split(';')
        .map((c) => c.trim())
        .find((c) => c.startsWith('token='));
      const cookieToken = tokenInCookie?.split('=')[1];

      if (header !== `Bearer ${authToken}` && cookieToken !== authToken) {
        const url = new URL(req.url ?? '/', `http://localhost:${port}`);
        if (url.searchParams.get('token') === authToken) {
          res.writeHead(302, {
            'Set-Cookie': `token=${authToken}; Path=/; HttpOnly; SameSite=Strict`,
            Location: url.pathname,
          });
          res.end();
          return;
        }
        res.writeHead(401, { 'Content-Type': 'text/plain' });
        res.end('Unauthorized. Pass ?token=<your-token> to authenticate.');
        return;
      }
    }

    const url = new URL(req.url ?? '/', `http://localhost:${port}`);
    const pathname = url.pathname;

    // JSON API
    if (pathname.startsWith('/api/')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      try {
        if (pathname === '/api/status') {
          res.end(JSON.stringify(apiStatus(deps)));
        } else if (pathname === '/api/groups' || pathname === '/api/teams') {
          res.end(JSON.stringify(apiGroups(deps)));
        } else if (pathname === '/api/tasks') {
          res.end(JSON.stringify(apiTasks()));
        } else if (pathname.match(/^\/api\/tasks\/[^/]+\/runs$/)) {
          const taskId = decodeURIComponent(pathname.split('/')[3]);
          res.end(JSON.stringify(getTaskRunLogs(taskId)));
        } else if (pathname === '/api/containers') {
          res.end(JSON.stringify(deps.queue.getSnapshot()));
        } else if (pathname.match(/^\/api\/containers\/logs\/[^/]+$/)) {
          const folder = decodeURIComponent(pathname.split('/')[4]);
          res.end(JSON.stringify(apiContainerLogs(folder)));
        } else if (pathname.match(/^\/api\/containers\/logs\/[^/]+\/[^/]+$/)) {
          const folder = decodeURIComponent(pathname.split('/')[4]);
          const file = decodeURIComponent(pathname.split('/')[5]);
          const content = apiContainerLogContent(folder, file);
          if (content === null) {
            res.writeHead(404).end(JSON.stringify({ error: 'Not found' }));
          } else {
            res.end(JSON.stringify({ content }));
          }
        } else if (pathname === '/api/activity') {
          res.end(JSON.stringify(apiActivity(deps)));
        } else if (pathname === '/api/history') {
          res.end(JSON.stringify(apiHistory(deps)));
        } else if (pathname === '/api/usage') {
          res.end(
            JSON.stringify({
              totals: getUsageTotals(),
              byGroup: getUsageByGroup(),
              recent: getUsageRecent(50),
            }),
          );
        } else if (pathname === '/api/usage/daily') {
          res.end(JSON.stringify(getUsageDaily()));
        } else if (pathname === '/api/wiki') {
          res.end(JSON.stringify(apiWiki(deps)));
        } else {
          res.writeHead(404).end(JSON.stringify({ error: 'Not found' }));
        }
      } catch (err) {
        logger.error({ err, pathname }, 'Dashboard API error');
        res.writeHead(500).end(JSON.stringify({ error: 'Internal error' }));
      }
      return;
    }

    // HTML pages
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    try {
      if (pathname === '/' || pathname === '/overview') {
        res.end(pageOverview(deps));
      } else if (pathname === '/teams' || pathname === '/groups') {
        res.end(pageGroups(deps));
      } else if (pathname === '/tasks') {
        res.end(pageTasks(url.searchParams));
      } else if (pathname === '/containers') {
        res.end(pageContainers(deps, url.searchParams));
      } else if (pathname === '/messages') {
        res.end(pageMessages(deps));
      } else if (pathname === '/usage') {
        res.end(pageUsage());
      } else if (pathname === '/wiki') {
        res.end(pageWiki(deps));
      } else {
        res
          .writeHead(404)
          .end(layout('Not Found', '', '<h1>404</h1><p>Page not found.</p>'));
      }
    } catch (err) {
      logger.error({ err, pathname }, 'Dashboard render error');
      res.writeHead(500).end('Internal error');
    }
  });

  server.listen(port, '0.0.0.0', () => {
    logger.info({ port }, 'Dashboard listening');
  });

  return server;
}
