import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { initTestDb, closeDb } from './connection.js';
import { runMigrations } from './migrations/index.js';
import { appendAudit, getRecentAudit } from './dashboard-audit.js';

beforeEach(() => {
  const db = initTestDb();
  runMigrations(db);
});

afterEach(() => {
  closeDb();
});

describe('dashboard_audit', () => {
  it('appends a row and returns it', () => {
    const row = appendAudit({
      actor_user_id: 'discord:abc',
      action: 'agent_group.rename',
      target_type: 'agent_group',
      target_id: 'group-1',
      before: { name: 'Old' },
      after: { name: 'New' },
    });
    expect(row.id).toBeGreaterThan(0);
    expect(row.actor_user_id).toBe('discord:abc');
    expect(row.action).toBe('agent_group.rename');
    expect(row.target_type).toBe('agent_group');
    expect(row.target_id).toBe('group-1');
    expect(JSON.parse(row.before_json!)).toEqual({ name: 'Old' });
    expect(JSON.parse(row.after_json!)).toEqual({ name: 'New' });
    expect(typeof row.ts).toBe('string');
  });

  it('serialises null before/after as NULL', () => {
    const row = appendAudit({
      actor_user_id: 'discord:abc',
      action: 'agent_group.create',
      target_type: 'agent_group',
      target_id: 'group-2',
      before: undefined,
      after: { name: 'Fresh' },
    });
    expect(row.before_json).toBeNull();
    expect(JSON.parse(row.after_json!)).toEqual({ name: 'Fresh' });
  });

  it('returns recent rows newest-first', () => {
    appendAudit({
      actor_user_id: 'u1',
      action: 'agent_group.rename',
      target_type: 'agent_group',
      target_id: 'g1',
      before: { name: 'A' },
      after: { name: 'B' },
    });
    appendAudit({
      actor_user_id: 'u1',
      action: 'agent_group.rename',
      target_type: 'agent_group',
      target_id: 'g1',
      before: { name: 'B' },
      after: { name: 'C' },
    });
    appendAudit({
      actor_user_id: 'u1',
      action: 'agent_group.rename',
      target_type: 'agent_group',
      target_id: 'g1',
      before: { name: 'C' },
      after: { name: 'D' },
    });

    const recent = getRecentAudit(2);
    expect(recent).toHaveLength(2);
    expect(JSON.parse(recent[0].after_json!)).toEqual({ name: 'D' });
    expect(JSON.parse(recent[1].after_json!)).toEqual({ name: 'C' });
  });
});
