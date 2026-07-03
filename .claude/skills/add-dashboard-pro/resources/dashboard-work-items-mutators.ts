/**
 * Host-side write handlers for work items, invoked by the dashboard's HTTP
 * layer (split out like dashboard-tasks.ts, wired into
 * buildDashboardMutatorContext).
 *
 * Authorization is `canAccessAgentGroup` (member or higher) on the item's
 * owner OR assignee team — routine supervisory action, same tier as task
 * pause/resume. Two mutations require MORE:
 *   - reassignWorkItem additionally requires access to the TARGET team —
 *     without this, a member of team A could freely route work into any
 *     team B's queue with no check on B at all (an asymmetry the agent-side
 *     tool doesn't have; it's bounded by the destinations ACL).
 *   - createWorkItem applies the same target-team rule to an initial
 *     assignee, for the same reason.
 *
 * Every mutator: DB write → audit row (target_type 'work_item') →
 * projection refresh + wake matrix (identical to the agent-side handlers) →
 * nudgePusher so the UI refreshes within ~1s.
 */
import { getAgentGroup } from './db/agent-groups.js';
import { getUser } from './modules/permissions/db/users.js';
import { appendAudit } from './db/dashboard-audit.js';
import {
  createWorkItem as createWorkItemDb,
  generateWorkItemId,
  getWorkItem,
  touchWorkItem,
  updateWorkItem as updateWorkItemDb,
  WORK_ITEM_KINDS,
  WORK_ITEM_STATUSES,
  type WorkItem,
  type WorkItemKind,
  type WorkItemStatus,
  type WorkItemUpdate,
} from './db/work-items.js';
import { addWorkItemNote as addWorkItemNoteDb } from './db/work-item-notes.js';
import { canAccessAgentGroup } from './modules/permissions/access.js';
import { refreshAndWake, type WorkItemMutationKind } from './modules/work-items/wake.js';
import { MutatorAuthError, MutatorNotFoundError, MutatorValidationError } from './dashboard-mutators.js';
import { nudgePusher } from './dashboard-pusher.js';

const TITLE_MAX = 300;

export interface CreateWorkItemArgs {
  title: string;
  ownerAgentGroupId: string;
  kind?: string;
  status?: string;
  statusDetail?: string | null;
  assigneeAgentGroupId?: string | null;
  assigneeUserId?: string | null;
  assigneeLabel?: string | null;
  parentId?: string | null;
  dueAt?: string | null;
  followUpAt?: string | null;
  cadenceExpectedDow?: number | null;
  fields?: Record<string, unknown> | null;
  note?: string | null;
}

export interface UpdateWorkItemArgs {
  id: string;
  title?: string;
  status?: string;
  statusDetail?: string | null;
  kind?: string;
  parentId?: string | null;
  dueAt?: string | null;
  followUpAt?: string | null;
  cadenceExpectedDow?: number | null;
  fields?: Record<string, unknown> | null;
}

export interface ReassignWorkItemArgs {
  id: string;
  assigneeAgentGroupId?: string | null;
  assigneeUserId?: string | null;
  assigneeLabel?: string | null;
}

export interface WorkItemMutatorResult {
  ok: true;
  item: WorkItem;
}

function requireItem(id: unknown): WorkItem {
  if (typeof id !== 'string' || id.length === 0) throw new MutatorValidationError('id is required');
  const item = getWorkItem(id);
  if (!item) throw new MutatorNotFoundError(`work item ${id} not found`);
  return item;
}

/** Member-or-higher on the item's owner OR assignee team. */
function authorizeItemAccess(actorUserId: string, item: WorkItem): void {
  const owner = canAccessAgentGroup(actorUserId, item.owner_agent_group_id);
  if (owner.allowed) return;
  if (item.assignee_agent_group_id) {
    const assignee = canAccessAgentGroup(actorUserId, item.assignee_agent_group_id);
    if (assignee.allowed) return;
  }
  throw new MutatorAuthError(`actor cannot access work item ${item.id}: ${owner.reason}`);
}

function authorizeTeam(actorUserId: string, agentGroupId: string, why: string): void {
  const decision = canAccessAgentGroup(actorUserId, agentGroupId);
  if (!decision.allowed) {
    throw new MutatorAuthError(`actor cannot access ${why} ${agentGroupId}: ${decision.reason}`);
  }
}

