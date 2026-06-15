import { describe, expect, it, afterEach } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';

import {
  type AppServer,
  attachCodexAutoApproval,
  buildCodexProcessEnv,
  tomlBasicString,
  writeCodexConfigToml,
} from './codex-app-server.js';

let tmpHome: string | null = null;
const originalHome = process.env.HOME;

afterEach(() => {
  process.env.HOME = originalHome;
  if (tmpHome) {
    fs.rmSync(tmpHome, { recursive: true, force: true });
    tmpHome = null;
  }
});

describe('Codex config TOML', () => {
  it('escapes basic strings', () => {
    expect(tomlBasicString('a "quoted" \\\\ value')).toBe('"a \\"quoted\\" \\\\\\\\ value"');
  });

  it('rejects newlines', () => {
    expect(() => tomlBasicString('bad\nvalue')).toThrow(/newline/);
  });

  it('hardcodes danger-full-access + never and writes model, effort, and MCP servers', () => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-home-'));
    process.env.HOME = tmpHome;

    writeCodexConfigToml(
      {
        nanoclaw: {
          command: 'bun',
          args: ['run', '/app/src/mcp-tools/index.ts'],
          env: { FOO: 'bar' },
        },
      },
      { model: 'gpt-5', effort: 'medium' },
    );

    const content = fs.readFileSync(path.join(tmpHome, '.codex', 'config.toml'), 'utf-8');
    expect(content).toContain('sandbox_mode = "danger-full-access"');
    expect(content).toContain('approval_policy = "never"');
    expect(content).toContain('project_doc_max_bytes = 32768');
    expect(content).toContain('model = "gpt-5"');
    expect(content).toContain('model_reasoning_effort = "medium"');
    expect(content).not.toContain('[sandbox_workspace_write]');
    expect(content).not.toContain('writable_roots =');
    expect(content).toContain('[mcp_servers.nanoclaw]');
    expect(content).toContain('command = "bun"');
    expect(content).toContain('args = ["run", "/app/src/mcp-tools/index.ts"]');
    expect(content).toContain('[mcp_servers.nanoclaw.env]');
    expect(content).toContain('FOO = "bar"');
  });
});

describe('Codex auto-approval', () => {
  // NanoClaw (container isolation + OneCLI) is the boundary, so the handler accepts
  // every request unconditionally — even paths/commands a sandbox policy would refuse.
  it('grants full filesystem + network for permission requests', () => {
    const { server, writes } = fakeServer();
    attachCodexAutoApproval(server);

    server.serverRequestHandlers[0]({
      id: 1,
      method: 'item/permissions/requestApproval',
      params: { permissions: { fileSystem: { read: ['/workspace/agent'], write: ['/workspace/agent'] } } },
    });

    const result = JSON.parse(writes[0]).result as {
      permissions: { fileSystem: { read: string[]; write: string[] }; network: { enabled: boolean } };
      scope: string;
    };
    expect(result.scope).toBe('turn');
    expect(result.permissions.fileSystem.read).toEqual(['/']);
    expect(result.permissions.fileSystem.write).toEqual(['/']);
    expect(result.permissions.network.enabled).toBe(true);
  });

  it('accepts file-change and command-exec approvals regardless of path', () => {
    const { server, writes } = fakeServer();
    attachCodexAutoApproval(server);

    server.serverRequestHandlers[0]({ id: 2, method: 'item/fileChange/requestApproval', params: { grantRoot: '/etc' } });
    server.serverRequestHandlers[0]({
      id: 3,
      method: 'item/commandExecution/requestApproval',
      params: { command: 'rm -rf /', cwd: '/' },
    });

    expect(JSON.parse(writes[0]).result).toEqual({ decision: 'accept' });
    expect(JSON.parse(writes[1]).result).toEqual({ decision: 'accept' });
  });

  it('approves legacy patch and command-exec approvals regardless of path', () => {
    const { server, writes } = fakeServer();
    attachCodexAutoApproval(server);

    server.serverRequestHandlers[0]({
      id: 4,
      method: 'applyPatchApproval',
      params: { fileChanges: { '/etc/passwd': {} } },
    });
    server.serverRequestHandlers[0]({ id: 5, method: 'execCommandApproval', params: { command: 'rm -rf /', cwd: '/' } });

    expect(JSON.parse(writes[0]).result).toEqual({ decision: 'approved' });
    expect(JSON.parse(writes[1]).result).toEqual({ decision: 'approved' });
  });

  it('fails closed for unknown server requests', () => {
    const { server, writes } = fakeServer();
    attachCodexAutoApproval(server);

    server.serverRequestHandlers[0]({ id: 6, method: 'new/unknown/request' });

    const response = JSON.parse(writes[0]);
    expect(response.error.message).toContain('Unhandled Codex app-server request');
  });
});

describe('Codex process env', () => {
  it('forwards proxy/runtime env without leaking secret-like host env', () => {
    const env = buildCodexProcessEnv({
      PATH: '/bin',
      HOME: '/home/node',
      CODEX_HOME: '/home/node/.codex',
      HTTPS_PROXY: 'http://proxy',
      OPENAI_API_KEY: 'sk-test',
      ONECLI_API_KEY: 'onecli-secret',
      SOME_TOKEN: 'token',
    });

    expect(env.PATH).toBe('/bin');
    expect(env.HOME).toBe('/home/node');
    expect(env.CODEX_HOME).toBe('/home/node/.codex');
    expect(env.HTTPS_PROXY).toBe('http://proxy');
    expect(env.OPENAI_API_KEY).toBeUndefined();
    expect(env.ONECLI_API_KEY).toBeUndefined();
    expect(env.SOME_TOKEN).toBeUndefined();
  });
});

function fakeServer(): { server: AppServer; writes: string[] } {
  const writes: string[] = [];
  const server = {
    process: { stdin: { write: (line: string) => writes.push(line) } },
    readline: { close: () => {} },
    pending: new Map(),
    notificationHandlers: [],
    exitHandlers: [],
    serverRequestHandlers: [],
  } as unknown as AppServer;
  return { server, writes };
}
