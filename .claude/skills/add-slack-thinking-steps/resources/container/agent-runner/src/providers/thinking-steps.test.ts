import { describe, it, expect } from 'bun:test';

import { decomposeToolSteps } from './claude.js';

// Producer side of Slack "thinking steps": turn the Claude Agent SDK's
// assistant(tool_use) / user(tool_result) message stream into tool_step events.
// These fixtures mirror the real SDK shapes (SDKAssistantMessage.message is a
// BetaMessage, SDKUserMessage.message is a MessageParam — content blocks live
// at message.message.content).

function assistant(content: unknown[]): unknown {
  return { type: 'assistant', message: { role: 'assistant', content } };
}
function user(content: unknown[]): unknown {
  return { type: 'user', message: { role: 'user', content } };
}

describe('decomposeToolSteps', () => {
  it('emits an in_progress step for a tool_use, then a matching complete', () => {
    const titles = new Map<string, string>();
    const start = decomposeToolSteps(
      assistant([
        { type: 'text', text: 'let me check' },
        { type: 'tool_use', id: 'toolu_1', name: 'Read', input: { file_path: '/workspace/agent/package.json' } },
      ]),
      titles,
    );
    expect(start).toEqual([{ type: 'tool_step', toolId: 'toolu_1', title: 'Read package.json', status: 'in_progress' }]);

    const end = decomposeToolSteps(
      user([{ type: 'tool_result', tool_use_id: 'toolu_1', content: 'ok\nmore', is_error: false }]),
      titles,
    );
    expect(end).toEqual([{ type: 'tool_step', toolId: 'toolu_1', title: 'Read package.json', status: 'complete', output: 'ok' }]);
    // map cleared after completion
    expect(titles.size).toBe(0);
  });

  it('marks errored tool_results as status:error', () => {
    const titles = new Map<string, string>();
    decomposeToolSteps(assistant([{ type: 'tool_use', id: 't2', name: 'Bash', input: { command: 'false' } }]), titles);
    const end = decomposeToolSteps(user([{ type: 'tool_result', tool_use_id: 't2', content: 'boom', is_error: true }]), titles);
    expect(end[0]).toMatchObject({ toolId: 't2', status: 'error', output: 'boom' });
  });

  it('prefers Bash description over the raw command', () => {
    const titles = new Map<string, string>();
    const s = decomposeToolSteps(
      assistant([{ type: 'tool_use', id: 'b', name: 'Bash', input: { command: 'git log --oneline -20', description: 'List recent commits' } }]),
      titles,
    );
    expect(s[0].title).toBe('List recent commits');
  });

  it('humanizes MCP tool names (mcp__server__tool → "server: tool")', () => {
    const titles = new Map<string, string>();
    const s = decomposeToolSteps(
      assistant([{ type: 'tool_use', id: 'm', name: 'mcp__clickup__create_task', input: {} }]),
      titles,
    );
    expect(s[0].title).toBe('clickup: create task');
  });

  it('skips noise tools (TodoWrite, the agent\'s own messaging tools)', () => {
    const titles = new Map<string, string>();
    const s = decomposeToolSteps(
      assistant([
        { type: 'tool_use', id: 'x1', name: 'TodoWrite', input: { todos: [] } },
        { type: 'tool_use', id: 'x2', name: 'mcp__nanoclaw__send_message', input: { text: 'hi' } },
        { type: 'tool_use', id: 'x3', name: 'mcp__nanoclaw__ask_user_question', input: {} },
      ]),
      titles,
    );
    expect(s).toEqual([]);
    expect(titles.size).toBe(0);
    // …and their tool_results produce nothing (never entered the map)
    const e = decomposeToolSteps(user([{ type: 'tool_result', tool_use_id: 'x1', content: 'done' }]), titles);
    expect(e).toEqual([]);
  });

  it('skips subagent-internal blocks (parent_tool_use_id set)', () => {
    const titles = new Map<string, string>();
    // The parent Task tool_use (top-level) IS surfaced…
    const parent = decomposeToolSteps(assistant([{ type: 'tool_use', id: 'task1', name: 'Task', input: { description: 'research X' } }]), titles);
    expect(parent).toEqual([{ type: 'tool_step', toolId: 'task1', title: 'Subagent: research X', status: 'in_progress' }]);
    // …but the Read/Bash the subagent runs internally (parent_tool_use_id set) is NOT.
    const inner = decomposeToolSteps(
      { type: 'assistant', parent_tool_use_id: 'task1', message: { content: [{ type: 'tool_use', id: 'inner1', name: 'Read', input: { file_path: '/x.ts' } }] } },
      titles,
    );
    expect(inner).toEqual([]);
    const innerResult = decomposeToolSteps(
      { type: 'user', parent_tool_use_id: 'task1', message: { content: [{ type: 'tool_result', tool_use_id: 'inner1', content: 'ok' }] } },
      titles,
    );
    expect(innerResult).toEqual([]);
  });

  it('ignores a tool_result whose tool_use was never started (pre-window / capped)', () => {
    const titles = new Map<string, string>();
    const e = decomposeToolSteps(user([{ type: 'tool_result', tool_use_id: 'unknown', content: 'x' }]), titles);
    expect(e).toEqual([]);
  });

  it('summarizes array-form tool_result content and clamps long output', () => {
    const titles = new Map<string, string>();
    decomposeToolSteps(assistant([{ type: 'tool_use', id: 'g', name: 'Grep', input: { pattern: 'foo' } }]), titles);
    const long = 'A'.repeat(500);
    const e = decomposeToolSteps(
      user([{ type: 'tool_result', tool_use_id: 'g', content: [{ type: 'text', text: long }] }]),
      titles,
    );
    expect(e[0].title).toBe('Search "foo"');
    expect((e[0].output ?? '').length).toBeLessThanOrEqual(200);
    expect(e[0].output?.endsWith('…')).toBe(true);
  });

  it('emits nothing for non tool messages (result/system/text-only assistant)', () => {
    const titles = new Map<string, string>();
    expect(decomposeToolSteps({ type: 'result', result: 'done' }, titles)).toEqual([]);
    expect(decomposeToolSteps({ type: 'system', subtype: 'init' }, titles)).toEqual([]);
    expect(decomposeToolSteps(assistant([{ type: 'text', text: 'just talking' }]), titles)).toEqual([]);
  });

  it('does not throw on malformed messages', () => {
    const titles = new Map<string, string>();
    expect(() => decomposeToolSteps(null, titles)).not.toThrow();
    expect(() => decomposeToolSteps({ type: 'assistant' }, titles)).not.toThrow();
    expect(() => decomposeToolSteps({ type: 'assistant', message: { content: 'not-an-array' } }, titles)).not.toThrow();
  });
});
