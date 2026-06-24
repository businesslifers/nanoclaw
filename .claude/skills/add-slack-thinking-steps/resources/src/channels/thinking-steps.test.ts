import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { ThinkingStepsManager, type ThinkingStep } from './thinking-steps.js';

// Consumer side of Slack "thinking steps". These tests pin the behaviors the
// pre-mortem flagged as the real production risks: rate-limit throttling
// (burst → few API calls), the Block-Kit block cap, the noise threshold,
// finalize→Done, and stale-turn eviction.

interface Call {
  tid: string;
  msgId?: string;
  data: { title: string; tasks: Array<{ id: string; title: string; status: string; output?: string }> };
}

function stubAdapter(opts: { postDelayMs?: number } = {}) {
  const posts: Call[] = [];
  const edits: Call[] = [];
  let n = 0;
  const adapter = {
    name: 'slack',
    async postObject(tid: string, _kind: string, data: unknown) {
      const id = `ts-${++n}`;
      // Simulate a real chat.postMessage round-trip so a `complete` can land
      // while the first post is still in flight (exercises the evict race).
      if (opts.postDelayMs) await new Promise<void>((r) => setTimeout(r, opts.postDelayMs));
      posts.push({ tid, data: data as Call['data'] });
      return { id };
    },
    async editObject(tid: string, msgId: string, _kind: string, data: unknown) {
      edits.push({ tid, msgId, data: data as Call['data'] });
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return { adapter, posts, edits };
}

const TID = 'slack:C1:1699.1';
const task = (turn: string, id: string, title: string): ThinkingStep => ({
  op: 'task',
  turn,
  taskId: id,
  title,
  status: 'in_progress',
});
const update = (turn: string, id: string, status: 'complete' | 'error', output?: string): ThinkingStep => ({
  op: 'update',
  turn,
  taskId: id,
  status,
  output,
});
const complete = (turn: string): ThinkingStep => ({ op: 'complete', turn });

describe('ThinkingStepsManager', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    delete process.env.NANOCLAW_THINKING_STEPS;
  });

  it('throttles a burst into one post + one edit (not one call per step)', async () => {
    const { adapter, posts, edits } = stubAdapter();
    const mgr = new ThinkingStepsManager();
    // Two tasks → over the noise threshold.
    mgr.onStep(adapter, TID, task('t', 'a', 'Read a'));
    mgr.onStep(adapter, TID, task('t', 'b', 'Read b'));
    await vi.advanceTimersByTimeAsync(1300);
    expect(posts.length).toBe(1);
    expect(posts[0].data.tasks.map((x) => x.id)).toEqual(['a', 'b']);

    // A burst of completions collapses into a single edit.
    mgr.onStep(adapter, TID, update('t', 'a', 'complete', 'done a'));
    mgr.onStep(adapter, TID, update('t', 'b', 'complete', 'done b'));
    await vi.advanceTimersByTimeAsync(1300);
    expect(edits.length).toBe(1);
    expect(edits[0].data.tasks.every((x) => x.status === 'complete')).toBe(true);
  });

  it('does not post a card for a trivial fast turn (1 quick tool)', async () => {
    const { adapter, posts, edits } = stubAdapter();
    const mgr = new ThinkingStepsManager();
    mgr.onStep(adapter, TID, task('t', 'a', 'Read a'));
    mgr.onStep(adapter, TID, update('t', 'a', 'complete'));
    mgr.onStep(adapter, TID, complete('t'));
    await vi.advanceTimersByTimeAsync(5000);
    expect(posts.length).toBe(0);
    expect(edits.length).toBe(0);
  });

  it('posts a card for a single slow tool once it has been running ~3s', async () => {
    const { adapter, posts } = stubAdapter();
    const mgr = new ThinkingStepsManager();
    mgr.onStep(adapter, TID, task('t', 'a', 'Long running'));
    await vi.advanceTimersByTimeAsync(2000); // still under the 3s gate
    expect(posts.length).toBe(0);
    await vi.advanceTimersByTimeAsync(2000); // now past it
    expect(posts.length).toBe(1);
  });

  it('caps the visible task list and folds older finished tasks into a head', async () => {
    const { adapter, posts, edits } = stubAdapter();
    const mgr = new ThinkingStepsManager();
    for (let i = 0; i < 30; i++) {
      mgr.onStep(adapter, TID, task('t', `k${i}`, `Step ${i}`));
      mgr.onStep(adapter, TID, update('t', `k${i}`, 'complete'));
    }
    await vi.advanceTimersByTimeAsync(1300);
    const rendered = (edits.at(-1) ?? posts.at(-1))!.data.tasks;
    // ≤ MAX_VISIBLE_TASKS (20) real tasks + at most one synthetic head.
    expect(rendered.length).toBeLessThanOrEqual(21);
    expect(rendered.some((x) => x.id === '__collapsed__')).toBe(true);
  });

  it('posts ONE final card for a fast multi-tool turn that completes before the first flush tick', async () => {
    // >=2 tools that finish (and the turn completes) before the 1.2s throttle —
    // the whole turn arrives in one delivery drain. Must still post exactly one
    // (already-finalized) card, not silently drop it.
    const { adapter, posts, edits } = stubAdapter();
    const mgr = new ThinkingStepsManager();
    mgr.onStep(adapter, TID, task('t', 'a', 'Read a'));
    mgr.onStep(adapter, TID, task('t', 'b', 'Run ls'));
    mgr.onStep(adapter, TID, update('t', 'a', 'complete'));
    mgr.onStep(adapter, TID, update('t', 'b', 'complete'));
    mgr.onStep(adapter, TID, complete('t'));
    await vi.advanceTimersByTimeAsync(50);
    expect(posts.length).toBe(1);
    expect(edits.length).toBe(0);
    expect(posts[0].data.title).toBe('Done');
    expect(posts[0].data.tasks.every((x) => x.status === 'complete')).toBe(true);
  });

  it('still finalizes to Done when `complete` lands while the first post is in flight', async () => {
    // The evict() race: complete arrives mid-postObject. The finalize must run
    // AFTER the post resolves (on the chain) and edit the card to Done — not get
    // dropped, leaving a stuck spinner.
    const { adapter, posts, edits } = stubAdapter({ postDelayMs: 300 });
    const mgr = new ThinkingStepsManager();
    mgr.onStep(adapter, TID, task('t', 'a', 'A'));
    mgr.onStep(adapter, TID, task('t', 'b', 'B'));
    await vi.advanceTimersByTimeAsync(1200); // flush fires → postObject starts, now in flight
    expect(posts.length).toBe(0); // not resolved yet
    mgr.onStep(adapter, TID, complete('t')); // complete lands during the in-flight post
    await vi.advanceTimersByTimeAsync(400); // post resolves, then the queued finalize runs
    expect(posts.length).toBe(1);
    expect(edits.length).toBeGreaterThanOrEqual(1);
    expect(edits.at(-1)!.data.title).toBe('Done');
    expect(edits.at(-1)!.data.tasks.every((x) => x.status === 'complete')).toBe(true);
  });

  it('finalize flips the card title to Done and completes any open task', async () => {
    const { adapter, posts, edits } = stubAdapter();
    const mgr = new ThinkingStepsManager();
    mgr.onStep(adapter, TID, task('t', 'a', 'A'));
    mgr.onStep(adapter, TID, task('t', 'b', 'B')); // b stays in_progress
    await vi.advanceTimersByTimeAsync(1300);
    expect(posts.length).toBe(1);
    mgr.onStep(adapter, TID, complete('t'));
    await vi.advanceTimersByTimeAsync(50);
    const last = edits.at(-1)!;
    expect(last.data.title).toBe('Done');
    expect(last.data.tasks.every((x) => x.status === 'complete')).toBe(true);
  });

  it('evicts a stale prior turn on the same thread when a new turn starts', async () => {
    const { adapter, posts, edits } = stubAdapter();
    const mgr = new ThinkingStepsManager();
    // Turn A posts a card but never sends `complete`.
    mgr.onStep(adapter, TID, task('A', 'a1', 'A1'));
    mgr.onStep(adapter, TID, task('A', 'a2', 'A2'));
    await vi.advanceTimersByTimeAsync(1300);
    expect(posts.length).toBe(1);
    const editsBefore = edits.length;
    // Turn B (same thread, new turn id) → A is finalized, B is independent.
    mgr.onStep(adapter, TID, task('B', 'b1', 'B1'));
    mgr.onStep(adapter, TID, task('B', 'b2', 'B2'));
    await vi.advanceTimersByTimeAsync(1300);
    expect(edits.length).toBeGreaterThan(editsBefore); // A got a finalize edit
    expect(posts.length).toBe(2); // B posted its own card
    expect(posts[1].data.tasks.map((x) => x.id)).toEqual(['b1', 'b2']);
  });

  it('is a no-op when disabled via NANOCLAW_THINKING_STEPS=0', async () => {
    process.env.NANOCLAW_THINKING_STEPS = '0';
    const { adapter, posts, edits } = stubAdapter();
    const mgr = new ThinkingStepsManager();
    mgr.onStep(adapter, TID, task('t', 'a', 'A'));
    mgr.onStep(adapter, TID, task('t', 'b', 'B'));
    await vi.advanceTimersByTimeAsync(2000);
    expect(posts.length).toBe(0);
    expect(edits.length).toBe(0);
  });

  it('is a no-op on adapters without postObject/editObject', async () => {
    const mgr = new ThinkingStepsManager();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const plain = { name: 'telegram' } as any;
    expect(() => {
      mgr.onStep(plain, TID, task('t', 'a', 'A'));
      mgr.onStep(plain, TID, complete('t'));
    }).not.toThrow();
    await vi.advanceTimersByTimeAsync(2000);
  });
});
