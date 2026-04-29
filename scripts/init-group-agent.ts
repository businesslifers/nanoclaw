/**
 * Init a NanoClaw v2 agent group wired to a multi-user CHANNEL (Telegram
 * group, Slack channel, Discord channel, etc.) — the group-chat counterpart
 * to scripts/init-first-agent.ts (which is DM-only).
 *
 * Use this when porting a v1 team that lived in a group chat, or when
 * standing up a new team agent that should serve a group.
 *
 * Creates/reuses: agent group + filesystem, messaging_groups row with
 * is_group=1, messaging_group_agents wiring. Idempotent on re-run.
 *
 * Does NOT touch users or roles — group channels don't have a single
 * owner; the operator already has a global owner role from
 * init-first-agent.ts. Run that first if no global owner exists yet.
 *
 * Does NOT post a welcome message — group channels are noisy and the
 * welcome hop in init-first-agent.ts assumes a single DM target. Send a
 * test message in the group manually after running.
 *
 * Runs alongside the service. Reads central DB directly (WAL-mode), no
 * IPC needed since there's no welcome to dispatch.
 *
 * Usage:
 *   pnpm exec tsx scripts/init-group-agent.ts \
 *     --channel telegram \
 *     --platform-id telegram:-1001234567890 \
 *     --display-name "Insights Team" \
 *     --agent-name "Derek" \
 *     --folder insights-team \
 *     [--engage-mode mention|mention-sticky]      # default: mention
 *     [--engage-pattern '<regex>']                 # only with engage-mode=pattern
 *     [--unknown-sender-policy public|request_approval|strict]  # default: public
 *     [--instructions '<seed text for CLAUDE.role.md>']
 */
import path from 'path';

import { DATA_DIR } from '../src/config.js';
import { createAgentGroup, getAgentGroupByFolder } from '../src/db/agent-groups.js';
import { getDb, initDb } from '../src/db/connection.js';
import {
  createMessagingGroup,
  createMessagingGroupAgent,
  getMessagingGroupAgentByPair,
  getMessagingGroupByPlatform,
  updateMessagingGroup,
} from '../src/db/messaging-groups.js';
import { runMigrations } from '../src/db/migrations/index.js';
import { initGroupFilesystem } from '../src/group-init.js';
import { namespacedPlatformId } from '../src/platform-id.js';
import type { AgentGroup, MessagingGroup } from '../src/types.js';

type EngageMode = 'mention' | 'mention-sticky' | 'pattern';
type UnknownSenderPolicy = 'public' | 'request_approval' | 'strict';

interface Args {
  channel: string;
  platformId: string;
  displayName: string;
  agentName: string;
  folder: string;
  engageMode: EngageMode;
  engagePattern: string | null;
  unknownSenderPolicy: UnknownSenderPolicy;
  instructions: string | null;
}

const USAGE = `Usage:
  pnpm exec tsx scripts/init-group-agent.ts \\
    --channel <type> \\
    --platform-id <id> \\
    --display-name <name> \\
    --agent-name <name> \\
    --folder <folder> \\
    [--engage-mode mention|mention-sticky|pattern]  (default: mention)
    [--engage-pattern '<regex>']                    (required when mode=pattern)
    [--unknown-sender-policy public|request_approval|strict]  (default: public)
    [--instructions '<seed text for CLAUDE.role.md>']
`;

