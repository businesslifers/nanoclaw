/**
 * Integration test for the whatsapp-cloud channel's single reach-in: the self-registration
 * import in the `src/channels/index.ts` barrel. Importing the barrel runs whatsapp-cloud.ts's
 * top-level `registerChannelAdapter('whatsapp-cloud', …)`; without the import the channel is
 * silently absent.
 *
 * Behavior, not structural: it imports the real barrel and asserts the registry
 * actually contains the channel. This reflects what happens at host boot — if the
 * `import './whatsapp-cloud.js';` line is deleted, or the barrel fails to evaluate for any
 * reason (so the channel genuinely would not register), this goes red. A structural
 * check of the import line would falsely pass in that second case.
 *
 * Importing the barrel is safe: registration is a pure top-level call, and whatsapp-cloud.ts
 * builds the SDK adapter / bridge only inside its factory (invoked at host startup),
 * never at import. It does require the adapter package (`@chat-adapter/whatsapp`) to be installed,
 * which holds in a composed install: the skill's `pnpm install` step runs before this
 * test — so this test also implicitly guards that dependency (an unmocked import throws
 * if the package is missing).
 *
 * whatsapp-cloud is a Chat SDK channel: whatsapp-cloud.ts also consumes a load-bearing *core* API —
 * `createChatSdkBridge(...)` from ./chat-sdk-bridge.js. That core-consumption is a
 * typed call, so the build/typecheck leg (`pnpm run build`) guards it against upstream
 * drift, not this test. Every Chat SDK channel follows this same shape.
 */
import { describe, it, expect } from 'vitest';

import { getRegisteredChannelNames } from './channel-registry.js';
import './index.js'; // the real barrel — triggers every channel's self-registration

describe('whatsapp-cloud channel registration', () => {
  it('registers whatsapp-cloud via the channel barrel', () => {
    expect(getRegisteredChannelNames()).toContain('whatsapp-cloud');
  });
});
