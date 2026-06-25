/**
 * Slack "thinking steps" — a live Block Kit "plan" card that fills with the
 * agent's tool calls as they run, then finalizes to "Done".
 *
 * Driven by `thinking_step` outbound rows (producer: the agent-runner decomposes
 * the Claude SDK tool stream in poll-loop.ts). We manage the plan model OURSELVES
 * and flush it to the adapter via `postObject`/`editObject` (on Slack →
 * chat.postMessage / chat.update) on a throttle. This is deliberate: it collapses
 * a burst of step changes into ONE Slack API call per tick, which is the only way
 * to bound BOTH the update rate (Slack tolerates ~1 update/sec/message) and the
 * Block Kit block count (~50-block ceiling). The Chat SDK's `Plan` helper does
 * neither — it issues one chat.update per task mutation and never caps tasks.
 *
 * Everything here is best-effort: failures are swallowed + logged and a step
 * never blocks the agent's real reply. Adapters without postObject/editObject
 * (every non-Slack channel today) make the whole feature a silent no-op.
 *
 * Turn lifecycle:
 *   - task/update rows  → onStep() mutates the in-memory model + schedules a flush
 *   - complete row      → finalize() flips the card to "Done" and evicts the turn
 *   - 5-min timeout     → finalize a turn whose container died before completing
 *   - new turn, same tid → evicts any stale prior turn first
 */
import type { Adapter } from 'chat';
import { log } from '../log.js';

type PlanTaskStatus = 'in_progress' | 'complete' | 'error';

/** The plan model shape the adapter's `postObject('plan', …)` renders. */
interface PlanTask {
  id: string;
  title: string;
  status: PlanTaskStatus;
  output?: string;
}
interface PlanModel {
  title: string;
  tasks: PlanTask[];
}

/** Parsed `thinking_step` row content (producer: poll-loop.ts). */
export interface ThinkingStep {
  op: 'task' | 'update' | 'complete';
  turn?: string;
  taskId?: string;
  title?: string;
  status?: 'in_progress' | 'complete' | 'error';
  output?: string;
}

/** Adapter subset we need. Slack implements both; others omit them (→ no-op). */
interface PlanCapableAdapter {
  postObject?(threadId: string, kind: string, data: unknown): Promise<{ id: string } | undefined>;
  editObject?(threadId: string, messageId: string, kind: string, data: unknown): Promise<unknown>;
}

const FLUSH_INTERVAL_MS = 1200; // ≥ Slack's ~1 update/sec/message guidance
const MAX_VISIBLE_TASKS = 20; // keep well under Block Kit's ~50-block ceiling
const TURN_TIMEOUT_MS = 5 * 60_000; // finalize abandoned turns (container died, host missed `complete`)
const MIN_TASKS_BEFORE_CARD = 2; // noise gate: don't post a card for trivial turns…
const MIN_ELAPSED_BEFORE_CARD_MS = 3000; // …unless a single tool has been running a while
const WORKING_TITLE = 'Working…';
const DONE_TITLE = 'Done';
const STOPPED_TITLE = 'Stopped';

interface TurnState {
  adapter: PlanCapableAdapter;
  tid: string;
  key: string;
  title: string;
  tasksById: Map<string, PlanTask>; // insertion-ordered: iteration order == display order
  collapsedDone: number; // completed tasks folded into the synthetic head, for the cap
  msgId?: string;
  posted: boolean;
  dirty: boolean;
  startedAt: number;
  flushTimer?: ReturnType<typeof setTimeout>;
  timeoutTimer?: ReturnType<typeof setTimeout>;
  chain: Promise<void>; // serializes post/edit so two flushes never race the same message
}

export class ThinkingStepsManager {
  private turns = new Map<string, TurnState>();

  /** Handle one parsed `thinking_step` row. Synchronous & non-blocking. */
  onStep(adapter: Adapter, tid: string, step: ThinkingStep): void {
    const cap = adapter as unknown as PlanCapableAdapter;
    if (!this.enabled(cap)) return;
    try {
      if (step.op === 'complete') {
        this.finalize(tid, step.turn, DONE_TITLE);
        return;
      }
      const key = this.turnKey(tid, step.turn);
      // Evict any prior turn on the same thread (one whose `complete` never
      // arrived — e.g. its container died) so its steps don't bleed into this
      // one and two cards don't linger. ASSUMES one active session per Slack
      // thread, which holds for this install (every messaging group wires a
      // single agent; team channels get dedicated agents). If two agent groups
      // were ever wired to one channel concurrently, this would finalize the
      // other session's live card — the proper fix is to key turns on a
      // session-qualified id plumbed through deliver().
      for (const [k, st] of this.turns) {
        if (k !== key && st.tid === tid) this.evict(st, DONE_TITLE);
      }
      let st = this.turns.get(key);
      if (!st) {
        st = this.newTurn(cap, tid, key);
        this.turns.set(key, st);
      }
      this.applyStep(st, step);
      this.scheduleFlush(st);
    } catch (err) {
      log.warn('thinking-steps onStep failed', { err });
    }
  }

  /** Finalize a turn's card (idempotent). Called on `complete`, timeout, or eviction. */
  private finalize(tid: string, turn: string | undefined, title: string): void {
    const st = this.turns.get(this.turnKey(tid, turn));
    if (!st) return;
    this.evict(st, title);
  }

