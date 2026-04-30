import fs from 'fs';
import path from 'path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const TEST_DATA_DIR = '/tmp/nanoclaw-dashboard-mutators-test';

vi.mock('./config.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./config.js')>();
  return { ...actual, DATA_DIR: '/tmp/nanoclaw-dashboard-mutators-test' };
});

import { closeDb, createAgentGroup, getAgentGroup, initTestDb } from './db/index.js';
import { runMigrations } from './db/migrations/index.js';
import { getRecentAudit } from './db/dashboard-audit.js';
import { createSession } from './db/sessions.js';
import { ensureSchema, openInboundDb } from './db/session-db.js';
import { createUser } from './modules/permissions/db/users.js';
import { grantRole } from './modules/permissions/db/user-roles.js';
import { addMember } from './modules/permissions/db/agent-group-members.js';
import { insertTask } from './modules/scheduling/db.js';
import {
  MutatorAuthError,
  MutatorConflictError,
  MutatorNotFoundError,
  MutatorValidationError,
  cancelTask,
  pauseTask,
  resumeTask,
  renameAgentGroup,
  resolveDashboardActor,
  updateTask,
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

function seedUserAsMember(userId: string, agentGroupId: string) {
  createUser({ id: userId, kind: 'discord', display_name: null, created_at: now() });
  addMember({ user_id: userId, agent_group_id: agentGroupId, added_by: null, added_at: now() });
}

function seedSessionWithTasks(
  sessionId: string,
  agentGroupId: string,
  taskRows: Array<{
    id: string;
    status?: 'pending' | 'paused' | 'processing' | 'completed' | 'failed';
    recurrence?: string | null;
    processAfter?: string | null;
    prompt?: string;
    script?: string | null;
    seriesId?: string;
  }>,
) {
  createSession({
    id: sessionId,
    agent_group_id: agentGroupId,
    messaging_group_id: null,
    thread_id: null,
    agent_provider: null,
    status: 'active',
    container_status: 'stopped',
    last_active: now(),
    created_at: now(),
  } as never);

  const dir = path.join(TEST_DATA_DIR, 'v2-sessions', agentGroupId, sessionId);
  fs.mkdirSync(dir, { recursive: true });
  const dbPath = path.join(dir, 'inbound.db');
  ensureSchema(dbPath, 'inbound');
  const inDb = openInboundDb(dbPath);
  for (const row of taskRows) {
    insertTask(inDb, {
      id: row.id,
      processAfter: row.processAfter ?? '2026-04-30T09:00:00Z',
      recurrence: row.recurrence ?? null,
      platformId: null,
      channelType: null,
      threadId: null,
      content: JSON.stringify({ prompt: row.prompt ?? 'test prompt', script: row.script ?? null }),
    });
    // insertTask creates with status='pending'; flip to whatever the test wants.
    if (row.status && row.status !== 'pending') {
      inDb.prepare('UPDATE messages_in SET status = ? WHERE id = ?').run(row.status, row.id);
    }
    if (row.seriesId) {
      inDb.prepare('UPDATE messages_in SET series_id = ? WHERE id = ?').run(row.seriesId, row.id);
    }
  }
  inDb.close();
}

beforeEach(() => {
  initTestDb();
  runMigrations(initTestDb()); // idempotent — table already there from initTestDb but migrations need to run on it
  // initTestDb returns a fresh DB; rerun to ensure migrations applied.
  vi.mocked(nudgePusher).mockClear();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
});

// initTestDb is idempotent; the second call in beforeEach above just hands back
// the same handle. Migrations run against it once and don't repeat.

afterEach(() => {
  closeDb();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
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

describe('cancelTask', () => {
  it('rejects missing taskId or sessionId', () => {
    seedUserWithRole('u-owner', 'owner', null);
    expect(() => cancelTask({ taskId: '', sessionId: 's1' }, 'u-owner')).toThrow(MutatorValidationError);
    expect(() => cancelTask({ taskId: 't1', sessionId: '' }, 'u-owner')).toThrow(MutatorValidationError);
  });

  it('throws not-found when session does not exist', () => {
    seedUserWithRole('u-owner', 'owner', null);
    expect(() => cancelTask({ taskId: 't1', sessionId: 'no-such' }, 'u-owner')).toThrow(MutatorNotFoundError);
  });

  it('throws auth when actor cannot access the agent group', () => {
    seedAgentGroup('ag-1', 'Group A');
    seedAgentGroup('ag-2', 'Group B');
    seedUserAsMember('u-other', 'ag-2'); // member of a DIFFERENT group
    seedSessionWithTasks('s1', 'ag-1', [{ id: 't1', status: 'pending' }]);
    expect(() => cancelTask({ taskId: 't1', sessionId: 's1' }, 'u-other')).toThrow(MutatorAuthError);
  });

  it('throws auth for unknown user', () => {
    seedAgentGroup('ag-1', 'Group A');
    seedSessionWithTasks('s1', 'ag-1', [{ id: 't1', status: 'pending' }]);
    expect(() => cancelTask({ taskId: 't1', sessionId: 's1' }, 'u-nobody')).toThrow(MutatorAuthError);
  });

  it('throws not-found when task does not exist in inbound.db', () => {
    seedAgentGroup('ag-1', 'Group A');
    seedUserWithRole('u-owner', 'owner', null);
    seedSessionWithTasks('s1', 'ag-1', []);
    expect(() => cancelTask({ taskId: 'no-such', sessionId: 's1' }, 'u-owner')).toThrow(MutatorNotFoundError);
  });

  it('throws not-found (no-op) when task is processing', () => {
    seedAgentGroup('ag-1', 'Group A');
    seedUserWithRole('u-owner', 'owner', null);
    seedSessionWithTasks('s1', 'ag-1', [{ id: 't-proc', status: 'processing' }]);
    expect(() => cancelTask({ taskId: 't-proc', sessionId: 's1' }, 'u-owner')).toThrow(MutatorNotFoundError);
  });

  it('cancels a pending task and writes audit', () => {
    seedAgentGroup('ag-1', 'Group A');
    seedUserWithRole('u-owner', 'owner', null);
    seedSessionWithTasks('s1', 'ag-1', [{ id: 't-pending', status: 'pending', recurrence: '0 9 * * *' }]);

    const r = cancelTask({ taskId: 't-pending', sessionId: 's1' }, 'u-owner');
    expect(r.ok).toBe(true);
    expect(r.task?.status).toBe('completed');
    expect(r.task?.recurrence).toBeNull();

    expect(nudgePusher).toHaveBeenCalledTimes(1);

    const audit = getRecentAudit(10);
    expect(audit).toHaveLength(1);
    expect(audit[0].action).toBe('task.cancel');
    expect(audit[0].target_type).toBe('task');
    expect(audit[0].target_id).toBe('s1:t-pending');
    expect(JSON.parse(audit[0].before_json!).status).toBe('pending');
    expect(JSON.parse(audit[0].after_json!).status).toBe('completed');
  });

  it('cancels a paused task', () => {
    seedAgentGroup('ag-1', 'Group A');
    seedUserAsMember('u-member', 'ag-1');
    seedSessionWithTasks('s1', 'ag-1', [{ id: 't-paused', status: 'paused' }]);

    const r = cancelTask({ taskId: 't-paused', sessionId: 's1' }, 'u-member');
    expect(r.task?.status).toBe('completed');
  });

  it('allows scoped admin of the agent group', () => {
    seedAgentGroup('ag-1', 'Group A');
    seedUserWithRole('u-sa', 'admin', 'ag-1');
    seedSessionWithTasks('s1', 'ag-1', [{ id: 't1', status: 'pending' }]);
    expect(() => cancelTask({ taskId: 't1', sessionId: 's1' }, 'u-sa')).not.toThrow();
  });
});

describe('pauseTask', () => {
  it('pauses a pending task and writes audit', () => {
    seedAgentGroup('ag-1', 'Group A');
    seedUserAsMember('u-member', 'ag-1');
    seedSessionWithTasks('s1', 'ag-1', [{ id: 't1', status: 'pending' }]);

    const r = pauseTask({ taskId: 't1', sessionId: 's1' }, 'u-member');
    expect(r.task?.status).toBe('paused');

    const audit = getRecentAudit(10);
    expect(audit[0].action).toBe('task.pause');
    expect(audit[0].target_id).toBe('s1:t1');
  });

  it('throws not-found for already-paused task (pauseTask refuses)', () => {
    seedAgentGroup('ag-1', 'Group A');
    seedUserWithRole('u-owner', 'owner', null);
    seedSessionWithTasks('s1', 'ag-1', [{ id: 't1', status: 'paused' }]);
    expect(() => pauseTask({ taskId: 't1', sessionId: 's1' }, 'u-owner')).toThrow(MutatorNotFoundError);
  });

  it('throws not-found for processing task', () => {
    seedAgentGroup('ag-1', 'Group A');
    seedUserWithRole('u-owner', 'owner', null);
    seedSessionWithTasks('s1', 'ag-1', [{ id: 't1', status: 'processing' }]);
    expect(() => pauseTask({ taskId: 't1', sessionId: 's1' }, 'u-owner')).toThrow(MutatorNotFoundError);
  });

  it('rejects unauthorized actor', () => {
    seedAgentGroup('ag-1', 'Group A');
    seedAgentGroup('ag-2', 'Group B');
    seedUserAsMember('u-other', 'ag-2');
    seedSessionWithTasks('s1', 'ag-1', [{ id: 't1', status: 'pending' }]);
    expect(() => pauseTask({ taskId: 't1', sessionId: 's1' }, 'u-other')).toThrow(MutatorAuthError);
  });
});

describe('resumeTask', () => {
  it('resumes a paused task and writes audit', () => {
    seedAgentGroup('ag-1', 'Group A');
    seedUserAsMember('u-member', 'ag-1');
    seedSessionWithTasks('s1', 'ag-1', [{ id: 't1', status: 'paused' }]);

    const r = resumeTask({ taskId: 't1', sessionId: 's1' }, 'u-member');
    expect(r.task?.status).toBe('pending');

    const audit = getRecentAudit(10);
    expect(audit[0].action).toBe('task.resume');
    expect(audit[0].target_id).toBe('s1:t1');
  });

  it('throws not-found for already-pending task (resumeTask refuses)', () => {
    seedAgentGroup('ag-1', 'Group A');
    seedUserWithRole('u-owner', 'owner', null);
    seedSessionWithTasks('s1', 'ag-1', [{ id: 't1', status: 'pending' }]);
    expect(() => resumeTask({ taskId: 't1', sessionId: 's1' }, 'u-owner')).toThrow(MutatorNotFoundError);
  });

  it('rejects unauthorized actor', () => {
    seedAgentGroup('ag-1', 'Group A');
    seedAgentGroup('ag-2', 'Group B');
    seedUserAsMember('u-other', 'ag-2');
    seedSessionWithTasks('s1', 'ag-1', [{ id: 't1', status: 'paused' }]);
    expect(() => resumeTask({ taskId: 't1', sessionId: 's1' }, 'u-other')).toThrow(MutatorAuthError);
  });
});

describe('updateTask', () => {
  it('rejects empty prompt', () => {
    seedAgentGroup('ag-1', 'Group A');
    seedUserWithRole('u-owner', 'owner', null);
    seedSessionWithTasks('s1', 'ag-1', [{ id: 't1', status: 'pending' }]);
    expect(() => updateTask({ taskId: 't1', sessionId: 's1', prompt: '' }, 'u-owner')).toThrow(MutatorValidationError);
    expect(() => updateTask({ taskId: 't1', sessionId: 's1', prompt: '   ' }, 'u-owner')).toThrow(
      MutatorValidationError,
    );
  });

  it('rejects malformed cron', () => {
    seedAgentGroup('ag-1', 'Group A');
    seedUserWithRole('u-owner', 'owner', null);
    seedSessionWithTasks('s1', 'ag-1', [{ id: 't1', status: 'pending' }]);
    expect(() => updateTask({ taskId: 't1', sessionId: 's1', recurrence: 'not-a-cron' }, 'u-owner')).toThrow(
      MutatorValidationError,
    );
  });

  it('throws not-found when task does not exist', () => {
    seedAgentGroup('ag-1', 'Group A');
    seedUserWithRole('u-owner', 'owner', null);
    seedSessionWithTasks('s1', 'ag-1', []);
    expect(() => updateTask({ taskId: 'no-such', sessionId: 's1', prompt: 'new' }, 'u-owner')).toThrow(
      MutatorNotFoundError,
    );
  });

  it('updates prompt and writes audit with diff', () => {
    seedAgentGroup('ag-1', 'Group A');
    seedUserWithRole('u-owner', 'owner', null);
    seedSessionWithTasks('s1', 'ag-1', [{ id: 't1', status: 'pending', prompt: 'original' }]);

    const r = updateTask({ taskId: 't1', sessionId: 's1', prompt: 'new prompt' }, 'u-owner');
    expect(JSON.parse(r.task!.content).prompt).toBe('new prompt');

    const audit = getRecentAudit(10);
    expect(audit[0].action).toBe('task.update');
    expect(JSON.parse(JSON.parse(audit[0].before_json!).content).prompt).toBe('original');
    expect(JSON.parse(JSON.parse(audit[0].after_json!).content).prompt).toBe('new prompt');
  });

  it('updates recurrence with valid cron', () => {
    seedAgentGroup('ag-1', 'Group A');
    seedUserWithRole('u-owner', 'owner', null);
    seedSessionWithTasks('s1', 'ag-1', [{ id: 't1', status: 'pending', recurrence: '0 9 * * *' }]);

    const r = updateTask({ taskId: 't1', sessionId: 's1', recurrence: '0 8 * * 1' }, 'u-owner');
    expect(r.task?.recurrence).toBe('0 8 * * 1');
  });

  it('clears recurrence when null is passed (recurring → one-shot)', () => {
    seedAgentGroup('ag-1', 'Group A');
    seedUserWithRole('u-owner', 'owner', null);
    seedSessionWithTasks('s1', 'ag-1', [{ id: 't1', status: 'pending', recurrence: '0 9 * * *' }]);

    const r = updateTask({ taskId: 't1', sessionId: 's1', recurrence: null }, 'u-owner');
    expect(r.task?.recurrence).toBeNull();
  });

  it('rejects unauthorized actor', () => {
    seedAgentGroup('ag-1', 'Group A');
    seedAgentGroup('ag-2', 'Group B');
    seedUserAsMember('u-other', 'ag-2');
    seedSessionWithTasks('s1', 'ag-1', [{ id: 't1', status: 'pending' }]);
    expect(() => updateTask({ taskId: 't1', sessionId: 's1', prompt: 'new' }, 'u-other')).toThrow(MutatorAuthError);
  });
});
