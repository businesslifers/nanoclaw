/**
 * Per-snapshot collector for work items.
 *
 * Unlike the task collector (which fans out over every session's inbound.db),
 * work items live in ONE central table — this is a single-query read against
 * data/v2.db via getDb(), decorated with display names and recent notes.
 *
 * The dashboard pusher calls collectWorkItems() on every snapshot push
 * (~60s) and after every work-item mutator (via nudgePusher).
 */
import { getAllAgentGroups } from './db/agent-groups.js';
import { getDb, hasTable } from './db/connection.js';
import { listAllWorkItems, isTerminalStatus } from './db/work-items.js';
import { getAllUsers } from './modules/permissions/db/users.js';
import { log } from './log.js';

/** Terminal (done/cancelled) items older than this drop out of the snapshot. */
const SNAPSHOT_TERMINAL_WINDOW_DAYS = 60;
/** Notes carried per item in the snapshot (newest last). */
const SNAPSHOT_NOTES_PER_ITEM = 30;

export interface WorkItemNoteSummary {
  ts: string;
  authorKind: string;
  authorId: string | null;
  authorName: string | null;
  note: string;
}

export interface WorkItemSummary {
  id: string;
  ownerAgentGroupId: string;
  ownerName: string;
  assigneeAgentGroupId: string | null;
  assigneeUserId: string | null;
  /** Team name, user display name, or raw fallback label. */
  assigneeName: string | null;
  assigneeKind: 'team' | 'human' | null;
  parentId: string | null;
  parentTitle: string | null;
  kind: string;
  title: string;
  status: string;
  statusDetail: string | null;
  dueAt: string | null;
  followUpAt: string | null;
  completedAt: string | null;
  reminderTier: string | null;
  cadenceExpectedDow: number | null;
  cadenceLastCompletedPeriod: string | null;
  /** Parsed fields_json (well-known keys: clusterLabel, liveUrl, sourceRef) or null. */
  fields: Record<string, unknown> | null;
  createdByKind: string;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  noteCount: number;
  notes: WorkItemNoteSummary[];
}

export function collectWorkItems(): WorkItemSummary[] {
  try {
    if (!hasTable(getDb(), 'work_items')) return [];

    const groupNames = new Map(getAllAgentGroups().map((g) => [g.id, g.name]));
    const userNames = new Map(getAllUsers().map((u) => [u.id, u.display_name ?? u.id]));
    const cutoff = new Date(Date.now() - SNAPSHOT_TERMINAL_WINDOW_DAYS * 86_400_000).toISOString();

    const items = listAllWorkItems().filter(
      (i) => !isTerminalStatus(i.status) || (i.completed_at ?? i.updated_at) >= cutoff,
    );
    const titleById = new Map(items.map((i) => [i.id, i.title]));

    // One query for all notes (bounded per item in JS) instead of N queries.
    const noteRows = getDb()
      .prepare(
        `SELECT work_item_id, ts, author_kind, author_id, note
           FROM work_item_notes ORDER BY work_item_id, ts ASC, id ASC`,
      )
      .all() as Array<{
      work_item_id: string;
      ts: string;
      author_kind: string;
      author_id: string | null;
      note: string;
    }>;
    const notesByItem = new Map<string, WorkItemNoteSummary[]>();
    for (const n of noteRows) {
      let list = notesByItem.get(n.work_item_id);
      if (!list) {
        list = [];
        notesByItem.set(n.work_item_id, list);
      }
      list.push({
        ts: n.ts,
        authorKind: n.author_kind,
        authorId: n.author_id,
        authorName: n.author_id ? (groupNames.get(n.author_id) ?? userNames.get(n.author_id) ?? n.author_id) : null,
        note: n.note,
      });
    }

    return items.map((item) => {
      let assigneeKind: 'team' | 'human' | null = null;
      let assigneeName: string | null = null;
      if (item.assignee_agent_group_id) {
        assigneeKind = 'team';
        assigneeName = groupNames.get(item.assignee_agent_group_id) ?? item.assignee_agent_group_id;
      } else if (item.assignee_user_id) {
        assigneeKind = 'human';
        assigneeName = userNames.get(item.assignee_user_id) ?? item.assignee_user_id;
      } else if (item.assignee_label) {
        assigneeKind = 'human';
        assigneeName = item.assignee_label;
      }

      let fields: Record<string, unknown> | null = null;
      if (item.fields_json) {
        try {
          const parsed = JSON.parse(item.fields_json) as unknown;
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            fields = parsed as Record<string, unknown>;
          }
        } catch {
          // malformed fields_json — render nothing rather than crash the collect
        }
      }

      const allNotes = notesByItem.get(item.id) ?? [];
      return {
        id: item.id,
        ownerAgentGroupId: item.owner_agent_group_id,
        ownerName: groupNames.get(item.owner_agent_group_id) ?? item.owner_agent_group_id,
        assigneeAgentGroupId: item.assignee_agent_group_id,
        assigneeUserId: item.assignee_user_id,
        assigneeName,
        assigneeKind,
        parentId: item.parent_id,
        parentTitle: item.parent_id ? (titleById.get(item.parent_id) ?? null) : null,
        kind: item.kind,
        title: item.title,
        status: item.status,
        statusDetail: item.status_detail,
        dueAt: item.due_at,
        followUpAt: item.follow_up_at,
        completedAt: item.completed_at,
        reminderTier: item.reminder_tier,
        cadenceExpectedDow: item.cadence_expected_dow,
        cadenceLastCompletedPeriod: item.cadence_last_completed_period,
        fields,
        createdByKind: item.created_by_kind,
        createdById: item.created_by_id,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        noteCount: allNotes.length,
        notes: allNotes.slice(-SNAPSHOT_NOTES_PER_ITEM),
      };
    });
  } catch (err) {
    log.warn('collectWorkItems failed', { err: String(err) });
    return [];
  }
}
