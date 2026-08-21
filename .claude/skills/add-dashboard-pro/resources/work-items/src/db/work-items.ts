/**
 * DB helpers for the canonical cross-team work-item store (migration 103).
 *
 * The owner-OR-assignee visibility predicate lives HERE, once — every read
 * and write path (dashboard collector, dashboard mutators, delivery-action
 * handlers, session projection, sweep) must go through `visibleToTeamSql` /
 * `isVisibleToTeam` rather than re-deriving its own filter. A single-ID
 * owner-only filter is the copy-paste bug this module exists to prevent: it
 * silently hides cross-team delegations from the assignee's side.
 */
import type Database from 'better-sqlite3';

import { getRawDb } from './sqlite-legacy.js';

export type WorkItemStatus = 'open' | 'in_progress' | 'blocked' | 'done' | 'cancelled';
export type WorkItemKind = 'task' | 'delegation' | 'deliverable' | 'content_slot' | 'cadence';
export type WorkItemAuthorKind = 'agent' | 'dashboard_user' | 'system';

export const WORK_ITEM_STATUSES: WorkItemStatus[] = ['open', 'in_progress', 'blocked', 'done', 'cancelled'];
export const WORK_ITEM_KINDS: WorkItemKind[] = ['task', 'delegation', 'deliverable', 'content_slot', 'cadence'];
export const TERMINAL_STATUSES: WorkItemStatus[] = ['done', 'cancelled'];

/** How many days a done/cancelled item stays in session projections + agent list results. */
export const PROJECTION_TERMINAL_WINDOW_DAYS = 14;

