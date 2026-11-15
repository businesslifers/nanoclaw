/**
 * Sweep tier-crossing / dedup tests — the off-by-one-day logic most likely
 * to regress silently, one suite per ported script:
 *   delegation nag throttle    ← handoff-sweep.mjs
 *   deliverable tier cascade   ← dependency-cascade.mjs
 *   cadence weekly RAG         ← cadence-health.mjs
 * All against the pure decision functions — no DB, no timers.
 *
 * The final describe block below is the exception: an integration test
 * against the real `sweepWorkItems()` DB path, covering the one thing the
 * pure decision functions can't — that a no-session team's items are never
 * stamped (see the "skip stamps only for no-session teams" fix).
 */
import { sqliteRaw } from '../../db/drivers/sqlite.js';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  DELEGATION_NAG_INTERVAL_MS,
  computeDailyRagRollup,
  decideCadenceOverdue,
  decideDelegationNag,
  decideDeliverableTier,
  decideSweepActions,
  sweepWorkItems,
} from './sweep.js';
import type { WorkItem } from '../../db/work-items.js';
import { initTestDb, closeDb, runMigrations, createAgentGroup } from '../../db/index.js';
import { createWorkItem, generateWorkItemId } from '../../db/work-items.js';
import { createSession } from '../../db/sessions.js';
import { getDb } from '../../db/connection.js';
import { isoWeek } from './period.js';

vi.mock('../approvals/primitive.js', () => ({ notifyAgent: vi.fn() }));

const TZ = 'UTC';
const NOW = Date.parse('2026-07-02T10:00:00Z');
const TODAY = '2026-07-02'; // Thursday → ISO dow 4

function base(overrides: Partial<WorkItem>): WorkItem {
  return {
    id: 'wi-test',
    owner_agent_group_id: 'ag-lead',
    assignee_agent_group_id: null,
    assignee_user_id: null,
    assignee_label: null,
    parent_id: null,
    kind: 'task',
    title: 't',
    status: 'open',
    status_detail: null,
    due_at: null,
    follow_up_at: null,
    completed_at: null,
    reminder_tier: null,
    reminder_last_sent_at: null,
    cadence_expected_dow: null,
    cadence_period_label: null,
    cadence_last_completed_period: null,
    fields_json: null,
    created_by_kind: 'agent',
    created_by_id: null,
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
    ...overrides,
  };
}

describe('delegation follow-up nag (handoff-sweep port)', () => {
  it('fires when follow_up_at is past and status is non-terminal', () => {
    const item = base({ kind: 'delegation', follow_up_at: '2026-07-02T09:00:00Z' });
    expect(decideDelegationNag(item, NOW)).toBe(true);
  });

  it('does not fire before follow_up_at, on closed items, or without follow_up_at', () => {
    expect(decideDelegationNag(base({ follow_up_at: '2026-07-02T11:00:00Z' }), NOW)).toBe(false);
    expect(decideDelegationNag(base({ follow_up_at: '2026-07-02T09:00:00Z', status: 'done' }), NOW)).toBe(false);
    expect(decideDelegationNag(base({}), NOW)).toBe(false);
  });

  it('re-nags until closed, throttled to the nag interval (parity with the old cron cadence)', () => {
    const justNagged = base({
      follow_up_at: '2026-07-02T08:00:00Z',
      reminder_last_sent_at: new Date(NOW - 5 * 60_000).toISOString(),
    });
    expect(decideDelegationNag(justNagged, NOW)).toBe(false);
    const naggedAWhileAgo = base({
      follow_up_at: '2026-07-02T08:00:00Z',
      reminder_last_sent_at: new Date(NOW - DELEGATION_NAG_INTERVAL_MS - 1000).toISOString(),
    });
    expect(decideDelegationNag(naggedAWhileAgo, NOW)).toBe(true);
  });

  it('excludes deliverable/cadence kinds (they have their own branches sharing the stamp column)', () => {
    expect(decideDelegationNag(base({ kind: 'deliverable', follow_up_at: '2026-07-02T09:00:00Z' }), NOW)).toBe(false);
    expect(decideDelegationNag(base({ kind: 'cadence', follow_up_at: '2026-07-02T09:00:00Z' }), NOW)).toBe(false);
  });
});

