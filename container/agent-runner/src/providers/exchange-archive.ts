import fs from 'fs';
import path from 'path';

/**
 * Per-exchange markdown archive for providers with no on-disk transcript —
 * payload code, shipped with the provider that needs it. The provider's
 * `onExchangeComplete` hook (see types.ts) calls this with each completed
 * exchange; the runner never archives on a provider's behalf.
 */

const DEFAULT_CONVERSATIONS_DIR = '/workspace/agent/conversations';

export interface ProviderExchangeArchiveOptions {
  provider: string;
  prompt: string;
  result: string | null | undefined;
  continuation?: string;
  status: string;
  timestamp?: Date;
  conversationsDir?: string;
}

/**
 * Archive a single prompt/result exchange. Returns the written filename, or
 * null when there is nothing to archive (empty result).
 */
export function archiveProviderExchange(options: ProviderExchangeArchiveOptions): string | null {
  const result = options.result?.trim();
  if (!result) return null;

  const timestamp = options.timestamp ?? new Date();
  const conversationsDir =
    options.conversationsDir || process.env.NANOCLAW_CONVERSATIONS_DIR || DEFAULT_CONVERSATIONS_DIR;
  fs.mkdirSync(conversationsDir, { recursive: true });

  const filename = uniqueArchiveFilename(conversationsDir, options.provider, options.continuation, timestamp);
  const lines = [
    `# ${titleCase(options.provider)} Exchange`,
    '',
    `Archived: ${timestamp.toISOString()}`,
    `Provider: ${options.provider}`,
    `Continuation/thread id: ${options.continuation || '(none)'}`,
    `Status: ${options.status}`,
    '',
    '---',
    '',
    `**User**: ${truncate(options.prompt)}`,
    '',
    `**Assistant**: ${truncate(result)}`,
    '',
  ];
  fs.writeFileSync(path.join(conversationsDir, filename), lines.join('\n'));
  return filename;
}

function uniqueArchiveFilename(
  dir: string,
  provider: string,
  continuation: string | undefined,
  timestamp: Date,
): string {
  const date = timestamp.toISOString().split('T')[0];
  const time = timestamp.toISOString().replace(/[-:.TZ]/g, '').slice(8, 17);
  const thread = sanitizeSlug(continuation || 'no-thread').slice(0, 24) || 'no-thread';
  const base = `${date}-${sanitizeSlug(provider)}-${time}-${thread}`;
  let filename = `${base}.md`;
  let counter = 2;
  while (fs.existsSync(path.join(dir, filename))) {
    filename = `${base}-${counter}.md`;
    counter += 1;
  }
  return filename;
}

function sanitizeSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function titleCase(value: string): string {
  return value ? value[0].toUpperCase() + value.slice(1) : 'Provider';
}

function truncate(value: string): string {
  return value.length > 2000 ? value.slice(0, 2000) + '...' : value;
}
