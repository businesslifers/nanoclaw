/**
 * NanoClaw Agent Runner — Extensions
 * Custom additions extracted from index.ts to reduce upstream footprint.
 */

import fs from 'fs';
import path from 'path';
import { query } from '@anthropic-ai/claude-agent-sdk';

// --- Content block types (used by image loader and index.ts) ---

export type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

export interface ImageContentBlock {
  type: 'image';
  source: { type: 'base64'; media_type: ImageMediaType; data: string };
}
export interface TextContentBlock {
  type: 'text';
  text: string;
}
export type ContentBlock = ImageContentBlock | TextContentBlock;

// --- Slash command handler ---

export async function handleContainerSlashCommand(opts: {
  prompt: string;
  sessionId: string | undefined;
  sdkEnv: Record<string, string | undefined>;
  preCompactHook: any;
  writeOutput: (output: { status: 'success' | 'error'; result: string | null; error?: string; newSessionId?: string }) => void;
  log: (msg: string) => void;
}): Promise<{ handled: boolean; newSessionId?: string }> {
  const KNOWN_SESSION_COMMANDS = new Set(['/compact']);
  const trimmedPrompt = opts.prompt.trim();

  if (!KNOWN_SESSION_COMMANDS.has(trimmedPrompt)) {
    return { handled: false };
  }

  const { sessionId, sdkEnv, preCompactHook, writeOutput, log } = opts;

  log(`Handling session command: ${trimmedPrompt}`);
  let slashSessionId: string | undefined;
  let compactBoundarySeen = false;
  let hadError = false;
  let resultEmitted = false;

  try {
    for await (const message of query({
      prompt: trimmedPrompt,
      options: {
        cwd: '/workspace/group',
        resume: sessionId,
        systemPrompt: undefined,
        allowedTools: [],
        env: sdkEnv,
        permissionMode: 'bypassPermissions' as const,
        allowDangerouslySkipPermissions: true,
        settingSources: ['project', 'user'] as const,
        hooks: {
          PreCompact: [{ hooks: [preCompactHook] }],
        },
      },
    })) {
      const msgType = message.type === 'system'
        ? `system/${(message as { subtype?: string }).subtype}`
        : message.type;
      log(`[slash-cmd] type=${msgType}`);

      if (message.type === 'system' && message.subtype === 'init') {
        slashSessionId = message.session_id;
        log(`Session after slash command: ${slashSessionId}`);
      }

      // Observe compact_boundary to confirm compaction completed
      if (message.type === 'system' && (message as { subtype?: string }).subtype === 'compact_boundary') {
        compactBoundarySeen = true;
        log('Compact boundary observed — compaction completed');
      }

      if (message.type === 'result') {
        const resultSubtype = (message as { subtype?: string }).subtype;
        const textResult = 'result' in message ? (message as { result?: string }).result : null;

        if (resultSubtype?.startsWith('error')) {
          hadError = true;
          writeOutput({
            status: 'error',
            result: null,
            error: textResult || 'Session command failed.',
            newSessionId: slashSessionId,
          });
        } else {
          writeOutput({
            status: 'success',
            result: textResult || 'Conversation compacted.',
            newSessionId: slashSessionId,
          });
        }
        resultEmitted = true;
      }
    }
  } catch (err) {
    hadError = true;
    const errorMsg = err instanceof Error ? err.message : String(err);
    log(`Slash command error: ${errorMsg}`);
    writeOutput({ status: 'error', result: null, error: errorMsg });
  }

  log(`Slash command done. compactBoundarySeen=${compactBoundarySeen}, hadError=${hadError}`);

  // Warn if compact_boundary was never observed — compaction may not have occurred
  if (!hadError && !compactBoundarySeen) {
    log('WARNING: compact_boundary was not observed. Compaction may not have completed.');
  }

  // Only emit final session marker if no result was emitted yet and no error occurred
  if (!resultEmitted && !hadError) {
    writeOutput({
      status: 'success',
      result: compactBoundarySeen
        ? 'Conversation compacted.'
        : 'Compaction requested but compact_boundary was not observed.',
      newSessionId: slashSessionId,
    });
  } else if (!hadError) {
    // Emit session-only marker so host updates session tracking
    writeOutput({ status: 'success', result: null, newSessionId: slashSessionId });
  }

  return { handled: true, newSessionId: slashSessionId };
}

// --- Agent definitions loader ---

export function loadAgentDefinitions(
  log: (msg: string) => void,
): Record<string, { description: string; prompt: string; tools?: string[]; model?: 'sonnet' | 'opus' | 'haiku' | 'inherit' }> | undefined {
  try {
    const agents = JSON.parse(fs.readFileSync('/workspace/group/agents.json', 'utf-8'));
    log(`Loaded agent definitions: ${Object.keys(agents).join(', ')}`);
    return agents;
  } catch (err: any) {
    if (err.code !== 'ENOENT') log(`Failed to parse agents.json: ${err}`);
    return undefined;
  }
}

// --- Image blocks loader ---

export function loadImageBlocks(
  imageAttachments: Array<{ relativePath: string; mediaType: string }> | undefined,
  log: (msg: string) => void,
): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  if (!imageAttachments?.length) return blocks;

  for (const img of imageAttachments) {
    const imgPath = path.join('/workspace/group', img.relativePath);
    try {
      const data = fs.readFileSync(imgPath).toString('base64');
      blocks.push({ type: 'image', source: { type: 'base64', media_type: img.mediaType as ImageMediaType, data } });
    } catch (err) {
      log(`Failed to load image: ${imgPath}`);
    }
  }

  return blocks;
}
