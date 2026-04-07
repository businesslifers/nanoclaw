/**
 * Customization Integrity Tests
 *
 * These tests verify that our local customizations to upstream NanoClaw files
 * survive merges. Each test targets a specific addition that upstream does not
 * have. If a merge silently drops one of these changes, the corresponding test
 * will fail immediately.
 */
import { describe, it, expect, beforeEach } from 'vitest';

import {
  _initTestDatabase,
  _closeDatabase,
  getAllRegisteredGroups,
  getMessagesSince,
  getNewMessages,
  setRegisteredGroup,
  storeChatMetadata,
  storeMessage,
} from './db.js';

import {
  extractSessionCommand,
  handleSessionCommand,
  isSessionCommandAllowed,
  createCanSenderInteract,
} from './session-commands.js';

import { formatOutboundForChannel } from './router.js';

import { WhatsAppChannel } from './channels/whatsapp.js';

import { processTaskIpc, IpcDeps } from './ipc.js';

// ---------------------------------------------------------------------------
// DB setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  _initTestDatabase();
});

// ---------------------------------------------------------------------------
// DB Schema & Queries — is_main column on registered_groups
// ---------------------------------------------------------------------------

describe('DB: is_main column in registered_groups', () => {
  it('roundtrips isMain through setRegisteredGroup / getAllRegisteredGroups', () => {
    setRegisteredGroup('main@g.us', {
      name: 'Main Group',
      folder: 'whatsapp_main',
      trigger: '@Bot',
      added_at: new Date().toISOString(),
      isMain: true,
    });

    setRegisteredGroup('other@g.us', {
      name: 'Other Group',
      folder: 'whatsapp_other',
      trigger: '@Bot',
      added_at: new Date().toISOString(),
    });

    const groups = getAllRegisteredGroups();
    expect(groups['main@g.us'].isMain).toBe(true);
    // Non-main groups should NOT have isMain set to true
    expect(groups['other@g.us'].isMain).not.toBe(true);
  });
});

// ---------------------------------------------------------------------------
// DB: is_from_me returned by getNewMessages
// ---------------------------------------------------------------------------

