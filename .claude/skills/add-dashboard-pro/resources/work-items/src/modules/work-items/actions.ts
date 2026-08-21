/**
 * Delivery action handlers for work items.
 *
 * The container can't write the central DB. When the agent calls
 * create_work_item / update_work_item / add_work_item_note /
 * complete_work_item via MCP, the container writes a `kind='system'`
 * outbound row with an `action` field; these handlers apply the real
 * mutation to `work_items` on delivery — the same central-DB-writing
 * delivery-handler shape as agent-to-agent's handleCreateAgent.
 *
 * SECURITY: the container is untrusted — its MCP-side destination check is
 * trivially bypassed by writing the outbound system row directly, so team
 * assignment is re-validated HERE against the `destinations` ACL
 * (agent_destinations): an agent can only delegate to a team it can already
 * message. Human `assigneeName` resolution is best-effort against
 * users.display_name, and the outcome is ALWAYS echoed back to the agent —
 * a typo'd name that fell back to a raw label is visible in the transcript,
 * never silently swallowed.
 */
import { getAgentGroup } from '../../db/agent-groups.js';
import { getDb, hasTable } from '../../db/connection.js';
import { getRawDb } from '../../db/sqlite-legacy.js';
import { getSession } from '../../db/sessions.js';
import {
  createWorkItem,
  generateWorkItemId,
  getWorkItem,
  isVisibleToTeam,
  touchWorkItem,
  updateWorkItem,
  WORK_ITEM_KINDS,
  WORK_ITEM_STATUSES,
  type NewWorkItem,
  type WorkItem,
  type WorkItemKind,
  type WorkItemStatus,
  type WorkItemUpdate,
} from '../../db/work-items.js';
import { addWorkItemNote } from '../../db/work-item-notes.js';
import { getAllUsers } from '../permissions/db/users.js';
import { TIMEZONE } from '../../config.js';
import { wakeContainer } from '../../container-runner.js';
import { log } from '../../log.js';
import { writeSessionMessage } from '../../session-manager.js';
import type { Session } from '../../types.js';
import { isoWeek, todayInTz } from './period.js';
import { refreshWorkItemsProjection } from './projection.js';
import { nudgeWorkItemsPusher, refreshAndWake } from './wake.js';

/**
 * System echo back to the requesting agent. `wake=false` writes a trigger-0
 * row (context accumulated for the next turn, no extra container turn);
 * `wake=true` is for failures the agent must act on now.
 */
async function echoToAgent(session: Session, text: string, wake: boolean): Promise<void> {
  await writeSessionMessage(session.agent_group_id, session.id, {
    id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind: 'chat',
    timestamp: new Date().toISOString(),
    platformId: session.agent_group_id,
    channelType: 'agent',
    threadId: null,
    content: JSON.stringify({ text, sender: 'system', senderId: 'system' }),
    trigger: wake,
  });
  if (wake) {
    const fresh = await getSession(session.id);
    if (fresh) {
      wakeContainer(fresh).catch((err) => log.error('Failed to wake container after work-item echo', { err }));
    }
  }
}

/**
 * Resolve a human assignee name against users.display_name (case-insensitive
 * exact match). Returns the user id only on a UNIQUE match; otherwise falls
 * back to carrying the raw label, with an echo message describing why.
 */
export async function resolveAssigneeName(name: string): Promise<{
  userId: string | null;
  label: string | null;
  echo: string;
}> {
  const needle = name.trim().toLowerCase();
  const matches = (await getAllUsers()).filter((u) => (u.display_name ?? '').trim().toLowerCase() === needle);
  if (matches.length === 1) {
    return {
      userId: matches[0].id,
      label: null,
      echo: `assignee "${name}" resolved to user ${matches[0].id} (${matches[0].display_name}).`,
    };
  }
  if (matches.length > 1) {
    return {
      userId: null,
      label: name,
      echo: `assignee "${name}" is ambiguous (${matches.length} users share that display name) — stored as a raw label, NOT linked to a user.`,
    };
  }
  return {
    userId: null,
    label: name,
    echo: `assignee "${name}" did not match any known user — stored as a raw label, NOT linked to a user.`,
  };
}