function parseArgs(argv: string[]): Args {
  const out: Partial<Args> = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    const val = argv[i + 1];
    switch (key) {
      case '--channel':
        out.channel = (val ?? '').toLowerCase();
        i++;
        break;
      case '--platform-id':
        out.platformId = val;
        i++;
        break;
      case '--display-name':
        out.displayName = val;
        i++;
        break;
      case '--agent-name':
        out.agentName = val;
        i++;
        break;
      case '--folder':
        out.folder = val;
        i++;
        break;
      case '--engage-mode': {
        const raw = (val ?? '').toLowerCase();
        if (raw !== 'mention' && raw !== 'mention-sticky' && raw !== 'pattern') {
          console.error(
            `Invalid --engage-mode: ${raw} (expected 'mention', 'mention-sticky', or 'pattern')`,
          );
          process.exit(2);
        }
        out.engageMode = raw;
        i++;
        break;
      }
      case '--engage-pattern':
        out.engagePattern = val;
        i++;
        break;
      case '--unknown-sender-policy': {
        const raw = (val ?? '').toLowerCase();
        if (raw !== 'public' && raw !== 'request_approval' && raw !== 'strict') {
          console.error(
            `Invalid --unknown-sender-policy: ${raw} (expected 'public', 'request_approval', or 'strict')`,
          );
          process.exit(2);
        }
        out.unknownSenderPolicy = raw;
        i++;
        break;
      }
      case '--instructions':
        out.instructions = val;
        i++;
        break;
      case '--help':
      case '-h':
        console.log(USAGE);
        process.exit(0);
    }
  }

  const required: (keyof Args)[] = [
    'channel',
    'platformId',
    'displayName',
    'agentName',
    'folder',
  ];
  const missing = required.filter((k) => !out[k]);
  if (missing.length) {
    console.error(
      `Missing required args: ${missing.map((k) => `--${k.replace(/([A-Z])/g, '-$1').toLowerCase()}`).join(', ')}`,
    );
    console.error('');
    console.error(USAGE);
    process.exit(2);
  }

  const engageMode = out.engageMode ?? 'mention';
  const engagePattern = out.engagePattern ?? null;
  if (engageMode === 'pattern' && !engagePattern) {
    console.error("--engage-pattern is required when --engage-mode is 'pattern'");
    process.exit(2);
  }
  if (engageMode !== 'pattern' && engagePattern) {
    console.error("--engage-pattern is only valid with --engage-mode pattern");
    process.exit(2);
  }

  return {
    channel: out.channel!,
    platformId: out.platformId!,
    displayName: out.displayName!,
    agentName: out.agentName!,
    folder: out.folder!,
    engageMode,
    engagePattern,
    unknownSenderPolicy: out.unknownSenderPolicy ?? 'public',
    instructions: out.instructions ?? null,
  };
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function wireIfMissing(
  mg: MessagingGroup,
  ag: AgentGroup,
  engageMode: EngageMode,
  engagePattern: string | null,
  now: string,
): void {
  const existing = getMessagingGroupAgentByPair(mg.id, ag.id);
  if (existing) {
    console.log(`Wiring already exists: ${existing.id}`);
    return;
  }
  createMessagingGroupAgent({
    id: generateId('mga'),
    messaging_group_id: mg.id,
    agent_group_id: ag.id,
    engage_mode: engageMode,
    engage_pattern: engagePattern,
    sender_scope: 'all',
    ignored_message_policy: 'drop',
    session_mode: 'shared',
    priority: 0,
    created_at: now,
  });
  console.log(`Wired group: ${mg.id} -> ${ag.id} (engage_mode=${engageMode})`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const db = initDb(path.join(DATA_DIR, 'v2.db'));
  runMigrations(db);

  const now = new Date().toISOString();

  // 1. Agent group + filesystem.
  let ag: AgentGroup | undefined = getAgentGroupByFolder(args.folder);
  if (!ag) {
    const agId = generateId('ag');
    createAgentGroup({
      id: agId,
      name: args.agentName,
      folder: args.folder,
      agent_provider: null,
      model: null,
      created_at: now,
    });
    ag = getAgentGroupByFolder(args.folder)!;
    console.log(`Created agent group: ${ag.id} (${args.folder})`);
  } else {
    console.log(`Reusing agent group: ${ag.id} (${args.folder})`);
  }
  initGroupFilesystem(ag, args.instructions ? { instructions: args.instructions } : undefined);

  // 2. Group messaging row.
  //
  // v2's adapters auto-create a messaging_groups row the moment the bot
  // lands in a new chat — and emit a "Channel registration card" approval
  // request to the operator's DM. So when porting an existing chat, the
  // row may already exist with name=null and unknown_sender_policy set to
  // the adapter default. We reuse the row when present, fill in the name
  // if it was null, and warn on policy/is_group mismatches so the operator
  // notices.
  const platformId = namespacedPlatformId(args.channel, args.platformId);
  let mg = getMessagingGroupByPlatform(args.channel, platformId);
  if (!mg) {
    const mgId = generateId('mg');
    createMessagingGroup({
      id: mgId,
      channel_type: args.channel,
      platform_id: platformId,
      name: args.displayName,
      is_group: 1,
      unknown_sender_policy: args.unknownSenderPolicy,
      created_at: now,
    });
    mg = getMessagingGroupByPlatform(args.channel, platformId)!;
    console.log(`Created messaging group: ${mg.id} (${platformId})`);
  } else {
    console.log(`Reusing messaging group: ${mg.id} (${platformId})`);
    if (!mg.name) {
      updateMessagingGroup(mg.id, { name: args.displayName });
      console.log(`  filled name: ${args.displayName} (was null)`);
      mg = { ...mg, name: args.displayName };
    } else if (mg.name !== args.displayName) {
      console.log(`  ⚠️  existing name "${mg.name}" differs from --display-name "${args.displayName}" (kept existing)`);
    }
    if (mg.is_group !== 1) {
      console.log(`  ⚠️  existing row has is_group=${mg.is_group}; expected 1 for a group channel`);
    }
    if (mg.unknown_sender_policy !== args.unknownSenderPolicy) {
      console.log(
        `  ⚠️  existing unknown_sender_policy="${mg.unknown_sender_policy}" differs from --unknown-sender-policy "${args.unknownSenderPolicy}" (kept existing)`,
      );
    }
  }

  // 3. Wire it.
  wireIfMissing(mg, ag, args.engageMode, args.engagePattern, now);

  // 4. Best-effort: clear any stale "Channel registration card" pending
  //    approval for this messaging group. The card targets whichever
  //    agent the adapter guessed at auto-create time; once we've wired
  //    the channel here, approving the card later would mis-wire to the
  //    wrong agent. Silently no-op if the table doesn't exist (older
  //    schema) or if there's no row.
  try {
    const cleared = getDb()
      .prepare('DELETE FROM pending_channel_approvals WHERE messaging_group_id = ?')
      .run(mg.id);
    if (cleared.changes > 0) {
      console.log(`Cleared ${cleared.changes} stale channel-registration approval(s).`);
    }
  } catch {
    // Table may not exist on older schema — ignore.
  }

  console.log('');
  console.log('Init complete.');
  console.log(`  agent:   ${ag.name} [${ag.id}] @ groups/${args.folder}`);
  console.log(`  channel: ${args.channel} ${platformId} (is_group=1, ${args.unknownSenderPolicy})`);
  console.log(`  engage:  ${args.engageMode}${args.engagePattern ? ` /${args.engagePattern}/` : ''}`);
  console.log('');
  console.log('Send a test message in the group (mention the bot if engage_mode=mention)');
  console.log('to confirm routing. Tail logs/nanoclaw.log to watch the inbound→spawn→outbound trace.');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
