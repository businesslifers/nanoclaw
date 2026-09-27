/**
 * Security regression: the Dial adapter's inbound pairing path must never grant
 * a role. A matching 6-digit SMS proves the sender controls a phone, not that
 * they are the operator, so the adapter only records the sender as a candidate —
 * the operator-run setup wizard (setup/pair-dial.ts) is the sole owner-granting
 * authority. Before the fix, `consumePairing` self-granted `owner` whenever the
 * install had none, letting an inbound SMS take over the agent.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { closeDb, initTestDb, runMigrations } from '../db/index.js';
import { getOwners, getUserRoles, hasAnyOwner } from '../modules/permissions/db/user-roles.js';
import { getUser } from '../modules/permissions/db/users.js';
import { recordPairingCandidate } from './dial.js';

beforeEach(async () => {
  const db = await initTestDb();
  await runMigrations(db);
});

afterEach(async () => {
  await closeDb();
});

describe('dial adapter pairing — records candidate, grants no role', () => {
  it('records the sender as a user but grants no role, even with no existing owner', async () => {
    expect(await hasAnyOwner()).toBe(false);

    const userId = await recordPairingCandidate('+15551234567');
    expect(userId).toBe('dial:+15551234567');

    // Recorded as a user so the wizard can see who paired...
    expect((await getUser(userId))?.kind).toBe('dial');

    // ...but with NO role, and the install still has no owner — the adapter
    // never promotes.
    expect(await getUserRoles(userId)).toHaveLength(0);
    expect(await getOwners()).toHaveLength(0);
    expect(await hasAnyOwner()).toBe(false);
  });
});