/** Host-side re-validation of a team assignment against the destinations ACL. */
async function canAssignToTeam(sourceAgentGroupId: string, targetAgentGroupId: string): Promise<boolean> {
  if (sourceAgentGroupId === targetAgentGroupId) return true;
  if (!(await hasTable(getDb(), 'agent_destinations'))) return false;
  const row = getRawDb()
    .prepare(
      `SELECT 1 FROM agent_destinations WHERE agent_group_id = ? AND target_type = 'agent' AND target_id = ? LIMIT 1`,
    )
    .get(sourceAgentGroupId, targetAgentGroupId);
  return row !== undefined;
}

interface ResolvedAssignee {
  teamId: string | null;
  userId: string | null;
  label: string | null;
  echoes: string[];
  error: string | null;
}

/** Shared assignee resolution for create + update. */
async function resolveAssignee(content: Record<string, unknown>, session: Session): Promise<ResolvedAssignee> {
  const echoes: string[] = [];
  let teamId: string | null = null;
  let userId: string | null = null;
  let label: string | null = null;

  const rawTeam = content.assigneeAgentGroupId;
  if (typeof rawTeam === 'string' && rawTeam.length > 0) {
    if (!getAgentGroup(rawTeam)) {
      return { teamId, userId, label, echoes, error: `assignee team "${rawTeam}" does not exist.` };
    }
    if (!(await canAssignToTeam(session.agent_group_id, rawTeam))) {
      return {
        teamId,
        userId,
        label,
        echoes,
        error: `you can only assign work to teams you can already message (no destination for "${rawTeam}").`,
      };
    }
    teamId = rawTeam;
  }

  const rawName = content.assigneeName;
  if (!teamId && typeof rawName === 'string' && rawName.trim().length > 0) {
    const resolved = await resolveAssigneeName(rawName);
    userId = resolved.userId;
    label = resolved.label;
    echoes.push(resolved.echo);
  }

  return { teamId, userId, label, echoes, error: null };
}

export async function handleCreateWorkItem(content: Record<string, unknown>, session: Session): Promise<void> {
  const title = typeof content.title === 'string' ? content.title.trim() : '';
  if (!title) {
    await echoToAgent(session, 'create_work_item failed: title is required.', true);
    return;
  }

  const kind =
    typeof content.kind === 'string' && WORK_ITEM_KINDS.includes(content.kind as WorkItemKind)
      ? (content.kind as WorkItemKind)
      : 'task';
  const status =
    typeof content.status === 'string' && WORK_ITEM_STATUSES.includes(content.status as WorkItemStatus)
      ? (content.status as WorkItemStatus)
      : 'open';

  const assignee = await resolveAssignee(content, session);
  if (assignee.error) {
    await echoToAgent(session, `create_work_item failed: ${assignee.error}`, true);
    return;
  }

  const parentId = typeof content.parentId === 'string' && content.parentId ? content.parentId : null;
  if (parentId) {
    const parent = getWorkItem(parentId);
    if (!parent || !isVisibleToTeam(parent, session.agent_group_id)) {
      await echoToAgent(session, `create_work_item failed: parent item "${parentId}" not found for your team.`, true);
      return;
    }
  }

  const id = typeof content.itemId === 'string' && content.itemId ? content.itemId : generateWorkItemId();
  if (getWorkItem(id)) {
    // Duplicate delivery (retry after a crash) — the row is already there.
    log.info('create_work_item: id already exists, skipping', { id });
    return;
  }

  const item: NewWorkItem = {
    id,
    owner_agent_group_id: session.agent_group_id,
    assignee_agent_group_id: assignee.teamId,
    assignee_user_id: assignee.userId,
    assignee_label: assignee.label,
    parent_id: parentId,
    kind,
    title,
    status,
    status_detail: typeof content.statusDetail === 'string' ? content.statusDetail : null,
    due_at: typeof content.dueAt === 'string' && content.dueAt ? content.dueAt : null,
    follow_up_at: typeof content.followUpAt === 'string' && content.followUpAt ? content.followUpAt : null,
    cadence_expected_dow: typeof content.cadenceExpectedDow === 'number' ? content.cadenceExpectedDow : null,
    cadence_period_label: typeof content.cadencePeriodLabel === 'string' ? content.cadencePeriodLabel : null,
    fields_json: content.fields && typeof content.fields === 'object' ? JSON.stringify(content.fields) : null,
    created_by_kind: 'agent',
    created_by_id: session.agent_group_id,
  };
  const created = createWorkItem(item);

  if (typeof content.note === 'string' && content.note.trim()) {
    addWorkItemNote({
      work_item_id: id,
      author_kind: 'agent',
      author_id: session.agent_group_id,
      note: content.note.trim(),
    });
  }

  log.info('Work item created by agent', { id, owner: session.agent_group_id, kind, assigneeTeam: assignee.teamId });

  await refreshAndWake(
    { mutation: 'create', item: created, actorAgentGroupId: session.agent_group_id },
    await buildWakeMessage('created and assigned to you', created, session),
  );

  // Assignee-resolution echo: a failed human match must be visible to the
  // agent, not silently swallowed. Failures wake; clean matches accumulate.
  for (const echo of assignee.echoes) {
    await echoToAgent(session, `create_work_item ${id}: ${echo}`, assignee.userId === null);
  }
}

