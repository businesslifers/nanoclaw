import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { closeDb, createAgentGroup, getAgentGroup, initTestDb } from './db/index.js';
import { runMigrations } from './db/migrations/index.js';
import { getRecentAudit } from './db/dashboard-audit.js';
import { createUser } from './modules/permissions/db/users.js';
import { grantRole } from './modules/permissions/db/user-roles.js';
import {
  MutatorAuthError,
  MutatorConflictError,
  MutatorNotFoundError,
  MutatorValidationError,
  renameAgentGroup,
  resolveDashboardActor,
} from './dashboard-mutators.js';

vi.mock('./dashboard-pusher.js', () => ({ nudgePusher: vi.fn() }));

import { nudgePusher } from './dashboard-pusher.js';

function now() {
  return new Date().toISOString();
}

function seedAgentGroup(id: string, name: string) {
  createAgentGroup({ id, name, folder: id, agent_provider: null, created_at: now() });
}

function seedUserWithRole(userId: string, role: 'owner' | 'admin', scope: string | null) {
  createUser({ id: userId, kind: 'discord', display_name: null, created_at: now() });
  grantRole({ user_id: userId, role, agent_group_id: scope, granted_by: null, granted_at: now() });
}

beforeEach(() => {
  initTestDb();
  runMigrations(initTestDb()); // idempotent — table already there from initTestDb but migrations need to run on it
  // initTestDb returns a fresh DB; rerun to ensure migrations applied.
  vi.mocked(nudgePusher).mockClear();
});

// initTestDb is idempotent; the second call in beforeEach above just hands back
// the same handle. Migrations run against it once and don't repeat.

afterEach(() => {
  closeDb();
});

describe('renameAgentGroup', () => {
  it('renames when actor is owner', () => {
    seedAgentGroup('ag-1', 'Old');
    seedUserWithRole('u-owner', 'owner', null);

    const result = renameAgentGroup({ id: 'ag-1', name: 'New' }, 'u-owner');
    expect(result).toEqual({ id: 'ag-1', name: 'New' });
    expect(getAgentGroup('ag-1')!.name).toBe('New');
    expect(nudgePusher).toHaveBeenCalledTimes(1);

    const audit = getRecentAudit(10);
    expect(audit).toHaveLength(1);
    expect(audit[0].action).toBe('agent_group.rename');
    expect(audit[0].actor_user_id).toBe('u-owner');
    expect(audit[0].target_id).toBe('ag-1');
    expect(JSON.parse(audit[0].before_json!)).toEqual({ name: 'Old' });
    expect(JSON.parse(audit[0].after_json!)).toEqual({ name: 'New' });
  });

  it('renames when actor is global admin', () => {
    seedAgentGroup('ag-1', 'Old');
    seedUserWithRole('u-ga', 'admin', null);
    expect(() => renameAgentGroup({ id: 'ag-1', name: 'New' }, 'u-ga')).not.toThrow();
    expect(getAgentGroup('ag-1')!.name).toBe('New');
  });

  it('renames when actor is scoped admin of this group', () => {
    seedAgentGroup('ag-1', 'Old');
    seedUserWithRole('u-sa', 'admin', 'ag-1');
    expect(() => renameAgentGroup({ id: 'ag-1', name: 'New' }, 'u-sa')).not.toThrow();
  });

  it('rejects scoped admin of a DIFFERENT group', () => {
    seedAgentGroup('ag-1', 'Old');
    seedAgentGroup('ag-2', 'Other');
    seedUserWithRole('u-sa-other', 'admin', 'ag-2');
    expect(() => renameAgentGroup({ id: 'ag-1', name: 'New' }, 'u-sa-other')).toThrow(MutatorAuthError);
  });

  it('rejects unknown actor', () => {
    seedAgentGroup('ag-1', 'Old');
    expect(() => renameAgentGroup({ id: 'ag-1', name: 'New' }, 'nobody')).toThrow(MutatorAuthError);
  });

  it('rejects empty name', () => {
    seedAgentGroup('ag-1', 'Old');
    seedUserWithRole('u-owner', 'owner', null);
    expect(() => renameAgentGroup({ id: 'ag-1', name: '' }, 'u-owner')).toThrow(MutatorValidationError);
    expect(() => renameAgentGroup({ id: 'ag-1', name: '   ' }, 'u-owner')).toThrow(MutatorValidationError);
  });

  it('rejects name longer than 80 chars', () => {
    seedAgentGroup('ag-1', 'Old');
    seedUserWithRole('u-owner', 'owner', null);
    expect(() => renameAgentGroup({ id: 'ag-1', name: 'x'.repeat(81) }, 'u-owner')).toThrow(MutatorValidationError);
  });

  it('rejects name with control chars', () => {
    seedAgentGroup('ag-1', 'Old');
    seedUserWithRole('u-owner', 'owner', null);
    expect(() => renameAgentGroup({ id: 'ag-1', name: 'badname' }, 'u-owner')).toThrow(MutatorValidationError);
  });

  it('rejects when name collides with another agent group', () => {
    seedAgentGroup('ag-1', 'Alpha');
    seedAgentGroup('ag-2', 'Beta');
    seedUserWithRole('u-owner', 'owner', null);
    expect(() => renameAgentGroup({ id: 'ag-1', name: 'Beta' }, 'u-owner')).toThrow(MutatorConflictError);
  });

  it('allows renaming to the SAME name (no-op, no audit row)', () => {
    seedAgentGroup('ag-1', 'Same');
    seedUserWithRole('u-owner', 'owner', null);
    const result = renameAgentGroup({ id: 'ag-1', name: 'Same' }, 'u-owner');
    expect(result).toEqual({ id: 'ag-1', name: 'Same' });
    expect(getRecentAudit(10)).toHaveLength(0);
    expect(nudgePusher).not.toHaveBeenCalled();
  });

  it('throws MutatorNotFoundError for unknown agent group id', () => {
    seedUserWithRole('u-owner', 'owner', null);
    expect(() => renameAgentGroup({ id: 'no-such-group', name: 'X' }, 'u-owner')).toThrow(MutatorNotFoundError);
  });

  it('trims whitespace from the new name', () => {
    seedAgentGroup('ag-1', 'Old');
    seedUserWithRole('u-owner', 'owner', null);
    const result = renameAgentGroup({ id: 'ag-1', name: '  Trimmed  ' }, 'u-owner');
    expect(result.name).toBe('Trimmed');
    expect(getAgentGroup('ag-1')!.name).toBe('Trimmed');
  });
});

describe('resolveDashboardActor', () => {
  it('returns the install owner', () => {
    seedUserWithRole('u-owner', 'owner', null);
    const result = resolveDashboardActor({} as never);
    expect(result).toBe('u-owner');
  });

  it('returns undefined when no owner is set', () => {
    const result = resolveDashboardActor({} as never);
    expect(result).toBeUndefined();
  });
});