function validateTitle(raw: unknown): string {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    throw new MutatorValidationError('title must be a non-empty string');
  }
  const trimmed = raw.trim();
  if (trimmed.length > TITLE_MAX) throw new MutatorValidationError(`title exceeds ${TITLE_MAX} chars`);
  return trimmed;
}

function validateStatus(raw: unknown): WorkItemStatus {
  if (typeof raw !== 'string' || !WORK_ITEM_STATUSES.includes(raw as WorkItemStatus)) {
    throw new MutatorValidationError(`status must be one of ${WORK_ITEM_STATUSES.join(', ')}`);
  }
  return raw as WorkItemStatus;
}

function validateKind(raw: unknown): WorkItemKind {
  if (typeof raw !== 'string' || !WORK_ITEM_KINDS.includes(raw as WorkItemKind)) {
    throw new MutatorValidationError(`kind must be one of ${WORK_ITEM_KINDS.join(', ')}`);
  }
  return raw as WorkItemKind;
}

interface ValidatedAssignee {
  teamId: string | null;
  userId: string | null;
  label: string | null;
}

function validateAssignee(
  actorUserId: string,
  args: { assigneeAgentGroupId?: string | null; assigneeUserId?: string | null; assigneeLabel?: string | null },
): ValidatedAssignee {
  const teamId = args.assigneeAgentGroupId ?? null;
  const userId = args.assigneeUserId ?? null;
  const label = args.assigneeLabel ?? null;
  if (teamId && userId) {
    throw new MutatorValidationError('assignee is a team OR a human, not both');
  }
  if (teamId) {
    if (!getAgentGroup(teamId)) throw new MutatorNotFoundError(`assignee team ${teamId} not found`);
    // Target-team ACL — the reassignment asymmetry fix.
    authorizeTeam(actorUserId, teamId, 'target team');
    return { teamId, userId: null, label: null };
  }
  if (userId) {
    if (!getUser(userId)) throw new MutatorNotFoundError(`assignee user ${userId} not found`);
    return { teamId: null, userId, label: null };
  }
  return { teamId: null, userId: null, label: label ? String(label).trim() || null : null };
}

function validateParent(parentId: string, ownerAgentGroupId: string, selfId?: string): void {
  if (selfId && parentId === selfId) throw new MutatorValidationError('an item cannot be its own parent');
  const parent = getWorkItem(parentId);
  if (!parent) throw new MutatorNotFoundError(`parent item ${parentId} not found`);
  if (parent.owner_agent_group_id !== ownerAgentGroupId && parent.assignee_agent_group_id !== ownerAgentGroupId) {
    throw new MutatorValidationError(`parent item ${parentId} belongs to a different team's board`);
  }
}

function actorDisplay(actorUserId: string): string {
  return getUser(actorUserId)?.display_name ?? actorUserId;
}

function buildDashboardWakeMessage(what: string, item: WorkItem, actorUserId: string): string {
  const parts = [
    `[work-item] "${item.title}" (${item.id}) ${what} from the dashboard by ${actorDisplay(actorUserId)}.`,
    `Status: ${item.status}${item.status_detail ? ` (${item.status_detail})` : ''}.`,
  ];
  if (item.due_at) parts.push(`Due: ${item.due_at}.`);
  if (item.follow_up_at) parts.push(`Follow-up: ${item.follow_up_at}.`);
  parts.push('Use list_work_items / update_work_item / add_work_item_note to act on it.');
  return parts.join(' ');
}

