/**
 * Work-items module — the canonical cross-team work-item store.
 *
 * Registers four delivery action handlers: create_work_item,
 * update_work_item, add_work_item_note, complete_work_item. The container's
 * work-item MCP tools (container/agent-runner/src/mcp-tools/work-items.ts)
 * write system messages with these actions; the host applies them to the
 * central `work_items` table here.
 *
 * Host integration points (filled by MODULE-HOOK markers):
 *   - `src/host-sweep.ts` → MODULE-HOOK:work-items-sweep runs
 *     `sweepWorkItems` each tick (delegation follow-ups, deliverable tier
 *     cascade, cadence RAG) — a central-DB scan once per tick, not per
 *     session.
 *   - `src/container-runner.ts` → spawn-hook projection refresh (guarded by
 *     teamHasWorkItems) next to writeDestinations/writeSessionRouting.
 *
 * Central-DB migration 103 owns the two tables (work_items,
 * work_item_notes); the per-session `work_items_cache` projection is created
 * lazily by session-manager's openInboundDb.
 */
import { registerDeliveryAction } from '../../delivery.js';
import { unguarded } from '../../guard/index.js';
import {
  handleAddWorkItemNote,
  handleCompleteWorkItem,
  handleCreateWorkItem,
  handleUpdateWorkItem,
} from './actions.js';

const WORK_ITEM_UNGUARDED = unguarded(
  'team-scoped work-item CRUD — handlers write only rows owned by or assigned to the calling session’s agent group, and cross-team assignment is gated by agent_destinations',
);

registerDeliveryAction('create_work_item', handleCreateWorkItem, WORK_ITEM_UNGUARDED);
registerDeliveryAction('update_work_item', handleUpdateWorkItem, WORK_ITEM_UNGUARDED);
registerDeliveryAction('add_work_item_note', handleAddWorkItemNote, WORK_ITEM_UNGUARDED);
registerDeliveryAction('complete_work_item', handleCompleteWorkItem, WORK_ITEM_UNGUARDED);
