#!/usr/bin/env node
/**
 * add-work-items wiring — idempotent anchored inserts.
 *
 * The new work-items source files are dropped in as whole files (safe: they
 * are creations). This script performs the 8 in-place wiring edits into
 * existing host/agent files. Every edit is GUARDED — re-running is a no-op —
 * and anchored on text that exists on both upstream trunk and forks, so it
 * survives version drift (no git-patch ancestor-blob dependency).
 *
 * Usage: node wire.mjs [repoRoot]   (defaults to process.cwd())
 * Exit 0 = all edits applied or already present. Exit 1 = an anchor was not
 * found (tree drifted past what this skill version understands — do not build).
 *
 * Provenance: cut from businesslifers/derek-v2 commits 70d916a6 + 4f21b127.
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.argv[2] || process.cwd();
let failed = 0;
const done = [];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}
function write(rel, text) {
  fs.writeFileSync(path.join(ROOT, rel), text);
}

/**
 * Insert `insert` into file `rel`, relative to an anchor.
 * - guard: if this substring is already in the file, skip (idempotent).
 * - findAnchor(lines) -> index of the anchor line, or -1 if not found.
 * - where: 'after' | 'before' the anchor line.
 */
function edit(rel, { guard, findAnchor, where, insert, label }) {
  const src = read(rel);
  if (src.includes(guard)) {
    done.push(`  = ${rel} :: ${label} (already present)`);
    return;
  }
  const lines = src.split('\n');
  const idx = findAnchor(lines);
  if (idx < 0) {
    console.error(`  ! ${rel} :: ${label} — ANCHOR NOT FOUND`);
    failed++;
    return;
  }
  const at = where === 'after' ? idx + 1 : idx;
  const insertLines = insert.replace(/\n$/, '').split('\n');
  lines.splice(at, 0, ...insertLines);
  write(rel, lines.join('\n'));
  done.push(`  + ${rel} :: ${label}`);
}

const firstIndex = (lines, pred, from = 0) => {
  for (let i = from; i < lines.length; i++) if (pred(lines[i])) return i;
  return -1;
};
const lineIs = (s) => (lines) => firstIndex(lines, (l) => l === s);
const lineHas = (s) => (lines) => firstIndex(lines, (l) => l.includes(s));

// 1) src/modules/index.ts — host module barrel
edit('src/modules/index.ts', {
  label: 'module barrel',
  guard: "import './work-items/index.js';",
  findAnchor: lineHas("import './self-mod/index.js';"),
  where: 'after',
  insert: "import './work-items/index.js';\n",
});

// 2a) src/db/migrations/index.ts — migration import
edit('src/db/migrations/index.ts', {
  label: 'migration103 import',
  guard: "from './103-work-items.js'",
  findAnchor: lineHas("from './018-approvals-approver-user-id.js';"),
  where: 'after',
  insert: "import { migration103 } from './103-work-items.js';\n",
});

// 2b) src/db/migrations/index.ts — migration array entry (before the `];` that
//     closes `export const migrations`)
edit('src/db/migrations/index.ts', {
  label: 'migration103 array entry',
  guard: '\n  migration103,',
  findAnchor: (lines) => {
    const start = firstIndex(lines, (l) => l.includes('export const migrations'));
    if (start < 0) return -1;
    return firstIndex(lines, (l) => l.trim() === '];', start);
  },
  where: 'before',
  insert: '  migration103,\n',
});

