/**
 * Work-item MCP tools: create_work_item, update_work_item, complete_work_item,
 * add_work_item_note, list_work_items.
 *
 * With the two-DB split, the container cannot write the central DB where
 * work_items lives. Mutations are sent as system actions via messages_out —
 * the host applies them on delivery (src/modules/work-items/actions.ts).
 * Reads go through the local `work_items_cache` projection in inbound.db,
 * which the host rewrites on every container wake and after any mutation
 * touching this team.
 *
 * Team assignment is resolved against the local destinations map (you can
 * only delegate to a team you can already message); the host re-validates
 * against the central ACL on delivery — this side is convenience, not the
 * security boundary.
 */
import { getInboundDb } from '../db/connection.js';
import { writeMessageOut } from '../db/messages-out.js';
import { findByName } from '../destinations.js';
import { registerTools } from './server.js';
import type { McpToolDefinition } from './types.js';

function log(msg: string): void {
  console.error(`[mcp-tools] ${msg}`);
}

function generateId(): string {
  return `wi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function sysId(): string {
  return `sys-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function ok(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

function err(text: string) {
  return { content: [{ type: 'text' as const, text: `Error: ${text}` }], isError: true };
}

const STATUSES = ['open', 'in_progress', 'blocked', 'done', 'cancelled'];
const KINDS = ['task', 'delegation', 'deliverable', 'content_slot', 'cadence'];

/** Resolve an `assignee_team` destination name to its agent group id. */
function resolveTeamDestination(name: string): { agentGroupId: string; label: string } | { error: string } {
  const dest = findByName(name);
  if (!dest) {
    return { error: `no destination named "${name}" — you can only assign work to teams you can already message. Check your destinations list.` };
  }
  if (dest.type !== 'agent' || !dest.agentGroupId) {
    return { error: `destination "${name}" is a channel, not a team — work items can only be assigned to teams (or humans via assignee_name).` };
  }
  return { agentGroupId: dest.agentGroupId, label: dest.displayName };
}

interface CacheRow {
  id: string;
  relation: string;
  owner_name: string | null;
  owner_agent_group_id: string;
  assignee_name: string | null;
  assignee_kind: string | null;
  parent_id: string | null;
  parent_title: string | null;
  kind: string;
  title: string;
  status: string;
  status_detail: string | null;
  due_at: string | null;
  follow_up_at: string | null;
  completed_at: string | null;
  cadence_last_completed_period: string | null;
  updated_at: string | null;
  refreshed_at: string;
}

function hasCacheTable(): boolean {
  const row = getInboundDb()
    .prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name='work_items_cache' LIMIT 1`)
    .get();
  return row != null;
}

export const createWorkItem: McpToolDefinition = {
  tool: {
    name: 'create_work_item',
    description:
      'Track a unit of work in the canonical work-item store (visible on the operator dashboard). Use for multi-step work, delegations to other teams, deadlines, and owner-blocked deliverables — instead of a hand-rolled file. Assigning to a team wakes that team. Returns the new item id immediately; the write is applied asynchronously.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Short imperative title (what must happen)' },
        kind: {
          type: 'string',
          description:
            'task (default) | delegation (work you handed to another team) | deliverable (owner-blocked, has a due date — the host nags a 14/7/3-day cascade) | content_slot (calendar parent for child delegations) | cadence (recurring weekly obligation)',
        },
        status: { type: 'string', description: `Initial status: ${STATUSES.join(' | ')} (default open)` },
        status_detail: { type: 'string', description: 'Free-text team-specific status shade (display-only)' },
        assignee_team: {
          type: 'string',
          description: 'Destination name of the team doing the work (from your destinations list). Omit if self-tracked.',
        },
        assignee_name: {
          type: 'string',
          description:
            'Human assignee display name (e.g. an owner). Best-effort match against known users — the system will tell you whether it linked to a real user or stored a raw label.',
        },
        due_at: { type: 'string', description: 'Due date — YYYY-MM-DD (team timezone) or full ISO timestamp' },
        follow_up_at: {
          type: 'string',
          description: 'When the host should nag you if the item is still open (ISO timestamp). Use for delegations.',
        },
        parent_id: { type: 'string', description: 'Parent work item id (e.g. the content_slot this delegation builds)' },
        note: { type: 'string', description: 'Initial note (context, links, acceptance criteria)' },
        cadence_expected_dow: {
          type: 'number',
          description: 'kind=cadence only: ISO weekday (1=Mon..7=Sun) by which the weekly stream must be done',
        },
        fields: {
          type: 'object',
          description: 'Optional structured extras. Well-known keys: clusterLabel, liveUrl, sourceRef.',
        },
      },
      required: ['title'],
    },
  },
  async handler(args) {
    const title = ((args.title as string) || '').trim();
    if (!title) return err('title is required');
    if (args.kind && !KINDS.includes(args.kind as string)) return err(`invalid kind — expected ${KINDS.join(' | ')}`);
    if (args.status && !STATUSES.includes(args.status as string)) {
      return err(`invalid status — expected ${STATUSES.join(' | ')}`);
    }

    let assigneeAgentGroupId: string | null = null;
    let assigneeTeamLabel: string | null = null;
    if (typeof args.assignee_team === 'string' && args.assignee_team.trim()) {
      const resolved = resolveTeamDestination(args.assignee_team.trim());
      if ('error' in resolved) return err(resolved.error);
      assigneeAgentGroupId = resolved.agentGroupId;
      assigneeTeamLabel = resolved.label;
    }

    const id = generateId();
    writeMessageOut({
      id: sysId(),
      kind: 'system',
      content: JSON.stringify({
        action: 'create_work_item',
        itemId: id,
        title,
        kind: (args.kind as string) || 'task',
        status: (args.status as string) || 'open',
        statusDetail: (args.status_detail as string) || null,
        assigneeAgentGroupId,
        assigneeName: (args.assignee_name as string) || null,
        dueAt: (args.due_at as string) || null,
        followUpAt: (args.follow_up_at as string) || null,
        parentId: (args.parent_id as string) || null,
        note: (args.note as string) || null,
        cadenceExpectedDow: typeof args.cadence_expected_dow === 'number' ? args.cadence_expected_dow : null,
        fields: args.fields && typeof args.fields === 'object' ? args.fields : null,
      }),
    });

    log(`create_work_item: ${id} "${title}"`);
    const bits = [`Work item created (id: ${id})`];
    if (assigneeTeamLabel) bits.push(`assigned to team ${assigneeTeamLabel} (they will be woken)`);
    if (args.assignee_name) bits.push('human-assignee resolution will be confirmed by a system message');
    return ok(bits.join(' — ') + '. It will appear in list_work_items after the next refresh.');
  },
};

export const updateWorkItem: McpToolDefinition = {
  tool: {
    name: 'update_work_item',
    description:
      'Update a work item (status moves, reassignment, due dates, title, structured fields). Any field omitted is left unchanged. Reassigning wakes both the old and new assignee teams.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Work item id (from list_work_items or create_work_item)' },
        title: { type: 'string' },
        status: { type: 'string', description: STATUSES.join(' | ') },
        status_detail: { type: 'string', description: 'Free-text status shade. Pass empty string to clear.' },
        assignee_team: { type: 'string', description: 'Reassign to this team destination name' },
        assignee_name: { type: 'string', description: 'Reassign to this human (display name, best-effort match)' },
        clear_assignee: { type: 'boolean', description: 'true = make the item self-tracked (no assignee)' },
        due_at: { type: 'string', description: 'YYYY-MM-DD or ISO. Empty string clears.' },
        follow_up_at: { type: 'string', description: 'ISO timestamp for the next follow-up nag. Empty string clears.' },
        parent_id: { type: 'string', description: 'New parent id. Empty string clears.' },
        fields: { type: 'object', description: 'Replaces the structured extras object' },
      },
      required: ['id'],
    },
  },
  async handler(args) {
    const id = args.id as string;
    if (!id) return err('id is required');
    if (args.status && !STATUSES.includes(args.status as string)) {
      return err(`invalid status — expected ${STATUSES.join(' | ')}`);
    }

    let assigneeAgentGroupId: string | undefined;
    if (typeof args.assignee_team === 'string' && args.assignee_team.trim()) {
      const resolved = resolveTeamDestination(args.assignee_team.trim());
      if ('error' in resolved) return err(resolved.error);
      assigneeAgentGroupId = resolved.agentGroupId;
    }

    const payload: Record<string, unknown> = { action: 'update_work_item', itemId: id };
    if (typeof args.title === 'string') payload.title = args.title;
    if (typeof args.status === 'string') payload.status = args.status;
    if (typeof args.status_detail === 'string') payload.statusDetail = args.status_detail;
    if (typeof args.due_at === 'string') payload.dueAt = args.due_at;
    if (typeof args.follow_up_at === 'string') payload.followUpAt = args.follow_up_at;
    if (typeof args.parent_id === 'string') payload.parentId = args.parent_id;
    if (args.fields && typeof args.fields === 'object') payload.fields = args.fields;
    if (args.clear_assignee === true) payload.clearAssignee = true;
    if (assigneeAgentGroupId !== undefined) payload.assigneeAgentGroupId = assigneeAgentGroupId;
    if (typeof args.assignee_name === 'string' && args.assignee_name.trim()) payload.assigneeName = args.assignee_name;

    if (Object.keys(payload).length === 2) return err('at least one field to update is required');

    writeMessageOut({ id: sysId(), kind: 'system', content: JSON.stringify(payload) });
    log(`update_work_item: ${id}`);
    return ok(`Work item update requested: ${id}. Failures (unknown id, bad assignee) come back as system messages.`);
  },
};

export const completeWorkItem: McpToolDefinition = {
  tool: {
    name: 'complete_work_item',
    description:
      'Mark a work item done (stamps the delivered date). For kind=cadence items this stamps the current week as completed instead of closing the item. Completing a delegation notifies the owning team.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Work item id' },
        note: { type: 'string', description: 'Optional completion note (what shipped, where)' },
      },
      required: ['id'],
    },
  },
  async handler(args) {
    const id = args.id as string;
    if (!id) return err('id is required');
    writeMessageOut({
      id: sysId(),
      kind: 'system',
      content: JSON.stringify({ action: 'complete_work_item', itemId: id, note: (args.note as string) || null }),
    });
    log(`complete_work_item: ${id}`);
    return ok(`Work item completion requested: ${id}.`);
  },
};

export const addWorkItemNote: McpToolDefinition = {
  tool: {
    name: 'add_work_item_note',
    description:
      'Append a timestamped note to a work item — your running narrative (progress, blockers, links, handoff context). Notes are visible on the dashboard; they wake nobody.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Work item id' },
        note: { type: 'string', description: 'Note text (markdown ok)' },
      },
      required: ['id', 'note'],
    },
  },
  async handler(args) {
    const id = args.id as string;
    const note = ((args.note as string) || '').trim();
    if (!id) return err('id is required');
    if (!note) return err('note is required');
    writeMessageOut({
      id: sysId(),
      kind: 'system',
      content: JSON.stringify({ action: 'add_work_item_note', itemId: id, note }),
    });
    log(`add_work_item_note: ${id}`);
    return ok(`Note added to ${id}.`);
  },
};

export const listWorkItems: McpToolDefinition = {
  tool: {
    name: 'list_work_items',
    description:
      "List your team's work items (items you own OR items assigned to you), from the local projection the host refreshes on wake and after every mutation. Includes open/in_progress/blocked items plus the last 14 days of done/cancelled.",
    inputSchema: {
      type: 'object' as const,
      properties: {
        scope: {
          type: 'string',
          description: 'all (default) | owned (items on your board) | assigned (items other teams delegated to you)',
        },
        status: { type: 'string', description: `Filter by status: ${STATUSES.join(' | ')}` },
        kind: { type: 'string', description: `Filter by kind: ${KINDS.join(' | ')}` },
      },
    },
  },
  async handler(args) {
    if (!hasCacheTable()) {
      return ok('No work items tracked yet (create one with create_work_item).');
    }
    let rows: CacheRow[];
    try {
      rows = getInboundDb()
        .prepare('SELECT * FROM work_items_cache ORDER BY CASE WHEN due_at IS NULL THEN 1 ELSE 0 END, due_at ASC, created_at DESC')
        .all() as CacheRow[];
    } catch (e) {
      return err(`could not read work_items_cache: ${e instanceof Error ? e.message : String(e)}`);
    }

    const scope = (args.scope as string) || 'all';
    if (scope === 'owned') rows = rows.filter((r) => r.relation === 'owner' || r.relation === 'both');
    if (scope === 'assigned') rows = rows.filter((r) => r.relation === 'assignee' || r.relation === 'both');
    if (typeof args.status === 'string' && args.status) rows = rows.filter((r) => r.status === args.status);
    if (typeof args.kind === 'string' && args.kind) rows = rows.filter((r) => r.kind === args.kind);

    if (rows.length === 0) return ok('No work items match.');

    const lines = rows.map((r) => {
      const bits = [`- ${r.id} [${r.status}${r.status_detail ? `/${r.status_detail}` : ''}] (${r.kind}) ${r.title}`];
      if (r.relation === 'assignee') bits.push(`  from=${r.owner_name ?? r.owner_agent_group_id}`);
      if (r.assignee_name) bits.push(`  assignee=${r.assignee_name}${r.assignee_kind === 'human' ? ' (human)' : ''}`);
      if (r.due_at) bits.push(`  due=${r.due_at}`);
      if (r.follow_up_at) bits.push(`  follow_up=${r.follow_up_at}`);
      if (r.parent_id) bits.push(`  parent=${r.parent_title ?? r.parent_id}`);
      if (r.kind === 'cadence') bits.push(`  last_completed=${r.cadence_last_completed_period ?? 'never'}`);
      return bits.join('');
    });
    const refreshed = rows[0]?.refreshed_at;
    return ok(`${lines.join('\n')}\n(${rows.length} item${rows.length === 1 ? '' : 's'}; projection refreshed ${refreshed})`);
  },
};

registerTools([createWorkItem, updateWorkItem, completeWorkItem, addWorkItemNote, listWorkItems]);
