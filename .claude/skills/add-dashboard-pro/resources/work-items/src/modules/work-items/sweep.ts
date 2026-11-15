/**
 * Work-items sweep — hooked into src/host-sweep.ts (MODULE-HOOK:
 * work-items-sweep). One central-DB scan per tick, not per session.
 *
 * Three branches, each a direct logic-port of one of LPG's retiring cron
 * scripts (a lead only reliably acts on work that wakes it — obligations
 * without a trigger lapse silently):
 *
 *   1. Delegation follow-ups — ports handoff-sweep.mjs. Any non-terminal
 *      item with follow_up_at <= now nags its OWNER team until closed.
 *      The original "nags every tick by design" ran on a scheduled-task
 *      cadence (tens of minutes); this sweep ticks every 60s, so parity is
 *      preserved with a 30-minute re-nag throttle per item, NOT by nagging
 *      60×/hour. kind='deliverable'/'cadence' items are excluded — they
 *      have their own branches and share the reminder_last_sent_at column.
 *
 *   2. Deliverable tier cascade — ports dependency-cascade.mjs. For open
 *      kind='deliverable' items with a due date: 14/7/3-day tiers fire once
 *      when first crossed (tightest crossed wins); once overdue ("missed"),
 *      nags once per day. Stamps reminder_tier + reminder_last_sent_at
 *      BEFORE waking so dedup never depends on the lead remembering to.
 *
 *   3. Cadence RAG — ports cadence-health.mjs. For open kind='cadence'
 *      items: if today's ISO weekday has reached cadence_expected_dow and
 *      cadence_last_completed_period isn't the current ISO week, the weekly
 *      stream is overdue — daily dedup via reminder_last_sent_at.
 *
 * Wakes are consolidated per team (one message listing everything due, like
 * the original scripts' single wake with full data).
 */
import { TIMEZONE } from '../../config.js';
import { findSessionByAgentGroupSync, hasTableSync, rawDb } from '../../central-db-sync.js';
import type { WorkItem } from '../../db/work-items.js';
import { log } from '../../log.js';
import { notifyAgent } from '../approvals/primitive.js';
import { daysBetween, isoDow, isoWeek, todayInTz, toLocalYmd } from './period.js';
import { refreshWorkItemsProjection } from './projection.js';

/** Minimum gap between repeated follow-up nags for the same delegation. */
export const DELEGATION_NAG_INTERVAL_MS = 30 * 60 * 1000;
/** Deliverable reminder tiers, ascending — tightest crossed wins. */
export const DELIVERABLE_TIERS = [3, 7, 14] as const;

export type DeliverableTier = 3 | 7 | 14 | 'missed';

function tierRank(tier: DeliverableTier): number {
  return tier === 'missed' ? -1 : tier;
}

/** Branch 1 (pure): should this overdue-follow-up item re-nag now? */
export function decideDelegationNag(
  item: Pick<WorkItem, 'kind' | 'status' | 'follow_up_at' | 'reminder_last_sent_at'>,
  nowMs: number,
): boolean {
  if (item.kind === 'deliverable' || item.kind === 'cadence') return false;
  if (!item.follow_up_at) return false;
  if (item.status === 'done' || item.status === 'cancelled') return false;
  const due = Date.parse(item.follow_up_at);
  if (Number.isNaN(due) || due > nowMs) return false;
  if (item.reminder_last_sent_at) {
    const last = Date.parse(item.reminder_last_sent_at);
    if (!Number.isNaN(last) && nowMs - last < DELEGATION_NAG_INTERVAL_MS) return false;
  }
  return true;
}

/**
 * Branch 2 (pure): which tier fires for this deliverable today, if any.
 * Ports dependency-cascade.mjs verbatim: tightest crossed tier; pre-due
 * tiers fire once when first crossed (a stale 'missed' stamp from a due
 * date pushed back into the future must NOT block pre-due reminders);
 * missed nags once per day.
 */