export function createWorkItem(args: CreateWorkItemArgs, actorUserId: string): WorkItemMutatorResult {
  if (!args || typeof args !== 'object') throw new MutatorValidationError('args must be an object');
  const title = validateTitle(args.title);
  if (typeof args.ownerAgentGroupId !== 'string' || !args.ownerAgentGroupId) {
    throw new MutatorValidationError('ownerAgentGroupId is required');
  }
  if (!getAgentGroup(args.ownerAgentGroupId)) {
    throw new MutatorNotFoundError(`owner team ${args.ownerAgentGroupId} not found`);
  }
  authorizeTeam(actorUserId, args.ownerAgentGroupId, 'owner team');

  const kind = args.kind !== undefined ? validateKind(args.kind) : 'task';
  const status = args.status !== undefined ? validateStatus(args.status) : 'open';
  const assignee = validateAssignee(actorUserId, args);
  if (args.parentId) validateParent(args.parentId, args.ownerAgentGroupId);

  const item = createWorkItemDb({
    id: generateWorkItemId(),
    owner_agent_group_id: args.ownerAgentGroupId,
    assignee_agent_group_id: assignee.teamId,
    assignee_user_id: assignee.userId,
    assignee_label: assignee.label,
    parent_id: args.parentId ?? null,
    kind,
    title,
    status,
    status_detail: args.statusDetail ?? null,
    due_at: args.dueAt ?? null,
    follow_up_at: args.followUpAt ?? null,
    cadence_expected_dow: args.cadenceExpectedDow ?? null,
    fields_json: args.fields ? JSON.stringify(args.fields) : null,
    created_by_kind: 'dashboard_user',
    created_by_id: actorUserId,
  });

  if (args.note && String(args.note).trim()) {
    addWorkItemNoteDb({
      work_item_id: item.id,
      author_kind: 'dashboard_user',
      author_id: actorUserId,
      note: String(args.note).trim(),
    });
  }

  appendAudit({
    actor_user_id: actorUserId,
    action: 'work_item.create',
    target_type: 'work_item',
    target_id: item.id,
    before: null,
    after: item as unknown as Record<string, unknown>,
  });

  refreshAndWake(
    { mutation: 'create', item },
    buildDashboardWakeMessage('created and assigned to you', item, actorUserId),
  );
  nudgePusher();
  return { ok: true, item };
}

/**
 * Dashboard status-move rule: an item worked by an AGENT (team assignee — or
 * unassigned, where the owner team's agent is the de facto worker) only
 * accepts 'open' (in effect a re-schedule) or 'cancelled' from a human
 * operator; the agent moves its own card through in_progress / blocked /
 * done as it actually works (its MCP path is not gated by this). Items
 * assigned to a human can be moved to any column. The UI mirrors this rule;
 * this is the enforcement.
 */
function assertDashboardStatusMoveAllowed(before: WorkItem, next: WorkItemStatus): void {
  const humanAssigned = before.assignee_user_id !== null || before.assignee_label !== null;
  if (humanAssigned) return;
  if (next === 'open' || next === 'cancelled') return;
  throw new MutatorValidationError(
    `agent-worked items can only be re-opened or cancelled from the dashboard (attempted ${before.status} → ${next}); the assigned agent moves it through in_progress/blocked/done`,
  );
}

export function updateWorkItem(args: UpdateWorkItemArgs, actorUserId: string): WorkItemMutatorResult {
  if (!args || typeof args !== 'object') throw new MutatorValidationError('args must be an object');
  const before = requireItem(args.id);
  authorizeItemAccess(actorUserId, before);

  const updates: WorkItemUpdate = {};
  if (args.title !== undefined) updates.title = validateTitle(args.title);
  if (args.status !== undefined) {
    updates.status = validateStatus(args.status);
    if (updates.status !== before.status) assertDashboardStatusMoveAllowed(before, updates.status);
  }
  if (args.kind !== undefined) updates.kind = validateKind(args.kind);
  if (args.statusDetail !== undefined)
    updates.status_detail = args.statusDetail === null ? null : String(args.statusDetail);
  if (args.dueAt !== undefined) updates.due_at = args.dueAt === null || args.dueAt === '' ? null : String(args.dueAt);
  if (args.followUpAt !== undefined) {
    updates.follow_up_at = args.followUpAt === null || args.followUpAt === '' ? null : String(args.followUpAt);
  }
  if (args.cadenceExpectedDow !== undefined) {
    updates.cadence_expected_dow = args.cadenceExpectedDow === null ? null : Number(args.cadenceExpectedDow);
  }
  if (args.fields !== undefined) updates.fields_json = args.fields === null ? null : JSON.stringify(args.fields);
  if (args.parentId !== undefined) {
    if (args.parentId === null || args.parentId === '') {
      updates.parent_id = null;
    } else {
      validateParent(String(args.parentId), before.owner_agent_group_id, before.id);
      updates.parent_id = String(args.parentId);
    }
  }

  if (Object.keys(updates).length === 0) throw new MutatorValidationError('no fields to update');

  updateWorkItemDb(before.id, updates);
  const after = getWorkItem(before.id) as WorkItem;

  appendAudit({
    actor_user_id: actorUserId,
    action: 'work_item.update',
    target_type: 'work_item',
    target_id: before.id,
    before: before as unknown as Record<string, unknown>,
    after: after as unknown as Record<string, unknown>,
  });

  let mutation: WorkItemMutationKind = 'note'; // metadata-only edit: refresh, wake nobody
  let what = 'updated';
  if (updates.status !== undefined && updates.status !== before.status) {
    mutation = updates.status === 'cancelled' ? 'cancel' : 'status_change';
    what = updates.status === 'cancelled' ? 'cancelled' : `status changed ${before.status} → ${after.status}`;
  } else if (
    (updates.due_at !== undefined && updates.due_at !== before.due_at) ||
    (updates.follow_up_at !== undefined && updates.follow_up_at !== before.follow_up_at)
  ) {
    mutation = 'status_change'; // matrix row: status/due-date change
    what = 'schedule changed';
  }

  refreshAndWake(
    { mutation, item: after, previousAssigneeAgentGroupId: before.assignee_agent_group_id },
    buildDashboardWakeMessage(what, after, actorUserId),
  );
  nudgePusher();
  return { ok: true, item: after };
}