describe('DB: is_from_me in getNewMessages', () => {
  it('returns is_from_me field on retrieved messages', () => {
    storeChatMetadata('group@g.us', '2024-01-01T00:00:00.000Z');
    storeMessage({
      id: 'cust-1',
      chat_jid: 'group@g.us',
      sender: 'me@s.whatsapp.net',
      sender_name: 'Me',
      content: 'hello from me',
      timestamp: '2024-01-01T00:00:01.000Z',
      is_from_me: true,
    });

    const { messages } = getNewMessages(
      ['group@g.us'],
      '2024-01-01T00:00:00.000Z',
      'TestBot',
    );

    expect(messages).toHaveLength(1);
    // The field must be present and truthy (SQLite stores as 1)
    expect(messages[0].is_from_me).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// DB: is_from_me returned by getMessagesSince
// ---------------------------------------------------------------------------

describe('DB: is_from_me in getMessagesSince', () => {
  it('returns is_from_me field on retrieved messages', () => {
    storeChatMetadata('group@g.us', '2024-01-01T00:00:00.000Z');
    storeMessage({
      id: 'cust-2',
      chat_jid: 'group@g.us',
      sender: 'me@s.whatsapp.net',
      sender_name: 'Me',
      content: 'my message',
      timestamp: '2024-01-01T00:00:01.000Z',
      is_from_me: true,
    });

    const messages = getMessagesSince(
      'group@g.us',
      '2024-01-01T00:00:00.000Z',
      'TestBot',
    );

    expect(messages).toHaveLength(1);
    expect(messages[0].is_from_me).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Session Commands — exports exist and work
// ---------------------------------------------------------------------------

describe('session-commands: extractSessionCommand export', () => {
  it('is exported and extracts /compact', () => {
    expect(typeof extractSessionCommand).toBe('function');
    expect(extractSessionCommand('/compact', /^@Bot\b/i)).toBe('/compact');
  });

  it('returns null for non-command text', () => {
    expect(extractSessionCommand('hello', /^@Bot\b/i)).toBeNull();
  });
});

describe('session-commands: handleSessionCommand export', () => {
  it('is exported and callable', () => {
    expect(typeof handleSessionCommand).toBe('function');
  });
});

describe('session-commands: isSessionCommandAllowed export', () => {
  it('is exported and returns boolean', () => {
    expect(typeof isSessionCommandAllowed).toBe('function');
    expect(isSessionCommandAllowed(true, false)).toBe(true);
    expect(isSessionCommandAllowed(false, false)).toBe(false);
  });
});

describe('session-commands: createCanSenderInteract export', () => {
  it('is exported and returns a predicate function', () => {
    expect(typeof createCanSenderInteract).toBe('function');
    const predicate = createCanSenderInteract('group@g.us', true, {
      trigger: '@Bot',
    });
    expect(typeof predicate).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// Router — formatOutboundForChannel export
// ---------------------------------------------------------------------------

describe('router: formatOutboundForChannel export', () => {
  it('is exported and callable', () => {
    expect(typeof formatOutboundForChannel).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// WhatsApp Channel — syncGroups public method
// ---------------------------------------------------------------------------

describe('WhatsAppChannel: syncGroups method exists', () => {
  it('has syncGroups as a method on the prototype', () => {
    expect(typeof WhatsAppChannel.prototype.syncGroups).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// IPC: reaction handles empty emoji (removal via data.emoji !== undefined)
// ---------------------------------------------------------------------------

describe('IPC: reaction with empty emoji (removal)', () => {
  it('uses data.emoji !== undefined (not truthiness) in ipc.ts', async () => {
    // The reaction branch in startIpcWatcher (ipc.ts ~line 128) must use
    //   data.emoji !== undefined
    // not
    //   data.emoji && ...
    // because empty string "" is a valid reaction removal. A truthy check
    // would silently skip removals. We verify this by reading the source.
    const fs = await import('fs');
    const ipcSource = fs.readFileSync(
      new URL('./ipc.ts', import.meta.url),
      'utf-8',
    );

    // The correct condition must be present
    expect(ipcSource).toContain('data.emoji !== undefined');
    // And the buggy truthy check must NOT be used for reactions
    // (guard against `data.emoji &&` as the reaction gate)
    const reactionBlock = ipcSource.slice(
      ipcSource.indexOf("data.type === 'reaction'"),
    );
    const nextBlock = reactionBlock.slice(0, reactionBlock.indexOf('}'));
    expect(nextBlock).not.toMatch(/data\.emoji\s*&&/);
  });

  it('empty string emoji passes !== undefined but fails truthiness', () => {
    // Structural proof: this is the exact scenario the condition protects
    const data = { emoji: '' };
    expect(data.emoji !== undefined).toBe(true); // correct condition passes
    expect(Boolean(data.emoji)).toBe(false); // truthy check would wrongly skip
  });
});

// ---------------------------------------------------------------------------
// Request queue — schema, IPC cases, MCP tools
// ---------------------------------------------------------------------------

import {
  createRequest,
  getPendingRequests,
  getRequestById,
  resolveRequest,
} from './db.js';

describe('Request queue: DB schema roundtrip', () => {
  it('creates and resolves a request through the full lifecycle', () => {
    createRequest({
      id: 'req-integrity-test',
      requester_folder: 'whatsapp_test-group',
      requester_jid: 'test@g.us',
      target_folder: null,
      target_jid: null,
      summary: 'Integrity test request',
      detail: null,
      created_at: new Date().toISOString(),
    });

    const pending = getPendingRequests();
    expect(pending.length).toBeGreaterThanOrEqual(1);
    expect(pending.some((r) => r.id === 'req-integrity-test')).toBe(true);

    resolveRequest('req-integrity-test', 'denied', 'Test denial');
    const resolved = getRequestById('req-integrity-test');
    expect(resolved).toBeDefined();
    expect(resolved!.status).toBe('denied');
    expect(resolved!.resolution_reason).toBe('Test denial');
  });
});

describe('Request queue: IPC cases exist in source', () => {
  it('ipc.ts contains queue_request and resolve_request cases', async () => {
    const fs = await import('fs');
    const ipcSource = fs.readFileSync(
      new URL('./ipc.ts', import.meta.url),
      'utf-8',
    );
    expect(ipcSource).toContain("case 'queue_request':");
    expect(ipcSource).toContain("case 'resolve_request':");
    expect(ipcSource).toContain('onRequestsChanged');
  });
});

describe('Request queue: MCP tools exist in source', () => {
  it('ipc-mcp-stdio.ts contains queue_request, list_requests, resolve_request tools', async () => {
    const fs = await import('fs');
    const mcpSource = fs.readFileSync(
      new URL(
        '../container/agent-runner/src/ipc-mcp-stdio.ts',
        import.meta.url,
      ),
      'utf-8',
    );
    expect(mcpSource).toContain("'queue_request'");
    expect(mcpSource).toContain("'list_requests'");
    expect(mcpSource).toContain("'resolve_request'");
  });
});