describe('deliverable tier cascade (dependency-cascade port)', () => {
  function deliverable(due: string, tier: string | null, lastSent: string | null) {
    return base({ kind: 'deliverable', due_at: due, reminder_tier: tier, reminder_last_sent_at: lastSent });
  }

  it('picks the tightest crossed tier', () => {
    expect(decideDeliverableTier(deliverable('2026-07-15', null, null), TODAY, TZ)?.tier).toBe(14); // 13d out
    expect(decideDeliverableTier(deliverable('2026-07-08', null, null), TODAY, TZ)?.tier).toBe(7); // 6d out
    expect(decideDeliverableTier(deliverable('2026-07-04', null, null), TODAY, TZ)?.tier).toBe(3); // 2d out
    expect(decideDeliverableTier(deliverable('2026-07-01', null, null), TODAY, TZ)?.tier).toBe('missed');
  });

  it('does not fire beyond 14 days out', () => {
    expect(decideDeliverableTier(deliverable('2026-08-01', null, null), TODAY, TZ)).toBeNull();
  });

  it('each pre-due tier fires once — same tier does not re-fire', () => {
    expect(decideDeliverableTier(deliverable('2026-07-08', '7', '2026-07-01'), TODAY, TZ)).toBeNull();
    // crossing from 7 → 3 fires again
    expect(decideDeliverableTier(deliverable('2026-07-04', '7', '2026-07-01'), TODAY, TZ)?.tier).toBe(3);
    // stale looser tier does not block: last=14, now within 3
    expect(decideDeliverableTier(deliverable('2026-07-04', '14', '2026-06-25'), TODAY, TZ)?.tier).toBe(3);
  });

  it('missed nags once per day until closed', () => {
    expect(decideDeliverableTier(deliverable('2026-07-01', 'missed', TODAY), TODAY, TZ)).toBeNull();
    expect(decideDeliverableTier(deliverable('2026-07-01', 'missed', '2026-07-01'), TODAY, TZ)?.tier).toBe('missed');
  });

  it('a stale missed stamp does not block pre-due reminders after the due date moved out', () => {
    // was missed, then due pushed to 6 days out → tier 7 must fire
    expect(decideDeliverableTier(deliverable('2026-07-08', 'missed', '2026-06-30'), TODAY, TZ)?.tier).toBe(7);
  });

  it('ignores closed items and undated items', () => {
    expect(
      decideDeliverableTier(base({ kind: 'deliverable', status: 'done', due_at: '2026-07-01' }), TODAY, TZ),
    ).toBeNull();
    expect(decideDeliverableTier(base({ kind: 'deliverable' }), TODAY, TZ)).toBeNull();
  });
});

describe('cadence weekly RAG (cadence-health port)', () => {
  function cadence(expectedDow: number, lastWeek: string | null, lastSent: string | null) {
    return base({
      kind: 'cadence',
      cadence_expected_dow: expectedDow,
      cadence_last_completed_period: lastWeek,
      reminder_last_sent_at: lastSent,
    });
  }

  it('fires when the expected weekday has passed and this ISO week is unstamped', () => {
    // TODAY is Thursday (dow 4), 2026-W27
    expect(decideCadenceOverdue(cadence(1, null, null), TODAY, TZ)).toBe(true); // Monday stream, unstamped
    expect(decideCadenceOverdue(cadence(4, null, null), TODAY, TZ)).toBe(true); // due today counts
  });

  it('does not fire before the expected weekday or when this week is stamped', () => {
    expect(decideCadenceOverdue(cadence(5, null, null), TODAY, TZ)).toBe(false); // Friday stream, still Thursday
    expect(decideCadenceOverdue(cadence(1, '2026-W27', null), TODAY, TZ)).toBe(false); // stamped this week
  });

  it('previous-week stamp does not satisfy the current week', () => {
    expect(decideCadenceOverdue(cadence(1, '2026-W26', null), TODAY, TZ)).toBe(true);
  });

  it('dedupes to once per calendar day', () => {
    expect(decideCadenceOverdue(cadence(1, null, TODAY), TODAY, TZ)).toBe(false);
    expect(decideCadenceOverdue(cadence(1, null, '2026-07-01'), TODAY, TZ)).toBe(true);
  });

  it('a blocked stream still triggers dedup accounting but not escalation', () => {
    expect(decideCadenceOverdue({ ...cadence(1, null, null), status: 'blocked' }, TODAY, TZ)).toBe(true);
  });
});