export function decideDeliverableTier(
  item: Pick<WorkItem, 'kind' | 'status' | 'due_at' | 'reminder_tier' | 'reminder_last_sent_at'>,
  today: string,
  tz: string = TIMEZONE,
): { tier: DeliverableTier; daysUntil: number } | null {
  if (item.kind !== 'deliverable') return null;
  if (item.status === 'done' || item.status === 'cancelled') return null;
  const dueYmd = toLocalYmd(item.due_at, tz);
  if (!dueYmd) return null;

  const daysUntil = daysBetween(today, dueYmd);
  let tier: DeliverableTier | null;
  if (daysUntil < 0) tier = 'missed';
  else tier = DELIVERABLE_TIERS.find((t) => daysUntil <= t) ?? null;
  if (tier === null) return null;

  if (tier === 'missed') {
    const lastYmd = toLocalYmd(item.reminder_last_sent_at, tz);
    return lastYmd === today ? null : { tier, daysUntil };
  }
  const last = item.reminder_tier;
  const lastRank = last == null || last === 'missed' ? Infinity : tierRank(Number(last) as DeliverableTier);
  return tierRank(tier) < lastRank ? { tier, daysUntil } : null;
}

/** Branch 3 (pure): is this weekly cadence stream overdue today (and not yet flagged today)? */
export function decideCadenceOverdue(
  item: Pick<
    WorkItem,
    'kind' | 'status' | 'cadence_expected_dow' | 'cadence_last_completed_period' | 'reminder_last_sent_at'
  >,
  today: string,
  tz: string = TIMEZONE,
): boolean {
  if (item.kind !== 'cadence') return false;
  if (item.status === 'done' || item.status === 'cancelled') return false;
  const expected = Number(item.cadence_expected_dow) || 7;
  if (isoDow(today) < expected) return false;
  if (item.cadence_last_completed_period === isoWeek(today)) return false;
  const lastYmd = toLocalYmd(item.reminder_last_sent_at, tz);
  return lastYmd !== today;
}

export type DailyRag = 'GREEN' | 'AMBER' | 'RED';

export interface DailyRagRollup {
  rag: DailyRag;
  overdueDeliverables: WorkItem[];
  soonDeliverables: WorkItem[];
  overdueStreams: WorkItem[];
  blockedStreams: WorkItem[];
}

/**
 * Daily owner-facing RAG rollup — cadence-health.mjs parity, generalized
 * across every team instead of just LPG. Pure snapshot classification (no
 * reminder_last_sent_at dedup — that's a nag-throttle concern, not a
 * classification one): RED if any open deliverable is overdue; AMBER if a
 * deliverable is due within 3 days OR a non-blocked cadence stream is
 * overdue; GREEN otherwise. Blocked cadence streams never affect the RAG —
 * same as cadence-health.mjs's blockedStreams, informational only.
 *
 * NOT wired into decideSweepActions/sweepWorkItems yet. LPG's own
 * cadence-health.mjs cron still owns its daily 17:00 alert during the
 * dual-write trial; wiring this into a live wake here would double-nag LPG
 * and pollute the trial's "zero missed/extra nags" parity measurement. Land
 * this ready for the cutover the trial is gating, not before it.
 */
export function computeDailyRagRollup(
  items: WorkItem[],
  opts: { today: string; tz?: string },
): Map<string, DailyRagRollup> {
  const tz = opts.tz ?? TIMEZONE;
  const byTeam = new Map<string, DailyRagRollup>();
  const rollupFor = (team: string): DailyRagRollup => {
    let r = byTeam.get(team);
    if (!r) {
      r = { rag: 'GREEN', overdueDeliverables: [], soonDeliverables: [], overdueStreams: [], blockedStreams: [] };
      byTeam.set(team, r);
    }
    return r;
  };

  for (const item of items) {
    if (item.status === 'done' || item.status === 'cancelled') continue;
    if (item.kind !== 'deliverable' && item.kind !== 'cadence') continue;

    if (item.kind === 'deliverable') {
      const dueYmd = toLocalYmd(item.due_at, tz);
      if (!dueYmd) continue;
      const r = rollupFor(item.owner_agent_group_id);
      const daysUntil = daysBetween(opts.today, dueYmd);
      if (daysUntil < 0) r.overdueDeliverables.push(item);
      else if (daysUntil <= 3) r.soonDeliverables.push(item);
      continue;
    }

    // kind === 'cadence' — always establishes a (possibly GREEN) entry for
    // its team, since a fully-serviced or not-yet-due stream is still a
    // real, currently-healthy tracked obligation, not an untracked team.
    const r = rollupFor(item.owner_agent_group_id);
    const expected = Number(item.cadence_expected_dow) || 7;
    if (isoDow(opts.today) < expected) continue;
    if (item.cadence_last_completed_period === isoWeek(opts.today)) continue;
    if (item.status === 'blocked') r.blockedStreams.push(item);
    else r.overdueStreams.push(item);
  }

  for (const r of byTeam.values()) {
    r.rag = r.overdueDeliverables.length
      ? 'RED'
      : r.overdueStreams.length || r.soonDeliverables.length
        ? 'AMBER'
        : 'GREEN';
  }
  return byTeam;
}

