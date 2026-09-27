import fs from 'fs';
import path from 'path';

/**
 * This install's identifier for third-party clients that accept a caller token
 * on their User-Agent — the Dial CLI (`DIAL_USER_AGENT`), which prepends it to
 * its own stock token rather than replacing it, and the adapter's outbound REST
 * call, which sends it as the request's User-Agent. It lets an install name
 * itself in Dial's server-side request logs.
 *
 * Never throws. The token is telemetry: a host that can't read its own version
 * must still be able to make the call, so an unreadable package.json degrades
 * to `nanoclaw/unknown` rather than taking the request down with it.
 *
 * Cached — package.json can't change under a running process.
 */
let cached: string | null = null;

export function nanoclawUserAgent(): string {
  if (cached) return cached;
  let version = 'unknown';
  try {
    const pkgPath = path.join(process.cwd(), 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { version?: string };
    if (pkg.version) version = pkg.version;
  } catch {
    /* keep 'unknown' — see above */
  }
  cached = `nanoclaw/${version}`;
  return cached;
}
