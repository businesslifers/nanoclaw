/**
 * Sweep tier-crossing / dedup tests — the off-by-one-day logic most likely
 * to regress silently, one suite per ported script:
 *   delegation nag throttle    ← handoff-sweep.mjs
 *   deliverable tier cascade   ← dependency-cascade.mjs
 *   cadence weekly RAG         ← cadence-health.mjs
 * All against the pure decision functions — no DB, no timers.
 */
import { describe, it, expect } from 'vitest';

import {
  DELEGATION_NAG_INTERVAL_MS,
  decideCadenceOverdue,
  decideDelegationNag,
  decideDeliverableTier,
  decideSweepActions,
} from './sweep.js';
import type { WorkItem } from '../../db/work-items.js';

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