interface SweepStamp {
  id: string;
  owner_agent_group_id: string;
  reminder_tier?: string;
  reminder_last_sent_at: string;
}

export interface SweepDecision {
  /** owner team → message lines to include in that team's single wake */
  wakes: Map<string, string[]>;
  stamps: SweepStamp[];
}

/** Full pure decision over all live items — the unit-tested core. */
export function decideSweepActions(
  items: WorkItem[],
  opts: { nowMs: number; today: string; tz?: string },
): SweepDecision {
  const tz = opts.tz ?? TIMEZONE;
  const wakes = new Map<string, string[]>();
  const stamps: SweepStamp[] = [];
  const push = (team: string, line: string): void => {
    let lines = wakes.get(team);
    if (!lines) {
      lines = [];
      wakes.set(team, lines);
    }
    lines.push(line);
  };
  const nowIso = new Date(opts.nowMs).toISOString();
  // Blocked cadence items are deferred to a second pass (below) — whether
  // they ride along informationally depends on whether their owner team
  // ends up woken by something ELSE this tick, which isn't known until
  // every item has been processed once, regardless of array order.
  const deferredBlockedCadence: WorkItem[] = [];

  for (const item of items) {
    // 1. Delegation follow-up
    if (decideDelegationNag(item, opts.nowMs)) {
      const who = item.assignee_agent_group_id ?? item.assignee_label ?? item.assignee_user_id ?? 'unassigned';
      push(
        item.owner_agent_group_id,
        `- OPEN follow-up "${item.title}" (${item.id}, to ${who}) was due a check-in at ${item.follow_up_at}. Chase it or close it (update_work_item / complete_work_item); this nag repeats until the item leaves open status.`,
      );
      stamps.push({ id: item.id, owner_agent_group_id: item.owner_agent_group_id, reminder_last_sent_at: nowIso });
      continue;
    }

    // 2. Deliverable tier cascade
    const fired = decideDeliverableTier(item, opts.today, tz);
    if (fired) {
      const owners = item.assignee_label ?? item.assignee_user_id ?? 'the owners';
      const whenStr =
        fired.tier === 'missed'
          ? `OVERDUE (was due ${toLocalYmd(item.due_at, tz)})`
          : `due in ${fired.daysUntil} day${fired.daysUntil === 1 ? '' : 's'} (${toLocalYmd(item.due_at, tz)})`;
      push(
        item.owner_agent_group_id,
        `- Deliverable "${item.title}" (${item.id}) — ${whenStr}. Remind ${owners}; mark it done with complete_work_item when supplied.`,
      );
      stamps.push({
        id: item.id,
        owner_agent_group_id: item.owner_agent_group_id,
        reminder_tier: String(fired.tier),
        reminder_last_sent_at: nowIso,
      });
      continue;
    }

    // 3. Cadence RAG. A blocked stream can't be un-blocked by the owner team
    // alone — parity with cadence-health.mjs, whose blockedStreams are
    // excluded from RAG/wakeAgent entirely and only ever appear as
    // informational data when the agent is already awake for another
    // reason. So a blocked item must NOT stand up a wake on its own;
    // defer it to the second pass below.
    if (decideCadenceOverdue(item, opts.today, tz)) {
      if (item.status === 'blocked') {
        deferredBlockedCadence.push(item);
        continue;
      }
      push(
        item.owner_agent_group_id,
        `- Weekly stream "${item.title}" (${item.id}) has not been completed for ${isoWeek(opts.today)} (expected by ISO weekday ${item.cadence_expected_dow}). If it actually shipped, stamp it with complete_work_item; otherwise recover it and alert the owners.`,
      );
      stamps.push({ id: item.id, owner_agent_group_id: item.owner_agent_group_id, reminder_last_sent_at: nowIso });
    }
  }

  // Second pass: a blocked cadence item only gets an informational line if
  // its owner team is ALREADY being woken for something else this tick. A
  // team blocked-alone stays completely silent (and unstamped, so it's
  // re-considered — and can ride along — on a later tick today rather than
  // waiting until tomorrow).
  for (const item of deferredBlockedCadence) {
    if (!wakes.has(item.owner_agent_group_id)) continue;
    push(
      item.owner_agent_group_id,
      `- Weekly stream "${item.title}" (${item.id}) is BLOCKED for ${isoWeek(opts.today)} (not counted as overdue): ${item.status_detail ?? 'no detail recorded'}. Informational only — no chase needed unless the blocker clears.`,
    );
    stamps.push({ id: item.id, owner_agent_group_id: item.owner_agent_group_id, reminder_last_sent_at: nowIso });
  }

  return { wakes, stamps };
}

