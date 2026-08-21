/**
 * Tests for the work-item store — focused on the owner-OR-assignee
 * visibility predicate (the one piece of logic every other permission check
 * in the feature depends on), the derived completed_at transitions, and the
 * bounded projection filter (non-terminal + 14-day terminal window).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { initTestDb, closeDb, runMigrations, createAgentGroup } from './index.js';
import { getRawDb } from './sqlite-legacy.js';
import {
  createWorkItem,
  getWorkItem,
  updateWorkItem,
  listWorkItemsForTeam,
  listProjectionRowsForTeam,
  teamHasWorkItems,
  isVisibleToTeam,
  generateWorkItemId,
} from './work-items.js';
import { addWorkItemNote, listWorkItemNotes, countWorkItemNotes } from './work-item-notes.js';

const TEAM_A = 'ag-team-a';
const TEAM_B = 'ag-team-b';
const TEAM_C = 'ag-team-c';

beforeEach(async () => {
  const db = await initTestDb();
  await runMigrations(db);
  for (const id of [TEAM_A, TEAM_B, TEAM_C]) {
    await createAgentGroup({ id, name: id, folder: id, agent_provider: null, created_at: new Date().toISOString() });
  }
});

afterEach(async () => {
  await closeDb();
});

function makeItem(overrides: Partial<Parameters<typeof createWorkItem>[0]> = {}) {
  return createWorkItem({
    id: generateWorkItemId(),
    owner_agent_group_id: TEAM_A,
    title: 'test item',
    created_by_kind: 'agent',
    ...overrides,
  });
}

describe('owner-OR-assignee visibility predicate', () => {
  it('owner-only item is visible to owner, invisible to others', () => {
    const item = makeItem();
    expect(listWorkItemsForTeam(TEAM_A).map((i) => i.id)).toContain(item.id);
    expect(listWorkItemsForTeam(TEAM_B)).toHaveLength(0);
    expect(isVisibleToTeam(item, TEAM_A)).toBe(true);
    expect(isVisibleToTeam(item, TEAM_B)).toBe(false);
  });

  it('assignee-only relation makes a cross-team delegation visible to the assignee', () => {
    const item = makeItem({ assignee_agent_group_id: TEAM_B, kind: 'delegation' });
    expect(listWorkItemsForTeam(TEAM_B).map((i) => i.id)).toContain(item.id);
    expect(isVisibleToTeam(item, TEAM_B)).toBe(true);
  });

  it('neither owner nor assignee sees nothing', () => {
    const item = makeItem({ assignee_agent_group_id: TEAM_B });
    expect(listWorkItemsForTeam(TEAM_C)).toHaveLength(0);
    expect(isVisibleToTeam(item, TEAM_C)).toBe(false);
  });

  it('owner==assignee (both) returns the item exactly once', () => {
    const item = makeItem({ assignee_agent_group_id: TEAM_A });
    const rows = listWorkItemsForTeam(TEAM_A).filter((i) => i.id === item.id);
    expect(rows).toHaveLength(1);
  });

  it('teamHasWorkItems tracks the same predicate', () => {
    expect(teamHasWorkItems(TEAM_B)).toBe(false);
    makeItem({ assignee_agent_group_id: TEAM_B });
    expect(teamHasWorkItems(TEAM_B)).toBe(true);
    expect(teamHasWorkItems(TEAM_C)).toBe(false);
  });
});

describe('completed_at transitions', () => {
  it('is set when status transitions to done, never client-supplied', () => {
    const item = makeItem();
    expect(item.completed_at).toBeNull();
    updateWorkItem(item.id, { status: 'done' });
    const after = getWorkItem(item.id);
    expect(after?.completed_at).toBeTruthy();
  });

  it('is cleared when a done item is reopened', () => {
    const item = makeItem();
    updateWorkItem(item.id, { status: 'done' });
    updateWorkItem(item.id, { status: 'in_progress' });
    expect(getWorkItem(item.id)?.completed_at).toBeNull();
  });

  it('cancel does not stamp completed_at', () => {
    const item = makeItem();
    updateWorkItem(item.id, { status: 'cancelled' });
    expect(getWorkItem(item.id)?.completed_at).toBeNull();
  });

  it('returns 0 for a missing item and stamps updated_at on real updates', () => {
    expect(updateWorkItem('wi-nope', { title: 'x' })).toBe(0);
    const item = makeItem();
    expect(updateWorkItem(item.id, { title: 'renamed' })).toBe(1);
    expect(getWorkItem(item.id)?.title).toBe('renamed');
  });
});

describe('projection filter (non-terminal + 14-day terminal window)', () => {
  it('carries non-terminal items regardless of age', () => {
    const item = makeItem({ status: 'blocked' });
    getRawDb()
      .prepare('UPDATE work_items SET created_at = ?, updated_at = ? WHERE id = ?')
      .run('2020-01-01T00:00:00.000Z', '2020-01-01T00:00:00.000Z', item.id);
    expect(listProjectionRowsForTeam(TEAM_A).map((i) => i.id)).toContain(item.id);
  });

  it('carries recently-completed items but drops old ones', () => {
    const recent = makeItem();
    updateWorkItem(recent.id, { status: 'done' });

    const old = makeItem();
    updateWorkItem(old.id, { status: 'done' });
    const staleTs = new Date(Date.now() - 30 * 86_400_000).toISOString();
    getRawDb()
      .prepare('UPDATE work_items SET completed_at = ?, updated_at = ? WHERE id = ?')
      .run(staleTs, staleTs, old.id);

    const ids = listProjectionRowsForTeam(TEAM_A).map((i) => i.id);
    expect(ids).toContain(recent.id);
    expect(ids).not.toContain(old.id);
  });

  it('uses updated_at for cancelled items (which never get completed_at)', () => {
    const item = makeItem();
    updateWorkItem(item.id, { status: 'cancelled' });
    expect(listProjectionRowsForTeam(TEAM_A).map((i) => i.id)).toContain(item.id);

    const staleTs = new Date(Date.now() - 30 * 86_400_000).toISOString();
    getRawDb().prepare('UPDATE work_items SET updated_at = ? WHERE id = ?').run(staleTs, item.id);
    expect(listProjectionRowsForTeam(TEAM_A).map((i) => i.id)).not.toContain(item.id);
  });
});

describe('work item notes', () => {
  it('appends and lists notes chronologically with a newest-N cap', () => {
    const item = makeItem();
    addWorkItemNote({ work_item_id: item.id, author_kind: 'agent', author_id: TEAM_A, note: 'first' });
    addWorkItemNote({ work_item_id: item.id, author_kind: 'dashboard_user', author_id: 'phone:+1', note: 'second' });
    const notes = listWorkItemNotes(item.id);
    expect(notes.map((n) => n.note)).toEqual(['first', 'second']);
    expect(countWorkItemNotes(item.id)).toBe(2);
    expect(listWorkItemNotes(item.id, 1).map((n) => n.note)).toEqual(['second']);
  });
});