// 3a) src/db/schema.ts — work_items + work_item_notes into central SCHEMA,
//     after the pending_sender_approvals table's closing `);`
edit('src/db/schema.ts', {
  label: 'work_items tables (central SCHEMA)',
  guard: 'CREATE TABLE work_items (',
  findAnchor: (lines) => {
    const u = firstIndex(lines, (l) => l.includes('UNIQUE(messaging_group_id, sender_identity)'));
    if (u < 0) return -1;
    return firstIndex(lines, (l) => l.trim() === ');', u);
  },
  where: 'after',
  insert: `
-- Canonical cross-team work-item store (migration 103). One row per tracked
-- unit of work across every team: tasks, cross-team delegations, owner-blocked
-- deliverables, content-calendar slots (parents), weekly cadence obligations.
--   status: fixed core enum 'open'|'in_progress'|'blocked'|'done'|'cancelled'
--           (cross-team Kanban must mean the same thing everywhere);
--           status_detail is free-text, team-specific, display-only.
--   kind:   'task'|'delegation'|'deliverable'|'content_slot'|'cadence' —
--           advisory/unenforced; filters + routes host sweep logic.
--   owner_agent_group_id is always a team (the board the item lives on);
--   assignee is a team OR a human (assignee_user_id), never both required.
--   assignee_label holds the raw human label when name resolution against
--   users.display_name found no match (never silently swallowed).
--   completed_at is set by the mutation layer when status transitions to
--   'done' (never client-supplied); cleared if the item is reopened.
--   reminder_tier / reminder_last_sent_at: sweep dedup state (deliverable
--   tier cascade + cadence daily RAG + delegation re-nag throttle).
--   cadence_*: weekly-stream obligations (ISO dow / period stamps).
CREATE TABLE work_items (
  id                            TEXT PRIMARY KEY,
  owner_agent_group_id          TEXT NOT NULL REFERENCES agent_groups(id),
  assignee_agent_group_id       TEXT REFERENCES agent_groups(id),
  assignee_user_id              TEXT REFERENCES users(id),
  assignee_label                TEXT,
  parent_id                     TEXT REFERENCES work_items(id),
  kind                          TEXT NOT NULL DEFAULT 'task',
  title                         TEXT NOT NULL,
  status                        TEXT NOT NULL DEFAULT 'open',
  status_detail                 TEXT,
  due_at                        TEXT,
  follow_up_at                  TEXT,
  completed_at                  TEXT,
  reminder_tier                 TEXT,
  reminder_last_sent_at         TEXT,
  cadence_expected_dow          INTEGER,
  cadence_period_label          TEXT,
  cadence_last_completed_period TEXT,
  fields_json                   TEXT,
  created_by_kind               TEXT NOT NULL,   -- 'agent' | 'dashboard_user' | 'system'
  created_by_id                 TEXT,
  created_at                    TEXT NOT NULL,
  updated_at                    TEXT NOT NULL
);
CREATE INDEX idx_work_items_owner ON work_items(owner_agent_group_id, status);
CREATE INDEX idx_work_items_assignee ON work_items(assignee_agent_group_id, status);
CREATE INDEX idx_work_items_due ON work_items(due_at);
CREATE INDEX idx_work_items_parent ON work_items(parent_id);

-- The agent's own running narrative per work item (LPG-style handoff notes:
-- dozens of timestamped paragraphs). Deliberately separate from
-- dashboard_audit, which is a structured before/after compliance log of
-- dashboard-actor mutations — different volume, different shape.
CREATE TABLE work_item_notes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  work_item_id TEXT NOT NULL REFERENCES work_items(id),
  ts           TEXT NOT NULL,
  author_kind  TEXT NOT NULL,   -- 'agent' | 'dashboard_user' | 'system'
  author_id    TEXT,
  note         TEXT NOT NULL
);
CREATE INDEX idx_work_item_notes_item ON work_item_notes(work_item_id, ts);
`,
});

// 3b) src/db/schema.ts — work_items_cache into INBOUND_SCHEMA, after the
//     session_routing table's closing `);`
edit('src/db/schema.ts', {
  label: 'work_items_cache (INBOUND_SCHEMA)',
  guard: 'CREATE TABLE IF NOT EXISTS work_items_cache (',
  findAnchor: (lines) => {
    const s = firstIndex(lines, (l) => l.includes('CREATE TABLE IF NOT EXISTS session_routing'));
    if (s < 0) return -1;
    return firstIndex(lines, (l) => l.trim() === ');', s);
  },
  where: 'after',
  insert: `
-- Read-only projection of the central work_items table for this session's
-- agent group (owner OR assignee). Containers can't reach data/v2.db, so
-- the host rewrites this table on container wake and after any work-item
-- mutation touching the group (src/modules/work-items/projection.ts). Only
-- carries non-terminal items plus done/cancelled items completed within the
-- last 14 days — bounded, not a historical archive. The container's
-- list_work_items MCP tool reads it; the container never writes it.
CREATE TABLE IF NOT EXISTS work_items_cache (
  id                            TEXT PRIMARY KEY,
  relation                      TEXT NOT NULL,   -- 'owner' | 'assignee' | 'both'
  owner_agent_group_id          TEXT NOT NULL,
  owner_name                    TEXT,
  assignee_agent_group_id       TEXT,
  assignee_user_id              TEXT,
  assignee_name                 TEXT,
  assignee_kind                 TEXT,            -- 'team' | 'human' | NULL
  parent_id                     TEXT,
  parent_title                  TEXT,
  kind                          TEXT NOT NULL,
  title                         TEXT NOT NULL,
  status                        TEXT NOT NULL,
  status_detail                 TEXT,
  due_at                        TEXT,
  follow_up_at                  TEXT,
  completed_at                  TEXT,
  cadence_expected_dow          INTEGER,
  cadence_period_label          TEXT,
  cadence_last_completed_period TEXT,
  fields_json                   TEXT,
  created_by_kind               TEXT,
  created_at                    TEXT,
  updated_at                    TEXT,
  refreshed_at                  TEXT NOT NULL
);
`,
});

