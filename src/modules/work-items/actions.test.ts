/**
 * Assignee-name resolution echo tests (plan Phase 0 verify): a human
 * assignee name must resolve to a real user ONLY on a unique display-name
 * match, and the echo text must state explicitly when it fell back to a raw
 * label — a typo'd name must never be silently swallowed.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { initTestDb, closeDb } from '../../db/index.js';
import { runMigrations } from '../../db/migrations/index.js';
import { createUser } from '../permissions/db/users.js';
import { resolveAssigneeName } from './actions.js';

beforeEach(() => {
  const db = initTestDb();
  runMigrations(db);
});

afterEach(() => {
  closeDb();
});

function seedUser(id: string, displayName: string | null) {
  createUser({ id, kind: 'phone', display_name: displayName, created_at: new Date().toISOString() });
}

describe('resolveAssigneeName', () => {
  it('links on a unique case-insensitive display-name match and says so', () => {
    seedUser('phone:+615550001', 'Raels');
    const r = resolveAssigneeName('raels');
    expect(r.userId).toBe('phone:+615550001');
    expect(r.label).toBeNull();
    expect(r.echo).toContain('resolved to user phone:+615550001');
  });

  it('falls back to a raw label on no match — and the echo states it', () => {
    const r = resolveAssigneeName('Realz');
    expect(r.userId).toBeNull();
    expect(r.label).toBe('Realz');
    expect(r.echo).toContain('did not match any known user');
    expect(r.echo).toContain('raw label');
  });

  it('falls back on an ambiguous match rather than guessing', () => {
    seedUser('phone:+615550001', 'Adam');
    seedUser('discord:12345', 'Adam');
    const r = resolveAssigneeName('Adam');
    expect(r.userId).toBeNull();
    expect(r.label).toBe('Adam');
    expect(r.echo).toContain('ambiguous');
  });
});
