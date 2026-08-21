/**
 * Dashboard work-item mutator tests — focused on the authorization edges the
 * pre-mortem called out (the target-team ACL on reassignment, owner-OR-
 * assignee access) plus audit rows and the wake-matrix dispatch.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { closeDb, createAgentGroup, initTestDb } from './db/index.js';
import { runMigrations } from './db/migrations/index.js';
import { getRecentAudit } from './db/dashboard-audit.js';
import { createUser } from './modules/permissions/db/users.js';
import { grantRole } from './modules/permissions/db/user-roles.js';
import { addMember } from './modules/permissions/db/agent-group-members.js';
import { createWorkItem as createWorkItemDb, generateWorkItemId, getWorkItem } from './db/work-items.js';
import { MutatorAuthError, MutatorValidationError, MutatorNotFoundError } from './dashboard-mutators.js';

vi.mock('./modules/work-items/wake.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./modules/work-items/wake.js')>();
  return { ...actual, refreshAndWake: vi.fn(async () => {}) };
});

import { refreshAndWake } from './modules/work-items/wake.js';
import {
  addWorkItemNote,
  cancelWorkItem,
  createWorkItem,
  reassignWorkItem,
  updateWorkItem,
} from './dashboard-work-items-mutators.js';

const TEAM_A = 'ag-team-a';
const TEAM_B = 'ag-team-b';
const OWNER_USER = 'discord:owner';
const MEMBER_A = 'discord:member-a';
const MEMBER_B = 'discord:member-b';
const OUTSIDER = 'discord:outsider';

function now() {
  return new Date().toISOString();
}

beforeEach(async () => {
  const db = await initTestDb();
  await runMigrations(db);
  vi.mocked(refreshAndWake).mockClear();

  for (const id of [TEAM_A, TEAM_B]) {
    await createAgentGroup({ id, name: id, folder: id, agent_provider: null, model: null, created_at: now() } as never);
  }
  createUser({ id: OWNER_USER, kind: 'discord', display_name: 'Owner', created_at: now() });
  grantRole({ user_id: OWNER_USER, role: 'owner', agent_group_id: null, granted_by: null, granted_at: now() });
  for (const [id, team] of [
    [MEMBER_A, TEAM_A],
    [MEMBER_B, TEAM_B],
  ] as const) {
    createUser({ id, kind: 'discord', display_name: id, created_at: now() });
    addMember({ user_id: id, agent_group_id: team, added_by: null, added_at: now() });
  }
  createUser({ id: OUTSIDER, kind: 'discord', display_name: 'Outsider', created_at: now() });
});

afterEach(async () => {
  await closeDb();
});

function seedItem(overrides: Record<string, unknown> = {}) {
  return createWorkItemDb({
    id: generateWorkItemId(),
    owner_agent_group_id: TEAM_A,
    title: 'seeded item',
    created_by_kind: 'agent',
    ...overrides,
  } as never);
}

describe('reassignWorkItem target-team ACL', () => {
  it('rejects reassignment to a team the actor cannot access', () => {
    const item = seedItem();
    expect(() => reassignWorkItem({ id: item.id, assigneeAgentGroupId: TEAM_B }, MEMBER_A)).toThrow(MutatorAuthError);
    expect(getWorkItem(item.id)?.assignee_agent_group_id).toBeNull();
  });

  it('allows an owner to reassign anywhere and fires the reassign wake', () => {
    const item = seedItem();
    const result = reassignWorkItem({ id: item.id, assigneeAgentGroupId: TEAM_B }, OWNER_USER);
    expect(result.item.assignee_agent_group_id).toBe(TEAM_B);
    expect(refreshAndWake).toHaveBeenCalledWith(
      expect.objectContaining({ mutation: 'reassign', previousAssigneeAgentGroupId: null }),
      expect.any(String),
    );
  });

  it('rejects actors with no relation to the item at all', () => {
    const item = seedItem();
    expect(() => reassignWorkItem({ id: item.id, assigneeAgentGroupId: TEAM_B }, OUTSIDER)).toThrow(MutatorAuthError);
  });

  it('rejects a team+human double assignment', () => {
    const item = seedItem();
    expect(() =>
      reassignWorkItem({ id: item.id, assigneeAgentGroupId: TEAM_B, assigneeUserId: OWNER_USER }, OWNER_USER),
    ).toThrow(MutatorValidationError);
  });
});

describe('owner-OR-assignee access on update', () => {
  it("lets the assignee team's member update a cross-team delegation (within the status gate)", () => {
    const item = seedItem({ assignee_agent_group_id: TEAM_B, kind: 'delegation', status: 'blocked' });
    const result = updateWorkItem({ id: item.id, status: 'open' }, MEMBER_B);
    expect(result.item.status).toBe('open');
  });

  it('still rejects unrelated members', () => {
    const item = seedItem({ assignee_agent_group_id: TEAM_B });
    expect(() => updateWorkItem({ id: item.id, status: 'cancelled' }, OUTSIDER)).toThrow(MutatorAuthError);
  });

  it('status → done stamps completed_at and dispatches a status_change wake (human-assigned)', () => {
    const item = seedItem({ assignee_user_id: OWNER_USER });
    const result = updateWorkItem({ id: item.id, status: 'done' }, OWNER_USER);
    expect(result.item.completed_at).toBeTruthy();
    expect(refreshAndWake).toHaveBeenCalledWith(
      expect.objectContaining({ mutation: 'status_change' }),
      expect.any(String),
    );
  });
});

describe('dashboard status-move gate', () => {
  it('agent-worked items (team assignee) reject in_progress/blocked/done from the dashboard', () => {
    const item = seedItem({ assignee_agent_group_id: TEAM_B });
    for (const status of ['in_progress', 'blocked', 'done'] as const) {
      expect(() => updateWorkItem({ id: item.id, status }, OWNER_USER)).toThrow(MutatorValidationError);
    }
  });

  it('unassigned items (owner-team agent is the worker) get the same restriction', () => {
    const item = seedItem();
    expect(() => updateWorkItem({ id: item.id, status: 'done' }, OWNER_USER)).toThrow(MutatorValidationError);
  });

  it('agent-worked items still accept re-open and cancel from the dashboard', () => {
    const item = seedItem({ assignee_agent_group_id: TEAM_B, status: 'blocked' });
    expect(updateWorkItem({ id: item.id, status: 'open' }, OWNER_USER).item.status).toBe('open');
    expect(updateWorkItem({ id: item.id, status: 'cancelled' }, OWNER_USER).item.status).toBe('cancelled');
  });

  it('human-assigned items (linked user or raw label) can move anywhere', () => {
    const linked = seedItem({ assignee_user_id: OWNER_USER });
    expect(updateWorkItem({ id: linked.id, status: 'in_progress' }, OWNER_USER).item.status).toBe('in_progress');
    const labelled = seedItem({ assignee_label: 'Raels' });
    expect(updateWorkItem({ id: labelled.id, status: 'done' }, OWNER_USER).item.status).toBe('done');
  });

  it('non-status edits on agent-worked items are unaffected', () => {
    const item = seedItem({ assignee_agent_group_id: TEAM_B });
    expect(updateWorkItem({ id: item.id, title: 'retitled' }, OWNER_USER).item.title).toBe('retitled');
  });
});

describe('createWorkItem', () => {
  it('applies the same target ACL to an initial assignee', () => {
    expect(() =>
      createWorkItem({ title: 'x', ownerAgentGroupId: TEAM_A, assigneeAgentGroupId: TEAM_B }, MEMBER_A),
    ).toThrow(MutatorAuthError);
  });

  it('creates with audit row and create wake', () => {
    const result = createWorkItem(
      { title: 'from dashboard', ownerAgentGroupId: TEAM_A, assigneeAgentGroupId: TEAM_B, note: 'context' },
      OWNER_USER,
    );
    expect(result.item.created_by_kind).toBe('dashboard_user');
    const audit = getRecentAudit(10);
    expect(audit.some((a) => a.action === 'work_item.create' && a.target_id === result.item.id)).toBe(true);
    expect(refreshAndWake).toHaveBeenCalledWith(expect.objectContaining({ mutation: 'create' }), expect.any(String));
  });

  it('rejects a missing owner team', () => {
    expect(() => createWorkItem({ title: 'x', ownerAgentGroupId: 'ag-nope' }, OWNER_USER)).toThrow(
      MutatorNotFoundError,
    );
  });
});

describe('cancel + notes', () => {
  it('cancel dispatches the cancel wake and audits', () => {
    const item = seedItem({ assignee_agent_group_id: TEAM_B });
    cancelWorkItem({ id: item.id }, OWNER_USER);
    expect(getWorkItem(item.id)?.status).toBe('cancelled');
    expect(refreshAndWake).toHaveBeenCalledWith(expect.objectContaining({ mutation: 'cancel' }), expect.any(String));
    expect(getRecentAudit(10).some((a) => a.action === 'work_item.cancel')).toBe(true);
  });

  it('double-cancel is rejected', () => {
    const item = seedItem();
    cancelWorkItem({ id: item.id }, OWNER_USER);
    expect(() => cancelWorkItem({ id: item.id }, OWNER_USER)).toThrow(MutatorValidationError);
  });

  it('addWorkItemNote requires text and dispatches a no-wake refresh', () => {
    const item = seedItem();
    expect(() => addWorkItemNote({ id: item.id, note: '  ' }, OWNER_USER)).toThrow(MutatorValidationError);
    addWorkItemNote({ id: item.id, note: 'hello' }, OWNER_USER);
    expect(refreshAndWake).toHaveBeenCalledWith(expect.objectContaining({ mutation: 'note' }), '');
  });
});