// 4) src/db/session-db.ts — ensureWorkItemsCacheTable, after migrateMessagesInTable closes
edit('src/db/session-db.ts', {
  label: 'ensureWorkItemsCacheTable()',
  guard: 'export function ensureWorkItemsCacheTable',
  findAnchor: (lines) => {
    const start = firstIndex(lines, (l) => l.includes('export function migrateMessagesInTable'));
    if (start < 0) return -1;
    return firstIndex(lines, (l) => l === '}', start + 1);
  },
  where: 'after',
  insert: `
/**
 * Lazily create the work_items_cache projection table on pre-existing
 * session DBs (fresh sessions get it from INBOUND_SCHEMA). Same idiom as
 * migrateMessagesInTable — called from session-manager's openInboundDb so
 * every host-side open guarantees the table exists before the projection
 * writer or the container's list_work_items tool touches it.
 */
export function ensureWorkItemsCacheTable(db: Database.Database): void {
  db.exec(\`
    CREATE TABLE IF NOT EXISTS work_items_cache (
      id                            TEXT PRIMARY KEY,
      relation                      TEXT NOT NULL,
      owner_agent_group_id          TEXT NOT NULL,
      owner_name                    TEXT,
      assignee_agent_group_id       TEXT,
      assignee_user_id              TEXT,
      assignee_name                 TEXT,
      assignee_kind                 TEXT,
      parent_id                     TEXT,
      parent_title                  TEXT,
      kind                          TEXT NOT NULL,
      title                         TEXT NOT NULL,
      status                        TEXT NOT NULL,
      status_detail                 TEXT,
      due_at                        TEXT,
      follow_up_at                  TEXT,
      completed_at                  TEXT,
      cadence_expected_dow          INTEGER,
      cadence_period_label          TEXT,
      cadence_last_completed_period TEXT,
      fields_json                   TEXT,
      created_by_kind               TEXT,
      created_at                    TEXT,
      updated_at                    TEXT,
      refreshed_at                  TEXT NOT NULL
    );
  \`);
}
`,
});

// 5a) src/session-manager.ts — import ensureWorkItemsCacheTable
edit('src/session-manager.ts', {
  label: 'import ensureWorkItemsCacheTable',
  guard: 'ensureWorkItemsCacheTable',
  findAnchor: lineHas('  migrateMessagesInTable,'),
  where: 'after',
  insert: '  ensureWorkItemsCacheTable,\n',
});

// 5b) src/session-manager.ts — call ensureWorkItemsCacheTable(db) in openInboundDb
edit('src/session-manager.ts', {
  label: 'call ensureWorkItemsCacheTable(db)',
  guard: 'ensureWorkItemsCacheTable(db)',
  findAnchor: lineHas('  migrateMessagesInTable(db);'),
  where: 'after',
  insert: '  ensureWorkItemsCacheTable(db);\n',
});

// 6) src/host-sweep.ts — work-item reliability sweep hook
edit('src/host-sweep.ts', {
  label: 'work-items sweep hook',
  guard: 'MODULE-HOOK:work-items-sweep',
  findAnchor: lineHas('// MODULE-HOOK:approvals-reason-sweep:end'),
  where: 'after',
  insert: `
  // Work-item reliability sweep: delegation follow-ups, deliverable tier
  // cascade, weekly cadence RAG. Central-DB scan once per tick — not per
  // session. Replaces LPG's three per-team cron scripts.
  // MODULE-HOOK:work-items-sweep:start
  try {
    const { sweepWorkItems } = await import('./modules/work-items/sweep.js');
    await sweepWorkItems();
  } catch (err) {
    log.error('Work-items sweep failed', { err });
  }
  // MODULE-HOOK:work-items-sweep:end
`,
});

// 7) src/container-runner.ts — refresh work-items projection on spawn
edit('src/container-runner.ts', {
  label: 'work-items projection refresh on spawn',
  guard: 'refreshWorkItemsProjection',
  findAnchor: lineHas('writeSessionRouting(agentGroup.id, session.id);'),
  where: 'after',
  insert: `
  // Refresh the work-items projection so the container's list_work_items
  // reads current state on wake. Guarded: teams with zero work_items rows
  // skip the rewrite entirely — no central-DB scan + session-DB write added
  // to the spawn latency of agents that never touch the feature.
  try {
    const { teamHasWorkItems } = await import('./db/work-items.js');
    if (hasTable(getDb(), 'work_items') && teamHasWorkItems(agentGroup.id)) {
      const { refreshWorkItemsProjection } = await import('./modules/work-items/projection.js');
      refreshWorkItemsProjection(agentGroup.id);
    }
  } catch (err) {
    log.warn('work-items projection refresh on spawn failed', { agentGroupId: agentGroup.id, err });
  }
`,
});

// 8) container/agent-runner/src/mcp-tools/index.ts — agent MCP tool barrel
edit('container/agent-runner/src/mcp-tools/index.ts', {
  label: 'agent MCP tool barrel',
  guard: "import './work-items.js';",
  findAnchor: lineHas("import './self-mod.js';"),
  where: 'after',
  insert: "import './work-items.js';\n",
});

console.log(done.join('\n'));
if (failed > 0) {
  console.error(`\nwire.mjs: ${failed} anchor(s) not found — tree drifted. Do NOT build; report to the skill maintainer.`);
  process.exit(1);
}
console.log('\nwire.mjs: all wiring applied (idempotent).');
