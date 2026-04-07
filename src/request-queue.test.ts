import { describe, it, expect, beforeEach } from 'vitest';

import {
  _initTestDatabase,
  createRequest,
  getAllRequests,
  getPendingRequests,
  getRequestById,
  getRequestsForGroup,
  resolveRequest,
  QueuedRequest,
} from './db.js';

import { processTaskIpc, IpcDeps } from './ipc.js';

// ---------------------------------------------------------------------------
// DB setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  _initTestDatabase();
});

// ---------------------------------------------------------------------------
// DB functions
// ---------------------------------------------------------------------------

describe('Request queue DB functions', () => {
  const sampleRequest = {
    id: 'req-001',
    requester_folder: 'whatsapp_ghost-team',
    requester_jid: '120363426590944083@g.us',
    target_folder: 'whatsapp_content-team',
    target_jid: '120363426281107172@g.us',
    summary: 'Update blog header with new branding',
    detail: 'The current header still uses the old logo.',
    created_at: '2026-04-04T10:00:00.000Z',
  };

  it('creates and retrieves a request', () => {
    createRequest(sampleRequest);
    const req = getRequestById('req-001');
    expect(req).toBeDefined();
    expect(req!.summary).toBe('Update blog header with new branding');
    expect(req!.status).toBe('pending');
    expect(req!.resolution_reason).toBeNull();
    expect(req!.resolved_at).toBeNull();
  });

  it('lists pending requests', () => {
    createRequest(sampleRequest);
    createRequest({
      ...sampleRequest,
      id: 'req-002',
      summary: 'Second request',
    });
    const pending = getPendingRequests();
    expect(pending).toHaveLength(2);
  });

  it('filters requests by group', () => {
    createRequest(sampleRequest);
    createRequest({
      ...sampleRequest,
      id: 'req-002',
      requester_folder: 'whatsapp_other',
      summary: 'Other request',
    });
    const ghostRequests = getRequestsForGroup('whatsapp_ghost-team');
    expect(ghostRequests).toHaveLength(1);
    expect(ghostRequests[0].id).toBe('req-001');
  });

  it('returns all requests', () => {
    createRequest(sampleRequest);
    createRequest({
      ...sampleRequest,
      id: 'req-002',
      requester_folder: 'whatsapp_other',
      summary: 'Other request',
    });
    expect(getAllRequests()).toHaveLength(2);
  });

  it('resolves a request as approved', () => {
    createRequest(sampleRequest);
    resolveRequest('req-001', 'approved', 'Looks good');
    const req = getRequestById('req-001');
    expect(req!.status).toBe('approved');
    expect(req!.resolution_reason).toBe('Looks good');
    expect(req!.resolved_at).toBeTruthy();
  });

  it('resolves a request as denied', () => {
    createRequest(sampleRequest);
    resolveRequest('req-001', 'denied', 'Theme not ready');
    const req = getRequestById('req-001');
    expect(req!.status).toBe('denied');
    expect(req!.resolution_reason).toBe('Theme not ready');
  });

  it('pending requests excludes resolved ones', () => {
    createRequest(sampleRequest);
    createRequest({
      ...sampleRequest,
      id: 'req-002',
      summary: 'Second request',
    });
    resolveRequest('req-001', 'approved');
    const pending = getPendingRequests();
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe('req-002');
  });

  it('handles null target fields', () => {
    createRequest({
      ...sampleRequest,
      target_folder: null,
      target_jid: null,
    });
    const req = getRequestById('req-001');
    expect(req!.target_folder).toBeNull();
    expect(req!.target_jid).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// IPC handler
// ---------------------------------------------------------------------------

function makeIpcDeps(overrides?: Partial<IpcDeps>): IpcDeps {
  return {
    sendMessage: async () => {},
    registeredGroups: () => ({}),
    registerGroup: () => {},
    syncGroups: async () => {},
    getAvailableGroups: () => [],
    writeGroupsSnapshot: () => {},
    onTasksChanged: () => {},
    onRequestsChanged: () => {},
    ...overrides,
  };
}

describe('IPC: queue_request', () => {
  it('creates a request from any group', async () => {
    const onRequestsChanged = { called: false };
    const deps = makeIpcDeps({
      onRequestsChanged: () => {
        onRequestsChanged.called = true;
      },
    });

    await processTaskIpc(
      {
        type: 'queue_request',
        summary: 'Need header update',
        detail: 'Old logo still showing',
        chatJid: '120363426590944083@g.us',
      },
      'whatsapp_ghost-team',
      false, // not main
      deps,
    );

    expect(onRequestsChanged.called).toBe(true);
    const requests = getPendingRequests();
    expect(requests).toHaveLength(1);
    expect(requests[0].summary).toBe('Need header update');
    expect(requests[0].requester_folder).toBe('whatsapp_ghost-team');
  });

  it('rejects request with missing summary', async () => {
    const deps = makeIpcDeps();
    await processTaskIpc(
      { type: 'queue_request', chatJid: 'test@g.us' },
      'whatsapp_ghost-team',
      false,
      deps,
    );
    expect(getPendingRequests()).toHaveLength(0);
  });
});

describe('IPC: resolve_request', () => {
  beforeEach(() => {
    createRequest({
      id: 'req-test',
      requester_folder: 'whatsapp_ghost-team',
      requester_jid: '120363426590944083@g.us',
      target_folder: null,
      target_jid: null,
      summary: 'Test request',
      detail: null,
      created_at: new Date().toISOString(),
    });
  });

  it('blocks non-main from resolving', async () => {
    const deps = makeIpcDeps();
    await processTaskIpc(
      {
        type: 'resolve_request',
        requestId: 'req-test',
        resolution: 'approved',
      },
      'whatsapp_ghost-team',
      false, // not main
      deps,
    );
    const req = getRequestById('req-test');
    expect(req!.status).toBe('pending'); // unchanged
  });

  it('approves and sends message to requester when no target', async () => {
    const sentMessages: Array<{ jid: string; text: string }> = [];
    const deps = makeIpcDeps({
      sendMessage: async (jid, text) => {
        sentMessages.push({ jid, text });
      },
    });

    await processTaskIpc(
      {
        type: 'resolve_request',
        requestId: 'req-test',
        resolution: 'approved',
        message: 'Go ahead with the update',
      },
      'whatsapp_main',
      true, // main
      deps,
    );

    const req = getRequestById('req-test');
    expect(req!.status).toBe('approved');
    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0].jid).toBe('120363426590944083@g.us');
    expect(sentMessages[0].text).toBe('Go ahead with the update');
  });

  it('denies and sends notification to requester', async () => {
    const sentMessages: Array<{ jid: string; text: string }> = [];
    const deps = makeIpcDeps({
      sendMessage: async (jid, text) => {
        sentMessages.push({ jid, text });
      },
    });

    await processTaskIpc(
      {
        type: 'resolve_request',
        requestId: 'req-test',
        resolution: 'denied',
        reason: 'Theme not ready yet',
      },
      'whatsapp_main',
      true,
      deps,
    );

    const req = getRequestById('req-test');
    expect(req!.status).toBe('denied');
    expect(req!.resolution_reason).toBe('Theme not ready yet');
    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0].jid).toBe('120363426590944083@g.us');
    expect(sentMessages[0].text).toContain('denied');
    expect(sentMessages[0].text).toContain('Theme not ready yet');
  });

  it('handles non-existent request gracefully', async () => {
    const deps = makeIpcDeps();
    await processTaskIpc(
      {
        type: 'resolve_request',
        requestId: 'req-nonexistent',
        resolution: 'approved',
      },
      'whatsapp_main',
      true,
      deps,
    );
    // Should not throw
  });
});