/**
 * Applies a sweep tick: stamp dedup state FIRST (per owner team — only for
 * teams with a live session to actually receive the wake), then refresh +
 * wake each team.
 */
export async function sweepWorkItems(): Promise<void> {
  const db = rawDb();
  if (!hasTableSync('work_items')) return;

  const items = db
    .prepare(
      `SELECT * FROM work_items
        WHERE status IN ('open', 'in_progress', 'blocked')
          AND (follow_up_at IS NOT NULL OR kind IN ('deliverable', 'cadence'))`,
    )
    .all() as WorkItem[];
  if (items.length === 0) return;

  const decision = decideSweepActions(items, { nowMs: Date.now(), today: todayInTz(TIMEZONE) });
  if (decision.stamps.length === 0) return;

  // Resolve session liveness per owner team BEFORE stamping. Stamping is what
  // suppresses re-nagging next tick, so a team with no live session must not
  // get its items stamped — that would mark the reminder "sent" when nothing
  // was ever delivered, silently losing that tier/cadence nag for good (it
  // would never re-fire once the tier/day dedup stamp is in place). Teams
  // that DO have a session still get the original write-before-wake
  // guarantee: a forgotten/failed wake must not cause duplicate reminders
  // next tick (the dependency-cascade.mjs write-before-output rule).
  const sessionByTeam = new Map(
    [...decision.wakes.keys()].map((team) => [team, findSessionByAgentGroupSync(team)] as const),
  );
  const stampable = decision.stamps.filter((s) => sessionByTeam.get(s.owner_agent_group_id) != null);
  const skipped = decision.stamps.length - stampable.length;
  if (skipped > 0) {
    log.warn('work-items sweep: skipping stamp for no-session teams (will retry next tick)', { skipped });
  }

  const stampStmt = db.prepare(
    `UPDATE work_items
        SET reminder_tier = COALESCE(@reminder_tier, reminder_tier),
            reminder_last_sent_at = @reminder_last_sent_at
      WHERE id = @id`,
  );
  const applyStamps = db.transaction(() => {
    for (const s of stampable) {
      stampStmt.run({
        id: s.id,
        reminder_tier: s.reminder_tier ?? null,
        reminder_last_sent_at: s.reminder_last_sent_at,
      });
    }
  });
  applyStamps();

  for (const [team, lines] of decision.wakes) {
    refreshWorkItemsProjection(team);
    const session = sessionByTeam.get(team);
    if (!session) {
      log.warn('work-items sweep: no active session to wake', { team, lines: lines.length });
      continue;
    }
    const message = `[work-items sweep] ${lines.length} item${lines.length === 1 ? '' : 's'} need${lines.length === 1 ? 's' : ''} attention:\n${lines.join('\n')}`;
    // Fire-and-forget: sweepWorkItems' callers are synchronous, so the async
    // notify is dispatched with its own rejection handler.
    void Promise.resolve(notifyAgent(session, message)).catch((err) =>
      log.error('work-items sweep: notifyAgent failed', { team, err }),
    );
    log.info('work-items sweep wake', { team, items: lines.length });
  }
}
