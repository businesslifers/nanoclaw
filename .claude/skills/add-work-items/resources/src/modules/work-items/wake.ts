/**
 * Wake-on-mutation for work items.
 *
 * One matrix, applied identically whether the mutation came from the
 * dashboard mutators or the agent-side delivery-action handlers:
 *
 *   | Mutation                              | Wakes                       |
 *   |---------------------------------------|-----------------------------|
 *   | Create, assignee = team B             | B                           |
 *   | Create, no assignee (self-tracked)    | nobody                      |
 *   | Reassign A → B                        | both A and B                |
 *   | Cancel                                | current assignee, else owner|
 *   | Status/due-date change                | assignee if set, else owner |
 *   | Note added                            | nobody (refresh only)       |
 *
 * Always refresh-then-wake, never the reverse — the woken agent must see a
 * projection that already reflects the change it's being woken about.
 *
 * The team that performed the mutation is never woken about its own change
 * (`actorAgentGroupId` suppression) — an agent that just called
 * create_work_item doesn't need a system message telling it so. Dashboard
 * mutations pass no actor group, so nothing is suppressed there.
 *
 * Known v1 limitation (deliberate, not silently assumed): the session lookup
 * wakes the most-recently-created ACTIVE session for an agent group. A team
 * running per-thread session mode with several concurrent sessions would only
 * wake one of them. None of the 6 current lead teams run that mode for their
 * lead session — whoever adds the first one that does needs to revisit this.
 */
import { findSessionByAgentGroup } from '../../db/sessions.js';
import type { WorkItem } from '../../db/work-items.js';
import { log } from '../../log.js';
import { notifyAgent } from '../approvals/primitive.js';
import { refreshWorkItemsProjection } from './projection.js';

export type WorkItemMutationKind = 'create' | 'status_change' | 'reassign' | 'cancel' | 'note';

export interface WakeDecisionInput {
  mutation: WorkItemMutationKind;
  /** Item state after the mutation. */
  item: Pick<WorkItem, 'owner_agent_group_id' | 'assignee_agent_group_id'>;
  /** Assignee team before the mutation (reassign case). */
  previousAssigneeAgentGroupId?: string | null;
  /** Team that performed the mutation (agent-side); never woken about its own change. */
  actorAgentGroupId?: string | null;
}

/** Pure wake-matrix decision — unit-tested one case per matrix row. */
export function decideWakeTargets(input: WakeDecisionInput): string[] {
  const { mutation, item, previousAssigneeAgentGroupId, actorAgentGroupId } = input;
  const targets = new Set<string>();

  switch (mutation) {
    case 'create':
      if (item.assignee_agent_group_id) targets.add(item.assignee_agent_group_id);
      break;
    case 'reassign':
      if (previousAssigneeAgentGroupId) targets.add(previousAssigneeAgentGroupId);
      if (item.assignee_agent_group_id) targets.add(item.assignee_agent_group_id);
      break;
    case 'cancel':
    case 'status_change':
      if (actorAgentGroupId) {
        // Agent-initiated: wake the OTHER side of the relationship. The
        // dashboard-perspective "assignee else owner" rule would suppress to
        // nobody when the assignee completes its own delegation — the owner
        // must hear that its delegation closed.
        targets.add(item.owner_agent_group_id);
        if (item.assignee_agent_group_id) targets.add(item.assignee_agent_group_id);
      } else {
        // Dashboard-initiated: assignee if set, else owner (plan matrix).
        targets.add(item.assignee_agent_group_id ?? item.owner_agent_group_id);
      }
      break;
    case 'note':
      break;
  }

  if (actorAgentGroupId) targets.delete(actorAgentGroupId);
  return [...targets];
}

/** Teams whose session projections must be rewritten for this mutation. */
export function affectedTeams(input: WakeDecisionInput): string[] {
  const teams = new Set<string>([input.item.owner_agent_group_id]);
  if (input.item.assignee_agent_group_id) teams.add(input.item.assignee_agent_group_id);
  if (input.previousAssigneeAgentGroupId) teams.add(input.previousAssigneeAgentGroupId);
  return [...teams];
}

/**
 * Refresh projections for every affected team, then wake the matrix targets
 * with `message`. If a target team has no active session, the wake is
 * skipped — the change surfaces on that team's next natural spawn (the
 * spawn-hook projection refresh covers it: a team receiving its first work
 * item now has ≥1 row, so the has-items guard no longer skips it).
 */
export function refreshAndWake(input: WakeDecisionInput, message: string): void {
  for (const team of affectedTeams(input)) {
    refreshWorkItemsProjection(team);
  }
  for (const team of decideWakeTargets(input)) {
    const session = findSessionByAgentGroup(team);
    if (!session) {
      log.debug('work-items wake skipped — no active session', { team });
      continue;
    }
    notifyAgent(session, message);
  }
}