export async function handleUpdateWorkItem(content: Record<string, unknown>, session: Session): Promise<void> {
  const itemId = typeof content.itemId === 'string' ? content.itemId : '';
  const before = itemId ? getWorkItem(itemId) : undefined;
  if (!before || !isVisibleToTeam(before, session.agent_group_id)) {
    await echoToAgent(session, `update_work_item failed: no work item "${itemId}" visible to your team.`, true);
    return;
  }

  const updates: WorkItemUpdate = {};
  if (typeof content.title === 'string' && content.title.trim()) updates.title = content.title.trim();
  if (typeof content.status === 'string') {
    if (!WORK_ITEM_STATUSES.includes(content.status as WorkItemStatus)) {
      await echoToAgent(
        session,
        `update_work_item failed: invalid status "${content.status}" (expected ${WORK_ITEM_STATUSES.join('|')}).`,
        true,
      );
      return;
    }
    updates.status = content.status as WorkItemStatus;
  }
  if (typeof content.statusDetail === 'string') updates.status_detail = content.statusDetail;
  if (typeof content.dueAt === 'string') updates.due_at = content.dueAt === '' ? null : content.dueAt;
  if (typeof content.followUpAt === 'string')
    updates.follow_up_at = content.followUpAt === '' ? null : content.followUpAt;
  if (content.fields && typeof content.fields === 'object') updates.fields_json = JSON.stringify(content.fields);
  if (typeof content.parentId === 'string') updates.parent_id = content.parentId === '' ? null : content.parentId;

  const assigneeEchoes: string[] = [];
  let isReassign = false;
  if (content.clearAssignee === true) {
    updates.assignee_agent_group_id = null;
    updates.assignee_user_id = null;
    updates.assignee_label = null;
    isReassign = before.assignee_agent_group_id !== null;
  } else if (content.assigneeAgentGroupId !== undefined || content.assigneeName !== undefined) {
    const assignee = await resolveAssignee(content, session);
    if (assignee.error) {
      await echoToAgent(session, `update_work_item failed: ${assignee.error}`, true);
      return;
    }
    updates.assignee_agent_group_id = assignee.teamId;
    updates.assignee_user_id = assignee.userId;
    updates.assignee_label = assignee.label;
    assigneeEchoes.push(...assignee.echoes);
    isReassign = assignee.teamId !== before.assignee_agent_group_id;
  }

  if (Object.keys(updates).length === 0) {
    await echoToAgent(session, `update_work_item ${itemId}: nothing to update.`, false);
    return;
  }

  updateWorkItem(itemId, updates);
  const after = getWorkItem(itemId) as WorkItem;
  log.info('Work item updated by agent', { id: itemId, by: session.agent_group_id, fields: Object.keys(updates) });

  const mutation = isReassign
    ? ('reassign' as const)
    : updates.status !== undefined && updates.status !== before.status
      ? updates.status === 'cancelled'
        ? ('cancel' as const)
        : ('status_change' as const)
      : ('note' as const); // metadata-only edit: refresh projections, wake nobody

  await refreshAndWake(
    {
      mutation,
      item: after,
      previousAssigneeAgentGroupId: before.assignee_agent_group_id,
      actorAgentGroupId: session.agent_group_id,
    },
    await buildWakeMessage(describeChange(before, after), after, session),
  );

  for (const echo of assigneeEchoes) {
    await echoToAgent(
      session,
      `update_work_item ${itemId}: ${echo}`,
      after.assignee_user_id === null && !after.assignee_agent_group_id,
    );
  }
}

