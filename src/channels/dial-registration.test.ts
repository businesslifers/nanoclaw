/**
 * Integration test for the dial channel's single reach-in: the self-registration
 * import in the `src/channels/index.ts` barrel. Importing the barrel runs dial.ts's
 * top-level `registerChannelAdapter('dial', …)`; without the import the channel is
 * silently absent.
 *
 * Behavior, not structural: it imports the real barrel and asserts the registry
 * actually contains the channel. This reflects what happens at host boot — if the
 * `import './dial.js';` line is deleted, or the barrel fails to evaluate for any
 * reason (so the channel genuinely would not register), this goes red. A structural
 * check of the import line would falsely pass in that second case.
 *
 * dial is a native adapter (no Chat SDK bridge): it POSTs Dial's documented
 * `/api/v1/messages` endpoint for outbound and uses Dial's CLI command-target (a
 * spooled-event handler) for inbound. It pulls in no Dial client library, so the
 * barrel import needs nothing installed beyond the repo's own dependencies.
 * Registration is a pure top-level call, and dial.ts opens the
 * spool watcher / shells out to the `dial` CLI only inside setup() (run at host
 * startup), never at import.
 */
import { describe, it, expect } from 'vitest';

import { getRegisteredChannelNames } from './channel-registry.js';
import './index.js'; // the real barrel — triggers every channel's self-registration

describe('dial channel registration', () => {
  it('registers dial via the channel barrel', () => {
    expect(getRegisteredChannelNames()).toContain('dial');
  });
});