describe('blocked cadence items never stand up a wake on their own (parity with cadence-health.mjs blockedStreams)', () => {
  function blockedCadence(overrides: Partial<WorkItem> = {}) {
    return base({
      id: 'wi-blocked',
      kind: 'cadence',
      status: 'blocked',
      status_detail: 'waiting on the email platform to go live',
      cadence_expected_dow: 1,
      owner_agent_group_id: 'ag-lpg',
      ...overrides,
    });
  }

  it('blocked-alone: no wake, no stamp (silent — reconsidered next tick, not tomorrow)', () => {
    const { wakes, stamps } = decideSweepActions([blockedCadence()], { nowMs: NOW, today: TODAY, tz: TZ });
    expect(wakes.has('ag-lpg')).toBe(false);
    expect(stamps).toHaveLength(0);
  });

  it('rides along informationally when the same team is already woken by another item', () => {
    const items = [
      blockedCadence(),
      base({
        id: 'wi-other',
        kind: 'delegation',
        follow_up_at: '2026-07-02T08:00:00Z',
        owner_agent_group_id: 'ag-lpg',
      }),
    ];
    const { wakes, stamps } = decideSweepActions(items, { nowMs: NOW, today: TODAY, tz: TZ });
    const lines = wakes.get('ag-lpg');
    expect(lines).toHaveLength(2);
    const blockedLine = lines?.find((l) => l.includes('BLOCKED'));
    expect(blockedLine).toContain('waiting on the email platform to go live');
    expect(blockedLine).not.toContain('alert the owners');
    expect(stamps.map((s) => s.id).sort()).toEqual(['wi-blocked', 'wi-other']);
  });

  it('rides along regardless of array order (order-independence)', () => {
    // Same as above but the waking item comes BEFORE the blocked item in
    // the array — `wakes.has(team)` must reflect the full tick, not
    // whatever's been seen so far.
    const items = [
      base({
        id: 'wi-other',
        kind: 'delegation',
        follow_up_at: '2026-07-02T08:00:00Z',
        owner_agent_group_id: 'ag-lpg',
      }),
      blockedCadence(),
    ];
    const { wakes } = decideSweepActions(items, { nowMs: NOW, today: TODAY, tz: TZ });
    expect(wakes.get('ag-lpg')?.some((l) => l.includes('BLOCKED'))).toBe(true);
  });

  it('falls back to a generic note when status_detail is unset', () => {
    const items = [
      blockedCadence({ id: 'wi-blocked-2', status_detail: null }),
      base({
        id: 'wi-other',
        kind: 'delegation',
        follow_up_at: '2026-07-02T08:00:00Z',
        owner_agent_group_id: 'ag-lpg',
      }),
    ];
    const { wakes } = decideSweepActions(items, { nowMs: NOW, today: TODAY, tz: TZ });
    expect(wakes.get('ag-lpg')?.some((l) => l.includes('no detail recorded'))).toBe(true);
  });
});

describe('decideSweepActions consolidation', () => {
  it('groups wakes per owner team and stamps everything it fires', () => {
    const items = [
      base({ id: 'wi-1', kind: 'delegation', follow_up_at: '2026-07-02T08:00:00Z', owner_agent_group_id: 'ag-lpg' }),
      base({ id: 'wi-2', kind: 'deliverable', due_at: '2026-07-04', owner_agent_group_id: 'ag-lpg' }),
      base({ id: 'wi-3', kind: 'cadence', cadence_expected_dow: 1, owner_agent_group_id: 'ag-other' }),
    ];
    const { wakes, stamps } = decideSweepActions(items, { nowMs: NOW, today: TODAY, tz: TZ });
    expect(wakes.get('ag-lpg')).toHaveLength(2);
    expect(wakes.get('ag-other')).toHaveLength(1);
    expect(stamps.map((s) => s.id).sort()).toEqual(['wi-1', 'wi-2', 'wi-3']);
    expect(stamps.find((s) => s.id === 'wi-2')?.reminder_tier).toBe('3');
  });

  it('quiet day → no wakes, no stamps', () => {
    const items = [base({ id: 'wi-1', kind: 'deliverable', due_at: '2026-08-20' })];
    const { wakes, stamps } = decideSweepActions(items, { nowMs: NOW, today: TODAY, tz: TZ });
    expect(wakes.size).toBe(0);
    expect(stamps).toHaveLength(0);
  });
});