export async function handleAddWorkItemNote(content: Record<string, unknown>, session: Session): Promise<void> {
  const itemId = typeof content.itemId === 'string' ? content.itemId : '';
  const note = typeof content.note === 'string' ? content.note.trim() : '';
  const item = itemId ? getWorkItem(itemId) : undefined;
  if (!item || !isVisibleToTeam(item, session.agent_group_id)) {
    await echoToAgent(session, `add_work_item_note failed: no work item "${itemId}" visible to your team.`, true);
    return;
  }
  if (!note) {
    await echoToAgent(session, 'add_work_item_note failed: note text is required.', true);
    return;
  }
  addWorkItemNote({ work_item_id: itemId, author_kind: 'agent', author_id: session.agent_group_id, note });
  // Touch updated_at so bounded projections keep carrying actively-narrated items.
  touchWorkItem(itemId);
  await refreshAndWake(
    { mutation: 'note', item, actorAgentGroupId: session.agent_group_id },
    '', // note wakes nobody; message unused
  );
  log.info('Work item note added by agent', { id: itemId, by: session.agent_group_id });
}

export async function handleCompleteWorkItem(content: Record<string, unknown>, session: Session): Promise<void> {
  const itemId = typeof content.itemId === 'string' ? content.itemId : '';
  const before = itemId ? getWorkItem(itemId) : undefined;
  if (!before || !isVisibleToTeam(before, session.agent_group_id)) {
    await echoToAgent(session, `complete_work_item failed: no work item "${itemId}" visible to your team.`, true);
    return;
  }

  const note = typeof content.note === 'string' ? content.note.trim() : '';

  if (before.kind === 'cadence') {
    // Cadence items are perpetual weekly obligations: completing one stamps
    // the current period (the ops-state.json last_done_week pattern) instead
    // of closing the row. The sweep's cadence branch reads this stamp.
    const period = isoWeek(todayInTz(TIMEZONE));
    updateWorkItem(itemId, { cadence_last_completed_period: period });
    addWorkItemNote({
      work_item_id: itemId,
      author_kind: 'system',
      author_id: session.agent_group_id,
      note: `cadence completed for ${period}${note ? ` — ${note}` : ''}`,
    });
    await refreshWorkItemsProjection(before.owner_agent_group_id);
    nudgeWorkItemsPusher();
    await echoToAgent(session, `complete_work_item ${itemId}: cadence stamped for ${period}.`, false);
    log.info('Cadence work item stamped', { id: itemId, period, by: session.agent_group_id });
    return;
  }

  updateWorkItem(itemId, { status: 'done' });
  if (note) {
    addWorkItemNote({ work_item_id: itemId, author_kind: 'agent', author_id: session.agent_group_id, note });
  }
  const after = getWorkItem(itemId) as WorkItem;
  log.info('Work item completed by agent', { id: itemId, by: session.agent_group_id });

  await refreshAndWake(
    {
      mutation: 'status_change',
      item: after,
      previousAssigneeAgentGroupId: before.assignee_agent_group_id,
      actorAgentGroupId: session.agent_group_id,
    },
    await buildWakeMessage('marked done', after, session),
  );
}

function describeChange(before: WorkItem, after: WorkItem): string {
  if (after.assignee_agent_group_id !== before.assignee_agent_group_id) {
    return 'reassigned';
  }
  if (after.status !== before.status) {
    return `status changed ${before.status} → ${after.status}`;
  }
  return 'updated';
}

async function buildWakeMessage(what: string, item: WorkItem, session: Session): Promise<string> {
  const actor = (await getAgentGroup(session.agent_group_id))?.name ?? session.agent_group_id;
  const parts = [
    `[work-item] "${item.title}" (${item.id}) ${what} by team ${actor}.`,
    `Status: ${item.status}${item.status_detail ? ` (${item.status_detail})` : ''}.`,
  ];
  if (item.due_at) parts.push(`Due: ${item.due_at}.`);
  if (item.follow_up_at) parts.push(`Follow-up: ${item.follow_up_at}.`);
  parts.push('Use list_work_items / update_work_item / add_work_item_note to act on it.');
  return parts.join(' ');
}
