/**
 * Disable Node's `autoSelectFamily` (Happy Eyeballs) and prefer IPv4 in
 * DNS resolution.
 *
 * Why: hosts whose resolver returns AAAA records but have no working IPv6
 * default route (e.g. a box on an IPv4-only LAN where upstream DNS still
 * hands out v6) cause undici-backed `fetch()` to fail with an aggregated
 * `ETIMEDOUT` — the v6 attempt errors with `ENETUNREACH` and the race
 * surfaces as a generic `NetworkError` to callers like
 * `@chat-adapter/telegram`. Curl falls back gracefully; Node's fetch does
 * not. Disabling autoSelectFamily forces a single-family connect, and
 * `ipv4first` makes that family IPv4 when both records exist. Hosts with
 * working IPv6 still resolve and reach v6-only destinations normally — only
 * dual-record + broken-v6-route boxes change behavior, and for those this
 * is the correct outcome.
 *
 * Imported first from each Node entry point (`src/index.ts`,
 * `setup/auto.ts`, `setup/index.ts`) so the change is in effect before any
 * module opens a socket.
 */
import dns from 'node:dns';
import net from 'node:net';

dns.setDefaultResultOrder('ipv4first');
net.setDefaultAutoSelectFamily(false);