describe('computeDailyRagRollup (cadence-health.mjs RAG parity — dormant, not yet wired to a live wake)', () => {
  it('GREEN when nothing is overdue or due soon', () => {
    const items = [
      base({ id: 'wi-1', kind: 'deliverable', due_at: '2026-08-20', owner_agent_group_id: 'ag-lpg' }),
      base({ id: 'wi-2', kind: 'cadence', cadence_expected_dow: 6, owner_agent_group_id: 'ag-lpg' }),
    ];
    const rollup = computeDailyRagRollup(items, { today: TODAY, tz: TZ });
    expect(rollup.get('ag-lpg')?.rag).toBe('GREEN');
  });

  it('RED when a deliverable is overdue, even if something else is also AMBER-worthy', () => {
    const items = [
      base({ id: 'wi-1', kind: 'deliverable', due_at: '2026-06-01', owner_agent_group_id: 'ag-lpg' }),
      base({ id: 'wi-2', kind: 'deliverable', due_at: '2026-07-05', owner_agent_group_id: 'ag-lpg' }),
    ];
    const rollup = computeDailyRagRollup(items, { today: TODAY, tz: TZ })?.get('ag-lpg');
    expect(rollup?.rag).toBe('RED');
    expect(rollup?.overdueDeliverables.map((i) => i.id)).toEqual(['wi-1']);
    expect(rollup?.soonDeliverables.map((i) => i.id)).toEqual(['wi-2']);
  });

  it('AMBER when a deliverable is due within 3 days (soonDeps parity — inclusive of day 3, exclusive of overdue)', () => {
    const soon = computeDailyRagRollup(
      [base({ id: 'wi-1', kind: 'deliverable', due_at: '2026-07-05', owner_agent_group_id: 'ag-lpg' })],
      { today: TODAY, tz: TZ },
    ).get('ag-lpg');
    expect(soon?.rag).toBe('AMBER');

    const tooFar = computeDailyRagRollup(
      [base({ id: 'wi-1', kind: 'deliverable', due_at: '2026-07-06', owner_agent_group_id: 'ag-lpg' })],
      { today: TODAY, tz: TZ },
    ).get('ag-lpg');
    expect(tooFar?.rag).toBe('GREEN');
  });

  it('AMBER when a non-blocked cadence stream is overdue', () => {
    const rollup = computeDailyRagRollup(
      [base({ id: 'wi-1', kind: 'cadence', cadence_expected_dow: 1, owner_agent_group_id: 'ag-lpg' })],
      { today: TODAY, tz: TZ },
    ).get('ag-lpg');
    expect(rollup?.rag).toBe('AMBER');
    expect(rollup?.overdueStreams.map((i) => i.id)).toEqual(['wi-1']);
  });

  it('a BLOCKED cadence stream never affects RAG on its own — informational only, parity with blockedStreams', () => {
    const rollup = computeDailyRagRollup(
      [
        base({
          id: 'wi-1',
          kind: 'cadence',
          cadence_expected_dow: 1,
          status: 'blocked',
          owner_agent_group_id: 'ag-lpg',
        }),
      ],
      { today: TODAY, tz: TZ },
    ).get('ag-lpg');
    expect(rollup?.rag).toBe('GREEN');
    expect(rollup?.blockedStreams.map((i) => i.id)).toEqual(['wi-1']);
    expect(rollup?.overdueStreams).toEqual([]);
  });

  it('a blocked stream does not suppress RED/AMBER raised by something else on the same team', () => {
    const rollup = computeDailyRagRollup(
      [
        base({
          id: 'wi-1',
          kind: 'cadence',
          cadence_expected_dow: 1,
          status: 'blocked',
          owner_agent_group_id: 'ag-lpg',
        }),
        base({ id: 'wi-2', kind: 'deliverable', due_at: '2026-06-01', owner_agent_group_id: 'ag-lpg' }),
      ],
      { today: TODAY, tz: TZ },
    ).get('ag-lpg');
    expect(rollup?.rag).toBe('RED');
    expect(rollup?.blockedStreams.map((i) => i.id)).toEqual(['wi-1']);
  });

  it('done/cancelled items never contribute, regardless of kind or due date', () => {
    const rollup = computeDailyRagRollup(
      [
        base({ id: 'wi-1', kind: 'deliverable', due_at: '2026-06-01', status: 'done', owner_agent_group_id: 'ag-lpg' }),
        base({
          id: 'wi-2',
          kind: 'cadence',
          cadence_expected_dow: 1,
          status: 'cancelled',
          owner_agent_group_id: 'ag-lpg',
        }),
      ],
      { today: TODAY, tz: TZ },
    );
    expect(rollup.get('ag-lpg')).toBeUndefined();
  });

  it('a cadence stream already completed this ISO week is not overdue (team reports GREEN, not untracked)', () => {
    const rollup = computeDailyRagRollup(
      [
        base({
          id: 'wi-1',
          kind: 'cadence',
          cadence_expected_dow: 1,
          cadence_last_completed_period: isoWeek(TODAY),
          owner_agent_group_id: 'ag-lpg',
        }),
      ],
      { today: TODAY, tz: TZ },
    ).get('ag-lpg');
    expect(rollup?.rag).toBe('GREEN');
    expect(rollup?.overdueStreams).toEqual([]);
  });

  it('a cadence stream is not overdue before its expected ISO weekday arrives (team reports GREEN, not untracked)', () => {
    // TODAY is ISO dow 4 (Thursday); expected_dow 5 (Friday) hasn't arrived yet.
    const rollup = computeDailyRagRollup(
      [base({ id: 'wi-1', kind: 'cadence', cadence_expected_dow: 5, owner_agent_group_id: 'ag-lpg' })],
      { today: TODAY, tz: TZ },
    ).get('ag-lpg');
    expect(rollup?.rag).toBe('GREEN');
    expect(rollup?.overdueStreams).toEqual([]);
  });

  it('classifies multiple teams independently in one pass', () => {
    const items = [
      base({ id: 'wi-1', kind: 'deliverable', due_at: '2026-06-01', owner_agent_group_id: 'ag-lpg' }),
      base({ id: 'wi-2', kind: 'deliverable', due_at: '2026-08-20', owner_agent_group_id: 'ag-other' }),
    ];
    const rollup = computeDailyRagRollup(items, { today: TODAY, tz: TZ });
    expect(rollup.get('ag-lpg')?.rag).toBe('RED');
    expect(rollup.get('ag-other')?.rag).toBe('GREEN');
  });

  it('ignores kinds outside deliverable/cadence (delegation, task) entirely', () => {
    const rollup = computeDailyRagRollup(
      [
        base({ id: 'wi-1', kind: 'delegation', follow_up_at: '2026-06-01T00:00:00Z', owner_agent_group_id: 'ag-lpg' }),
        base({ id: 'wi-2', kind: 'task', owner_agent_group_id: 'ag-lpg' }),
      ],
      { today: TODAY, tz: TZ },
    );
    expect(rollup.get('ag-lpg')).toBeUndefined();
  });
});