export interface WorkItem {
  id: string;
  owner_agent_group_id: string;
  assignee_agent_group_id: string | null;
  assignee_user_id: string | null;
  assignee_label: string | null;
  parent_id: string | null;
  kind: WorkItemKind;
  title: string;
  status: WorkItemStatus;
  status_detail: string | null;
  due_at: string | null;
  follow_up_at: string | null;
  completed_at: string | null;
  reminder_tier: string | null;
  reminder_last_sent_at: string | null;
  cadence_expected_dow: number | null;
  cadence_period_label: string | null;
  cadence_last_completed_period: string | null;
  fields_json: string | null;
  created_by_kind: WorkItemAuthorKind;
  created_by_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewWorkItem {
  id: string;
  owner_agent_group_id: string;
  assignee_agent_group_id?: string | null;
  assignee_user_id?: string | null;
  assignee_label?: string | null;
  parent_id?: string | null;
  kind?: WorkItemKind;
  title: string;
  status?: WorkItemStatus;
  status_detail?: string | null;
  due_at?: string | null;
  follow_up_at?: string | null;
  reminder_tier?: string | null;
  reminder_last_sent_at?: string | null;
  cadence_expected_dow?: number | null;
  cadence_period_label?: string | null;
  cadence_last_completed_period?: string | null;
  fields_json?: string | null;
  created_by_kind: WorkItemAuthorKind;
  created_by_id?: string | null;
}

/** Fields callers may update directly. completed_at is intentionally absent —
 *  it's derived from status transitions inside updateWorkItem, never client-supplied. */
export interface WorkItemUpdate {
  title?: string;
  status?: WorkItemStatus;
  status_detail?: string | null;
  kind?: WorkItemKind;
  assignee_agent_group_id?: string | null;
  assignee_user_id?: string | null;
  assignee_label?: string | null;
  parent_id?: string | null;
  due_at?: string | null;
  follow_up_at?: string | null;
  reminder_tier?: string | null;
  reminder_last_sent_at?: string | null;
  cadence_expected_dow?: number | null;
  cadence_period_label?: string | null;
  cadence_last_completed_period?: string | null;
  fields_json?: string | null;
}

/**
 * The one owner-OR-assignee visibility predicate. `param` is the SQL
 * placeholder name (used twice); interpolating a *name* is safe — values
 * always bind through prepared-statement params.
 */
export function visibleToTeamSql(param = 'agentGroupId'): string {
  return `(owner_agent_group_id = @${param} OR assignee_agent_group_id = @${param})`;
}

/** JS twin of visibleToTeamSql for in-memory filtering (projection rows, tests). */
export function isVisibleToTeam(
  item: Pick<WorkItem, 'owner_agent_group_id' | 'assignee_agent_group_id'>,
  agentGroupId: string,
): boolean {
  return item.owner_agent_group_id === agentGroupId || item.assignee_agent_group_id === agentGroupId;
}

export function isTerminalStatus(status: string): boolean {
  return TERMINAL_STATUSES.includes(status as WorkItemStatus);
}

export function generateWorkItemId(): string {
  return `wi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createWorkItem(item: NewWorkItem, db: Database.Database = getRawDb()): WorkItem {
  const now = new Date().toISOString();
  const status = item.status ?? 'open';
  db.prepare(
    `INSERT INTO work_items (
       id, owner_agent_group_id, assignee_agent_group_id, assignee_user_id, assignee_label,
       parent_id, kind, title, status, status_detail, due_at, follow_up_at, completed_at,
       reminder_tier, reminder_last_sent_at,
       cadence_expected_dow, cadence_period_label, cadence_last_completed_period,
       fields_json, created_by_kind, created_by_id, created_at, updated_at
     ) VALUES (
       @id, @owner_agent_group_id, @assignee_agent_group_id, @assignee_user_id, @assignee_label,
       @parent_id, @kind, @title, @status, @status_detail, @due_at, @follow_up_at, @completed_at,
       @reminder_tier, @reminder_last_sent_at,
       @cadence_expected_dow, @cadence_period_label, @cadence_last_completed_period,
       @fields_json, @created_by_kind, @created_by_id, @created_at, @updated_at
     )`,
  ).run({
    id: item.id,
    owner_agent_group_id: item.owner_agent_group_id,
    assignee_agent_group_id: item.assignee_agent_group_id ?? null,
    assignee_user_id: item.assignee_user_id ?? null,
    assignee_label: item.assignee_label ?? null,
    parent_id: item.parent_id ?? null,
    kind: item.kind ?? 'task',
    title: item.title,
    status,
    status_detail: item.status_detail ?? null,
    due_at: item.due_at ?? null,
    follow_up_at: item.follow_up_at ?? null,
    completed_at: status === 'done' ? now : null,
    reminder_tier: item.reminder_tier ?? null,
    reminder_last_sent_at: item.reminder_last_sent_at ?? null,
    cadence_expected_dow: item.cadence_expected_dow ?? null,
    cadence_period_label: item.cadence_period_label ?? null,
    cadence_last_completed_period: item.cadence_last_completed_period ?? null,
    fields_json: item.fields_json ?? null,
    created_by_kind: item.created_by_kind,
    created_by_id: item.created_by_id ?? null,
    created_at: now,
    updated_at: now,
  });
  return getWorkItem(item.id, db) as WorkItem;
}

export function getWorkItem(id: string, db: Database.Database = getRawDb()): WorkItem | undefined {
  return db.prepare('SELECT * FROM work_items WHERE id = ?').get(id) as WorkItem | undefined;
}

/**
 * Partial update. Stamps updated_at, and derives completed_at from status
 * transitions: entering 'done' sets it, leaving 'done' (reopen) clears it.
 * Returns the number of touched rows (0 = no such item).
 */
export function updateWorkItem(id: string, updates: WorkItemUpdate, db: Database.Database = getRawDb()): number {
  const before = getWorkItem(id, db);
  if (!before) return 0;

  const fields: string[] = [];
  const values: Record<string, unknown> = { id };
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    fields.push(`${key} = @${key}`);
    values[key] = value;
  }

  if (updates.status !== undefined && updates.status !== before.status) {
    if (updates.status === 'done') {
      fields.push('completed_at = @completed_at');
      values.completed_at = new Date().toISOString();
    } else if (before.status === 'done') {
      fields.push('completed_at = @completed_at');
      values.completed_at = null;
    }
  }

  if (fields.length === 0) return 0;
  fields.push('updated_at = @updated_at');
  values.updated_at = new Date().toISOString();

  const result = db.prepare(`UPDATE work_items SET ${fields.join(', ')} WHERE id = @id`).run(values);
  return result.changes;
}

/** Bump updated_at only — keeps actively-narrated items inside the bounded projection window. */
export function touchWorkItem(id: string, db: Database.Database = getRawDb()): void {
  db.prepare('UPDATE work_items SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), id);
}

export function listAllWorkItems(db: Database.Database = getRawDb()): WorkItem[] {
  return db.prepare('SELECT * FROM work_items ORDER BY created_at DESC').all() as WorkItem[];
}

/** Everything a team can see: items it owns OR items assigned to it. */
export function listWorkItemsForTeam(agentGroupId: string, db: Database.Database = getRawDb()): WorkItem[] {
  return db
    .prepare(`SELECT * FROM work_items WHERE ${visibleToTeamSql()} ORDER BY created_at DESC`)
    .all({ agentGroupId }) as WorkItem[];
}

/**
 * Cheap spawn-hook guard: does this team have ANY work items? Used to skip
 * the projection rewrite entirely for teams that never touch the feature —
 * no central-DB scan + session-DB rewrite added to their spawn latency.
 */
export function teamHasWorkItems(agentGroupId: string, db: Database.Database = getRawDb()): boolean {
  const row = db.prepare(`SELECT 1 FROM work_items WHERE ${visibleToTeamSql()} LIMIT 1`).get({ agentGroupId }) as
    | { 1: number }
    | undefined;
  return row !== undefined;
}

/**
 * Rows carried by a team's session projection (`work_items_cache`): every
 * non-terminal item, plus done/cancelled items completed (or, for cancelled,
 * last touched) within the last PROJECTION_TERMINAL_WINDOW_DAYS days — NOT
 * the full historical archive, so per-wake rewrite cost stays bounded as
 * items accumulate over months.
 */
export function listProjectionRowsForTeam(agentGroupId: string, db: Database.Database = getRawDb()): WorkItem[] {
  const cutoff = new Date(Date.now() - PROJECTION_TERMINAL_WINDOW_DAYS * 86_400_000).toISOString();
  return db
    .prepare(
      `SELECT * FROM work_items
        WHERE ${visibleToTeamSql()}
          AND (status NOT IN ('done', 'cancelled')
               OR COALESCE(completed_at, updated_at) >= @cutoff)
        ORDER BY created_at DESC`,
    )
    .all({ agentGroupId, cutoff }) as WorkItem[];
}
