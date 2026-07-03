/**
 * Wake-matrix tests — one case per row of the matrix in wake.ts, plus the
 * actor-suppression and agent-initiated status-change rules. Pure decision
 * function, no DB.
 */
import { describe, it, expect } from 'vitest';

import { decideWakeTargets, affectedTeams } from './wake.js';

const A = 'ag-a';
const B = 'ag-b';

function item(owner: string, assignee: string | null) {
  return { owner_agent_group_id: owner, assignee_agent_group_id: assignee };
}

describe('wake matrix', () => {
  it('create with assignee team B wakes B', () => {
    expect(decideWakeTargets({ mutation: 'create', item: item(A, B), actorAgentGroupId: A })).toEqual([B]);
  });

  it('create with no assignee (self-tracked) wakes nobody', () => {
    expect(decideWakeTargets({ mutation: 'create', item: item(A, null), actorAgentGroupId: A })).toEqual([]);
  });

  it('create assigned to self is suppressed (actor never woken about its own change)', () => {
    expect(decideWakeTargets({ mutation: 'create', item: item(A, A), actorAgentGroupId: A })).toEqual([]);
  });

  it('reassign A → B wakes both old and new assignee', () => {
    const targets = decideWakeTargets({
      mutation: 'reassign',
      item: item('ag-owner', B),
      previousAssigneeAgentGroupId: A,
    });
    expect(new Set(targets)).toEqual(new Set([A, B]));
  });

  it('reassign from unassigned wakes only the new assignee', () => {
    expect(decideWakeTargets({ mutation: 'reassign', item: item(A, B), previousAssigneeAgentGroupId: null })).toEqual([
      B,
    ]);
  });

  it('dashboard cancel wakes current assignee', () => {
    expect(decideWakeTargets({ mutation: 'cancel', item: item(A, B) })).toEqual([B]);
  });

  it('dashboard cancel with no assignee wakes owner', () => {
    expect(decideWakeTargets({ mutation: 'cancel', item: item(A, null) })).toEqual([A]);
  });

  it('dashboard status/due change wakes assignee if set, else owner', () => {
    expect(decideWakeTargets({ mutation: 'status_change', item: item(A, B) })).toEqual([B]);
    expect(decideWakeTargets({ mutation: 'status_change', item: item(A, null) })).toEqual([A]);
  });

  it('agent-initiated status change wakes the other side (assignee completes → owner hears)', () => {
    const targets = decideWakeTargets({ mutation: 'status_change', item: item(A, B), actorAgentGroupId: B });
    expect(targets).toEqual([A]);
  });

  it('agent-initiated status change by owner wakes assignee', () => {
    const targets = decideWakeTargets({ mutation: 'status_change', item: item(A, B), actorAgentGroupId: A });
    expect(targets).toEqual([B]);
  });

  it('self-tracked agent-initiated status change wakes nobody', () => {
    expect(decideWakeTargets({ mutation: 'status_change', item: item(A, null), actorAgentGroupId: A })).toEqual([]);
    expect(decideWakeTargets({ mutation: 'status_change', item: item(A, A), actorAgentGroupId: A })).toEqual([]);
  });

  it('note wakes nobody', () => {
    expect(decideWakeTargets({ mutation: 'note', item: item(A, B) })).toEqual([]);
  });
});

describe('affectedTeams (projection refresh set)', () => {
  it('covers owner, new assignee, and previous assignee exactly once', () => {
    const teams = affectedTeams({
      mutation: 'reassign',
      item: item(A, B),
      previousAssigneeAgentGroupId: A,
    });
    expect(new Set(teams)).toEqual(new Set([A, B]));
  });

  it('owner-only item refreshes just the owner', () => {
    expect(affectedTeams({ mutation: 'create', item: item(A, null) })).toEqual([A]);
  });
});