describe('sweepWorkItems: no-session teams never get stamped (integration)', () => {
  const TEAM_LIVE = 'ag-team-live';
  const TEAM_COLD = 'ag-team-cold';
  // Far enough in the past to be overdue on any real test-run date.
  const LONG_OVERDUE = '2020-01-01T00:00:00Z';

  beforeEach(async () => {
    const db = await initTestDb();
    await runMigrations(db);
    for (const id of [TEAM_LIVE, TEAM_COLD]) {
      await createAgentGroup({ id, name: id, folder: id, agent_provider: null, created_at: new Date().toISOString() });
    }
    await createSession({
      id: 'sess-live',
      agent_group_id: TEAM_LIVE,
      messaging_group_id: null,
      thread_id: null,
      agent_provider: null,
      status: 'active',
      container_status: 'running',
      last_active: null,
      created_at: new Date().toISOString(),
    });
    // TEAM_COLD deliberately gets no session row.
  });

  afterEach(async () => {
    await closeDb();
    vi.clearAllMocks();
  });

  it('stamps + wakes the live team, but skips the stamp for the session-less team', async () => {
    const live = createWorkItem({
      id: generateWorkItemId(),
      owner_agent_group_id: TEAM_LIVE,
      title: 'chase this',
      follow_up_at: LONG_OVERDUE,
      created_by_kind: 'agent',
    });
    const cold = createWorkItem({
      id: generateWorkItemId(),
      owner_agent_group_id: TEAM_COLD,
      title: 'nobody home',
      follow_up_at: LONG_OVERDUE,
      created_by_kind: 'agent',
    });

    await sweepWorkItems();

    const { notifyAgent } = await import('../approvals/primitive.js');
    expect(notifyAgent).toHaveBeenCalledTimes(1);

    const db = sqliteRaw(getDb());
    const liveRow = db.prepare('SELECT reminder_last_sent_at FROM work_items WHERE id = ?').get(live.id) as {
      reminder_last_sent_at: string | null;
    };
    const coldRow = db.prepare('SELECT reminder_last_sent_at FROM work_items WHERE id = ?').get(cold.id) as {
      reminder_last_sent_at: string | null;
    };
    expect(liveRow.reminder_last_sent_at).not.toBeNull();
    expect(coldRow.reminder_last_sent_at).toBeNull();
  });

  it('a still-cold team keeps retrying on the next tick (stamp remains unset)', async () => {
    const cold = createWorkItem({
      id: generateWorkItemId(),
      owner_agent_group_id: TEAM_COLD,
      title: 'nobody home',
      follow_up_at: LONG_OVERDUE,
      created_by_kind: 'agent',
    });

    await sweepWorkItems();
    await sweepWorkItems();

    const db = sqliteRaw(getDb());
    const coldRow = db.prepare('SELECT reminder_last_sent_at FROM work_items WHERE id = ?').get(cold.id) as {
      reminder_last_sent_at: string | null;
    };
    expect(coldRow.reminder_last_sent_at).toBeNull();
  });
});