export function reassignWorkItem(args: ReassignWorkItemArgs, actorUserId: string): WorkItemMutatorResult {
  if (!args || typeof args !== 'object') throw new MutatorValidationError('args must be an object');
  const before = requireItem(args.id);
  authorizeItemAccess(actorUserId, before);
  // validateAssignee enforces the target-team ACL when a team is given.
  const assignee = validateAssignee(actorUserId, args);

  updateWorkItemDb(before.id, {
    assignee_agent_group_id: assignee.teamId,
    assignee_user_id: assignee.userId,
    assignee_label: assignee.label,
  });
  const after = getWorkItem(before.id) as WorkItem;

  appendAudit({
    actor_user_id: actorUserId,
    action: 'work_item.reassign',
    target_type: 'work_item',
    target_id: before.id,
    before: {
      assignee_agent_group_id: before.assignee_agent_group_id,
      assignee_user_id: before.assignee_user_id,
      assignee_label: before.assignee_label,
    },
    after: {
      assignee_agent_group_id: after.assignee_agent_group_id,
      assignee_user_id: after.assignee_user_id,
      assignee_label: after.assignee_label,
    },
  });

  refreshAndWake(
    {
      mutation: 'reassign',
      item: after,
      previousAssigneeAgentGroupId: before.assignee_agent_group_id,
    },
    buildDashboardWakeMessage('reassigned', after, actorUserId),
  );
  nudgePusher();
  return { ok: true, item: after };
}

export function cancelWorkItem(args: { id: string; note?: string | null }, actorUserId: string): WorkItemMutatorResult {
  if (!args || typeof args !== 'object') throw new MutatorValidationError('args must be an object');
  const before = requireItem(args.id);
  authorizeItemAccess(actorUserId, before);
  if (before.status === 'cancelled') throw new MutatorValidationError('work item is already cancelled');

  updateWorkItemDb(before.id, { status: 'cancelled' });
  if (args.note && String(args.note).trim()) {
    addWorkItemNoteDb({
      work_item_id: before.id,
      author_kind: 'dashboard_user',
      author_id: actorUserId,
      note: String(args.note).trim(),
    });
  }
  const after = getWorkItem(before.id) as WorkItem;

  appendAudit({
    actor_user_id: actorUserId,
    action: 'work_item.cancel',
    target_type: 'work_item',
    target_id: before.id,
    before: { status: before.status },
    after: { status: after.status },
  });

  refreshAndWake(
    { mutation: 'cancel', item: after, previousAssigneeAgentGroupId: before.assignee_agent_group_id },
    buildDashboardWakeMessage('cancelled', after, actorUserId),
  );
  nudgePusher();
  return { ok: true, item: after };
}

export function addWorkItemNote(args: { id: string; note: string }, actorUserId: string): WorkItemMutatorResult {
  if (!args || typeof args !== 'object') throw new MutatorValidationError('args must be an object');
  const item = requireItem(args.id);
  authorizeItemAccess(actorUserId, item);
  const note = typeof args.note === 'string' ? args.note.trim() : '';
  if (!note) throw new MutatorValidationError('note must be a non-empty string');

  addWorkItemNoteDb({ work_item_id: item.id, author_kind: 'dashboard_user', author_id: actorUserId, note });
  touchWorkItem(item.id);

  appendAudit({
    actor_user_id: actorUserId,
    action: 'work_item.note',
    target_type: 'work_item',
    target_id: item.id,
    before: null,
    after: { note },
  });

  // Notes wake nobody, but projections refresh so agents see the narrative.
  refreshAndWake({ mutation: 'note', item }, '');
  nudgePusher();
  return { ok: true, item: getWorkItem(item.id) as WorkItem };
}