  private evict(st: TurnState, finalTitle: string): void {
    if (st.flushTimer) clearTimeout(st.flushTimer);
    if (st.timeoutTimer) clearTimeout(st.timeoutTimer);
    st.flushTimer = undefined;
    st.timeoutTimer = undefined;
    this.turns.delete(st.key);
    // Mark the final state, then ALWAYS enqueue the finalize onto the chain.
    // We must NOT branch on st.posted here: it only flips true after an awaited
    // postObject resolves inside the chain, so a synchronous check can race a
    // first post that is still in flight (→ a card stuck on "Working…" with no
    // path to finalize, since the turn is already evicted and its timers cleared).
    // The chained flush re-reads st.posted after any pending post has settled.
    st.title = finalTitle;
    for (const t of st.tasksById.values()) {
      if (t.status === 'in_progress') t.status = 'complete';
    }
    st.dirty = true;
    this.flush(st, true);
  }

  private newTurn(adapter: PlanCapableAdapter, tid: string, key: string): TurnState {
    const st: TurnState = {
      adapter,
      tid,
      key,
      title: WORKING_TITLE,
      tasksById: new Map(),
      collapsedDone: 0,
      posted: false,
      dirty: false,
      startedAt: Date.now(),
      chain: Promise.resolve(),
    };
    st.timeoutTimer = setTimeout(() => this.evict(st, STOPPED_TITLE), TURN_TIMEOUT_MS);
    return st;
  }

  private applyStep(st: TurnState, step: ThinkingStep): void {
    if (!step.taskId) return;
    const status: PlanTaskStatus = step.status ?? 'in_progress';
    const existing = st.tasksById.get(step.taskId);
    if (existing) {
      existing.status = status;
      if (step.title) existing.title = step.title;
      if (step.output) existing.output = step.output;
    } else if (step.op === 'task') {
      st.tasksById.set(step.taskId, { id: step.taskId, title: step.title ?? '…', status, output: step.output });
      this.capTasks(st);
    }
    // An `update` for an unknown taskId (e.g. one already collapsed by the cap)
    // is intentionally dropped — its work is already summarized in the head.
    st.dirty = true;
  }

  /** Keep the visible task list bounded; fold the oldest *finished* tasks away. */
  private capTasks(st: TurnState): void {
    while (st.tasksById.size > MAX_VISIBLE_TASKS) {
      // tasksById iterates in insertion order — fold away the oldest *finished* task.
      let oldestFinished: string | undefined;
      for (const [id, t] of st.tasksById) {
        if (t.status === 'complete' || t.status === 'error') {
          oldestFinished = id;
          break;
        }
      }
      if (oldestFinished === undefined) break; // nothing finished yet — leave it (rare)
      st.tasksById.delete(oldestFinished);
      st.collapsedDone++;
    }
  }

  private buildModel(st: TurnState): PlanModel {
    const tasks: PlanTask[] = [];
    if (st.collapsedDone > 0) {
      tasks.push({
        id: '__collapsed__',
        title: `${st.collapsedDone} earlier step${st.collapsedDone > 1 ? 's' : ''}`,
        status: 'complete',
      });
    }
    for (const t of st.tasksById.values()) {
      tasks.push(t);
    }
    return { title: st.title, tasks };
  }

  private scheduleFlush(st: TurnState): void {
    if (st.flushTimer) return; // a flush is already pending
    st.flushTimer = setTimeout(() => {
      st.flushTimer = undefined;
      this.flush(st, false);
    }, FLUSH_INTERVAL_MS);
  }

  private flush(st: TurnState, finalizing: boolean): void {
    st.chain = st.chain
      .then(async () => {
        if (!st.dirty && !finalizing) return;
        // Noise gate, evaluated HERE (not at schedule/evict time) so it sees the
        // outcome of any prior in-flight post. A turn that never crosses the gate
        // gets no card — including a fast turn that completes before the first
        // tick (then `finalizing` is true and we still skip a sub-gate turn).
        if (!st.posted && !this.shouldPost(st)) {
          if (!finalizing) this.scheduleFlush(st); // a live turn: re-check next tick
          return;
        }
        const model = this.buildModel(st);
        st.dirty = false;
        try {
          if (!st.posted) {
            // First render. For a fast turn that crossed the gate and is already
            // finalizing, this posts the completed card in one shot.
            const res = await st.adapter.postObject?.(st.tid, 'plan', model);
            if (res?.id) {
              st.msgId = res.id;
              st.posted = true;
            }
          } else if (st.msgId) {
            await st.adapter.editObject?.(st.tid, st.msgId, 'plan', model);
          }
        } catch (err) {
          log.warn('thinking-steps flush failed', { tid: st.tid, err });
        }
      })
      .catch((err) => log.warn('thinking-steps chain error', { err }));
  }

  /** Whether this turn has done enough to warrant a visible card (noise gate). */
  private shouldPost(st: TurnState): boolean {
    const tasks = st.tasksById.size + st.collapsedDone;
    if (tasks === 0) return false;
    return tasks >= MIN_TASKS_BEFORE_CARD || Date.now() - st.startedAt >= MIN_ELAPSED_BEFORE_CARD_MS;
  }

  private enabled(adapter: PlanCapableAdapter): boolean {
    return (
      process.env.NANOCLAW_THINKING_STEPS !== '0' &&
      typeof adapter.postObject === 'function' &&
      typeof adapter.editObject === 'function'
    );
  }

  private turnKey(tid: string, turn: string | undefined): string {
    return `${tid}::${turn ?? 'default'}`;
  }
}
