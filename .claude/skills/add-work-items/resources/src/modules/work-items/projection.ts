/**
 * Session-side work-item projection.
 *
 * Containers can't reach the central DB (data/v2.db) — the two session DBs
 * are the sole IO surface. This module rewrites the `work_items_cache` table
 * inside each of a team's session inbound DBs so the container's
 * `list_work_items` tool has something local to read.
 *
 * Refresh points:
 *   (a) container wake — spawnContainer calls refreshWorkItemsProjection
 *       next to writeDestinations/writeSessionRouting, guarded by
 *       teamHasWorkItems so teams that never touch the feature pay nothing;
 *   (b) immediately after any mutation touching the team (owner, new
 *       assignee, previous assignee on reassignment) — always BEFORE any
 *       wake, so the woken agent sees a projection that already reflects
 *       the change it's being woken about.
 */
import fs from 'fs';

import { getAgentGroup } from '../../db/agent-groups.js';
import { getUser } from '../permissions/db/users.js';
import { getSessionsByAgentGroup } from '../../db/sessions.js';
import { listProjectionRowsForTeam, type WorkItem } from '../../db/work-items.js';
import { log } from '../../log.js';
import { inboundDbPath, openInboundDb } from '../../session-manager.js';

export interface ProjectionRow {
  id: string;
  relation: 'owner' | 'assignee' | 'both';
  owner_agent_group_id: string;
  owner_name: string | null;
  assignee_agent_group_id: string | null;
  assignee_user_id: string | null;
  assignee_name: string | null;
  assignee_kind: 'team' | 'human' | null;
  parent_id: string | null;
  parent_title: string | null;
  kind: string;
  title: string;
  status: string;
  status_detail: string | null;
  due_at: string | null;
  follow_up_at: string | null;
  completed_at: string | null;
  cadence_expected_dow: number | null;
  cadence_period_label: string | null;
  cadence_last_completed_period: string | null;
  fields_json: string | null;
  created_by_kind: string | null;
  created_at: string | null;
  updated_at: string | null;
  refreshed_at: string;
}

/** Resolve display fields once per refresh; group/user lookups are memoized per call. */
export function buildProjectionRows(agentGroupId: string, items: WorkItem[]): ProjectionRow[] {
  const refreshedAt = new Date().toISOString();
  const groupNames = new Map<string, string | null>();
  const groupName = (id: string | null): string | null => {
    if (!id) return null;
    if (!groupNames.has(id)) groupNames.set(id, getAgentGroup(id)?.name ?? null);
    return groupNames.get(id) ?? null;
  };
  const titleById = new Map(items.map((i) => [i.id, i.title]));

  return items.map((item) => {
    const isOwner = item.owner_agent_group_id === agentGroupId;
    const isAssignee = item.assignee_agent_group_id === agentGroupId;
    let assigneeKind: 'team' | 'human' | null = null;
    let assigneeName: string | null = null;
    if (item.assignee_agent_group_id) {
      assigneeKind = 'team';
      assigneeName = groupName(item.assignee_agent_group_id);
    } else if (item.assignee_user_id) {
      assigneeKind = 'human';
      assigneeName = getUser(item.assignee_user_id)?.display_name ?? item.assignee_user_id;
    } else if (item.assignee_label) {
      assigneeKind = 'human';
      assigneeName = item.assignee_label;
    }
    return {
      id: item.id,
      relation: isOwner && isAssignee ? 'both' : isOwner ? 'owner' : 'assignee',
      owner_agent_group_id: item.owner_agent_group_id,
      owner_name: groupName(item.owner_agent_group_id),
      assignee_agent_group_id: item.assignee_agent_group_id,
      assignee_user_id: item.assignee_user_id,
      assignee_name: assigneeName,
      assignee_kind: assigneeKind,
      parent_id: item.parent_id,
      parent_title: item.parent_id ? (titleById.get(item.parent_id) ?? null) : null,
      kind: item.kind,
      title: item.title,
      status: item.status,
      status_detail: item.status_detail,
      due_at: item.due_at,
      follow_up_at: item.follow_up_at,
      completed_at: item.completed_at,
      cadence_expected_dow: item.cadence_expected_dow,
      cadence_period_label: item.cadence_period_label,
      cadence_last_completed_period: item.cadence_last_completed_period,
      fields_json: item.fields_json,
      created_by_kind: item.created_by_kind,
      created_at: item.created_at,
      updated_at: item.updated_at,
      refreshed_at: refreshedAt,
    };
  });
}

/**
 * Rewrite work_items_cache in every active session of the agent group.
 * Full delete+insert inside one transaction per session DB — the projection
 * is bounded (non-terminal + 14-day terminal window), so this stays cheap.
 */
export function refreshWorkItemsProjection(agentGroupId: string): void {
  let rows: ProjectionRow[];
  try {
    rows = buildProjectionRows(agentGroupId, listProjectionRowsForTeam(agentGroupId));
  } catch (err) {
    log.error('work-items projection: central read failed', { agentGroupId, err });
    return;
  }

  const sessions = getSessionsByAgentGroup(agentGroupId).filter((s) => s.status === 'active');
  for (const session of sessions) {
    const dbPath = inboundDbPath(agentGroupId, session.id);
    if (!fs.existsSync(dbPath)) continue;
    try {
      const db = openInboundDb(agentGroupId, session.id);
      try {
        const insert = db.prepare(
          `INSERT INTO work_items_cache (
             id, relation, owner_agent_group_id, owner_name,
             assignee_agent_group_id, assignee_user_id, assignee_name, assignee_kind,
             parent_id, parent_title, kind, title, status, status_detail,
             due_at, follow_up_at, completed_at,
             cadence_expected_dow, cadence_period_label, cadence_last_completed_period,
             fields_json, created_by_kind, created_at, updated_at, refreshed_at
           ) VALUES (
             @id, @relation, @owner_agent_group_id, @owner_name,
             @assignee_agent_group_id, @assignee_user_id, @assignee_name, @assignee_kind,
             @parent_id, @parent_title, @kind, @title, @status, @status_detail,
             @due_at, @follow_up_at, @completed_at,
             @cadence_expected_dow, @cadence_period_label, @cadence_last_completed_period,
             @fields_json, @created_by_kind, @created_at, @updated_at, @refreshed_at
           )`,
        );
        db.transaction(() => {
          db.prepare('DELETE FROM work_items_cache').run();
          for (const row of rows) insert.run(row as unknown as Record<string, unknown>);
        })();
      } finally {
        db.close();
      }
    } catch (err) {
      log.warn('work-items projection: session rewrite failed', { agentGroupId, sessionId: session.id, err });
    }
  }
  log.debug('work-items projection refreshed', { agentGroupId, rows: rows.length, sessions: sessions.length });
}
