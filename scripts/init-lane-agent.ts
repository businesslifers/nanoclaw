/**
 * Init a NanoClaw v2 LANE AGENT — a child agent group invoked only via
 * cross-agent send_message from a parent, with no messaging-channel wiring
 * of its own. This is the KDPup-style pattern (analytics, designer, writer,
 * etc. as separate agent groups linked via destinations).
 *
 * Use this when:
 *   - You want per-lane provider/model control (e.g. one lane on Codex,
 *     another on Claude Sonnet) — sub-agents inherit the parent's provider.
 *   - You want each lane to appear as its own dashboard tile.
 *   - The lane needs its own container, secrets, mounts, or MCP servers.
 *
 * If you want a fast in-process delegation that shares the parent's tools
 * and memory, use Claude Code subagents under `groups/<parent>/.claude/agents/`
 * instead — no script needed, just create the .md file.
 *
 * What this script does:
 *   1. Create the lane's `agent_groups` row (no messaging_groups wiring).
 *   2. Scaffold the lane's filesystem (CLAUDE.role.md seeded if --instructions
 *      passed, container.json default, etc).
 *   3. Insert bidirectional `agent_destinations`:
 *      - parent → lane (parent calls lane by --local-name, default: --folder)
 *      - lane → parent (lane calls parent as "parent")
 *   4. Project the parent's destinations into the parent's running session
 *      so the live container sees the new lane immediately (no restart needed).
 *   5. Optionally pre-create the lane's OneCLI agent and clone the parent's
 *      assigned secrets (so the lane works on first spawn — auto-created
 *      OneCLI agents start in selective mode with NO secrets, causing 401s).
 *
 * Idempotent on re-run: every step checks for existing rows / files first.
 *
 * Usage:
 *   pnpm exec tsx scripts/init-lane-agent.ts \
 *     --parent-folder insights-team \
 *     --folder analyst \
 *     --name "Analyst" \
 *     [--local-name analyst]                (default: --folder)
 *     [--provider claude|opencode|codex]    (default: null = inherit container default)
 *     [--model sonnet|haiku|opus|...]       (default: null = provider default)
 *     [--instructions '<seed text for CLAUDE.role.md>']
 *     [--clone-secrets-from-parent]         (run onecli to clone parent's secrets)
 */
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { DATA_DIR, GROUPS_DIR, MOUNT_ALLOWLIST_PATH } from '../src/config.js';
import {
  getContainerConfig,
  updateContainerConfigJson,
} from '../src/db/container-configs.js';
import { createAgentGroup, getAgentGroup, getAgentGroupByFolder } from '../src/db/agent-groups.js';
import { getDb, initDb } from '../src/db/connection.js';
import { runMigrations } from '../src/db/migrations/index.js';
import { initGroupFilesystem } from '../src/group-init.js';
import {
  createDestination,
  getDestinationByName,
} from '../src/modules/agent-to-agent/db/agent-destinations.js';
import { writeDestinations } from '../src/modules/agent-to-agent/write-destinations.js';
import type { AdditionalMountConfig } from '../src/container-config.js';
import type { AgentGroup, Session } from '../src/types.js';

interface Args {
  parentFolder: string;
  folder: string;
  name: string;
  localName: string;
  provider: string | null;
  model: string | null;
  instructions: string | null;
  cloneSecretsFromParent: boolean;
  mountTeamWiki: boolean;
}

const USAGE = `Usage:
  pnpm exec tsx scripts/init-lane-agent.ts \\
    --parent-folder <folder> \\
    --folder <folder> \\
    --name <display-name> \\
    [--local-name <name>]                  (default: --folder)
    [--provider claude|opencode|codex]     (default: null)
    [--model sonnet|haiku|opus|...]        (default: null)
    [--instructions '<seed for CLAUDE.role.md>']
    [--clone-secrets-from-parent]
    [--mount-team-wiki]                    (mount parent's wiki RO at /workspace/extra/team-wiki/)
`;

function parseArgs(argv: string[]): Args {
  const out: Partial<Args> = { cloneSecretsFromParent: false, mountTeamWiki: false };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    const val = argv[i + 1];
    switch (key) {
      case '--parent-folder':
        out.parentFolder = val;
        i++;
        break;
      case '--folder':
        out.folder = val;
        i++;
        break;
      case '--name':
        out.name = val;
        i++;
        break;
      case '--local-name':
        out.localName = val;
        i++;
        break;
      case '--provider':
        out.provider = val.trim().toLowerCase();
        i++;
        break;
      case '--model':
        out.model = val.trim();
        i++;
        break;
      case '--instructions':
        out.instructions = val;
        i++;
        break;
      case '--clone-secrets-from-parent':
        out.cloneSecretsFromParent = true;
        break;
      case '--mount-team-wiki':
        out.mountTeamWiki = true;
        break;
      case '--help':
      case '-h':
        console.log(USAGE);
        process.exit(0);
    }
  }

  const required: (keyof Args)[] = ['parentFolder', 'folder', 'name'];
  const missing = required.filter((k) => !out[k]);
  if (missing.length) {
    console.error(
      `Missing required args: ${missing.map((k) => `--${k.replace(/([A-Z])/g, '-$1').toLowerCase()}`).join(', ')}`,
    );
    console.error('');
    console.error(USAGE);
    process.exit(2);
  }

  return {
    parentFolder: out.parentFolder!,
    folder: out.folder!,
    name: out.name!,
    localName: out.localName ?? out.folder!,
    provider: out.provider ?? null,
    model: out.model ?? null,
    instructions: out.instructions ?? null,
    cloneSecretsFromParent: out.cloneSecretsFromParent ?? false,
    mountTeamWiki: out.mountTeamWiki ?? false,
  };
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getActiveSessions(agentGroupId: string): Session[] {
  return getDb()
    .prepare('SELECT * FROM sessions WHERE agent_group_id = ? ORDER BY created_at DESC')
    .all(agentGroupId) as Session[];
}

function onecli(args: string[]): string {
  return execFileSync('onecli', args, { encoding: 'utf8' });
}

function cloneOneCliSecrets(parent: AgentGroup, lane: AgentGroup): void {
  // List OneCLI agents → find parent by identifier → fetch its secrets →
  // create lane's OneCLI agent → assign the same secrets. All commands use
  // execFileSync (no shell) to avoid command injection.
  let agents: Array<{ id: string; identifier: string }>;
  try {
    agents = JSON.parse(onecli(['agents', 'list']));
  } catch {
    console.warn('  ⚠️  onecli not reachable; skipping secret clone. Configure manually.');
    return;
  }
  const parentOC = agents.find((a) => a.identifier === parent.id);
  if (!parentOC) {
    console.warn(
      `  ⚠️  No OneCLI agent for parent ${parent.id}; skipping secret clone. Pre-create parent's OneCLI entry first.`,
    );
    return;
  }
  const parentSecrets = JSON.parse(onecli(['agents', 'secrets', '--id', parentOC.id])) as string[];
  if (!parentSecrets.length) {
    console.warn('  ⚠️  Parent OneCLI agent has no secrets assigned; nothing to clone.');
    return;
  }

  const created = JSON.parse(
    onecli(['agents', 'create', '--identifier', lane.id, '--name', lane.name]),
  ) as { id: string };
  console.log(`  OneCLI agent created: ${created.id}`);

  onecli(['agents', 'set-secrets', '--id', created.id, '--secret-ids', parentSecrets.join(',')]);
  console.log(`  OneCLI secrets cloned: ${parentSecrets.length} from parent.`);
}

const TEAM_WIKI_CLAUDE_LOCAL_HEADING = '## Team knowledge';

function mountTeamWiki(parent: AgentGroup, lane: AgentGroup, laneFolder: string): void {
  const wikiAbs = path.resolve(GROUPS_DIR, parent.folder, 'wiki');
  if (!fs.existsSync(wikiAbs) || !fs.statSync(wikiAbs).isDirectory()) {
    console.warn(`  ⚠️  Parent has no wiki dir at ${wikiAbs}; skipping team-wiki mount.`);
    return;
  }

  // 1. mount-allowlist.json (idempotent by tilde-form path).
  const home = os.homedir();
  const tildePath = wikiAbs.startsWith(home + path.sep)
    ? '~' + wikiAbs.slice(home.length)
    : wikiAbs;

  let allowlist: {
    allowedRoots: Array<{ path: string; allowReadWrite: boolean; description?: string }>;
    blockedPatterns?: string[];
    nonMainReadOnly?: boolean;
  };
  try {
    allowlist = JSON.parse(fs.readFileSync(MOUNT_ALLOWLIST_PATH, 'utf8'));
  } catch {
    console.warn(
      `  ⚠️  Could not read ${MOUNT_ALLOWLIST_PATH}; skipping allowlist update. Add the entry manually.`,
    );
    allowlist = { allowedRoots: [] };
  }
  if (!Array.isArray(allowlist.allowedRoots)) allowlist.allowedRoots = [];
  const alreadyAllowed = allowlist.allowedRoots.some(
    (r) => r.path === tildePath || r.path === wikiAbs,
  );
  if (alreadyAllowed) {
    console.log(`  allowlist: ${tildePath} already present.`);
  } else {
    allowlist.allowedRoots.push({
      path: tildePath,
      allowReadWrite: false,
      description: `${parent.folder} wiki — shared RO across lanes`,
    });
    fs.writeFileSync(MOUNT_ALLOWLIST_PATH, JSON.stringify(allowlist, null, 2) + '\n');
    console.log(`  allowlist: added ${tildePath} (RO). Restart host to reload cache.`);
  }

  // 2. container_configs.additional_mounts (idempotent by containerPath).
  const cfg = getContainerConfig(lane.id);
  if (!cfg) {
    console.warn(`  ⚠️  No container_configs row for lane ${lane.id}; skipping mount.`);
  } else {
    const raw = (cfg as { additional_mounts?: string | null }).additional_mounts;
    let mounts: AdditionalMountConfig[] = [];
    if (typeof raw === 'string' && raw.length > 0) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) mounts = parsed as AdditionalMountConfig[];
      } catch {
        // Treat malformed JSON as empty rather than clobbering with bad data.
        console.warn(`  ⚠️  additional_mounts JSON malformed for ${lane.id}; replacing with new entry.`);
      }
    }
    const hasTeamWiki = mounts.some((m) => m.containerPath === 'team-wiki');
    if (hasTeamWiki) {
      console.log('  additional_mounts: team-wiki already present.');
    } else {
      mounts.push({ hostPath: wikiAbs, containerPath: 'team-wiki', readonly: true });
      updateContainerConfigJson(lane.id, 'additional_mounts', mounts);
      console.log('  additional_mounts: appended team-wiki (RO).');
    }
  }

  // 3. Append "## Team knowledge" to lane's CLAUDE.local.md (idempotent by heading).
  const claudeLocal = path.join(GROUPS_DIR, laneFolder, 'CLAUDE.local.md');
  const existing = fs.existsSync(claudeLocal) ? fs.readFileSync(claudeLocal, 'utf8') : '';
  if (existing.includes(TEAM_WIKI_CLAUDE_LOCAL_HEADING)) {
    console.log('  CLAUDE.local.md: Team knowledge section already present.');
  } else {
    const needsLeadingNewline = existing.length > 0 && !existing.endsWith('\n');
    const block =
      (needsLeadingNewline ? '\n' : '') +
      (existing.endsWith('\n\n') || existing.length === 0 ? '' : '\n') +
      `${TEAM_WIKI_CLAUDE_LOCAL_HEADING}\n\n` +
      `The parent's wiki is mounted read-only at \`/workspace/extra/team-wiki/\`. It is the shared source of truth across all ${parent.folder} lanes and the parent.\n\n` +
      `- **Consult \`team-wiki/index.md\` first** before answering anything that might already be settled team knowledge.\n` +
      `- **Read-only.** You cannot edit this mount. If you find a contradiction, an outdated entry, or knowledge worth promoting from your own lane wiki, surface it to the parent via \`send_message to="parent"\` rather than silently overriding it. The parent owns the team wiki and decides what gets written.\n` +
      `- **Lane wiki vs team wiki:** \`/workspace/agent/wiki/\` stays for lane-specific craft. \`/workspace/extra/team-wiki/\` is the team-wide view. When the two disagree, escalate to the parent.\n`;
    fs.appendFileSync(claudeLocal, block);
    console.log(`  CLAUDE.local.md: appended Team knowledge section to groups/${laneFolder}/.`);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const db = initDb(path.join(DATA_DIR, 'v2.db'));
  runMigrations(db);

  const parent = getAgentGroupByFolder(args.parentFolder);
  if (!parent) {
    console.error(`Parent folder not found: groups/${args.parentFolder}`);
    process.exit(1);
  }

  const now = new Date().toISOString();

  // 1. Lane agent_group + filesystem.
  let lane: AgentGroup | undefined = getAgentGroupByFolder(args.folder);
  if (!lane) {
    const id = generateId('ag');
    createAgentGroup({
      id,
      name: args.name,
      folder: args.folder,
      agent_provider: args.provider,
      model: args.model,
      created_at: now,
    });
    lane = getAgentGroup(id)!;
    console.log(`Created lane agent: ${lane.id} (${args.folder})`);
  } else {
    console.log(`Reusing lane agent: ${lane.id} (${args.folder})`);
  }
  initGroupFilesystem(lane, args.instructions ? { instructions: args.instructions } : undefined);

  // 2. Bidirectional destinations.
  if (!getDestinationByName(parent.id, args.localName)) {
    createDestination({
      agent_group_id: parent.id,
      local_name: args.localName,
      target_type: 'agent',
      target_id: lane.id,
      created_at: now,
    });
    console.log(`Wired parent → lane: ${parent.folder} -> ${args.localName} (${lane.id})`);
  } else {
    console.log(`Parent → lane wiring already exists: ${args.localName}`);
  }

  let parentName = 'parent';
  let parentSuffix = 2;
  while (getDestinationByName(lane.id, parentName)) {
    parentName = `parent-${parentSuffix}`;
    parentSuffix++;
  }
  // The loop exits when parentName is free OR we've already used it. Insert
  // only if the name we landed on isn't already taken by a row pointing at
  // this same parent (re-run idempotency).
  const existingReverse = getDb()
    .prepare(
      'SELECT 1 FROM agent_destinations WHERE agent_group_id = ? AND target_type = ? AND target_id = ?',
    )
    .get(lane.id, 'agent', parent.id);
  if (!existingReverse) {
    createDestination({
      agent_group_id: lane.id,
      local_name: parentName,
      target_type: 'agent',
      target_id: parent.id,
      created_at: now,
    });
    console.log(`Wired lane → parent: ${args.folder} -> ${parentName} (${parent.id})`);
  } else {
    console.log(`Lane → parent wiring already exists`);
  }

  // 3. Project parent's destinations into all of parent's active sessions
  //    so any running container sees the new lane immediately.
  const sessions = getActiveSessions(parent.id);
  for (const s of sessions) {
    writeDestinations(parent.id, s.id);
  }
  if (sessions.length > 0) {
    console.log(`writeDestinations refreshed ${sessions.length} active session(s) of parent.`);
  } else {
    console.log('No active parent sessions — destinations will project on next spawn.');
  }

  // 4. Optionally mount parent's wiki RO into the lane.
  if (args.mountTeamWiki) {
    console.log("Mounting parent's wiki read-only at /workspace/extra/team-wiki/…");
    mountTeamWiki(parent, lane, args.folder);
  }

  // 5. OneCLI: clone secrets if requested.
  if (args.cloneSecretsFromParent) {
    console.log('Cloning OneCLI secrets from parent…');
    cloneOneCliSecrets(parent, lane);
  } else {
    console.log(
      "OneCLI: skipped (pass --clone-secrets-from-parent to assign secrets, or run 'onecli agents create / set-secrets' manually).",
    );
  }

  console.log('');
  console.log('Init complete.');
  console.log(`  parent: ${parent.name} [${parent.id}] @ groups/${parent.folder}`);
  console.log(`  lane:   ${lane.name} [${lane.id}] @ groups/${args.folder}`);
  console.log(`  parent calls lane:  send_message to="${args.localName}"`);
  console.log(`  lane replies:       send_message to="${parentName}"`);
  console.log('');
  console.log('Next steps:');
  console.log(`  1. Edit groups/${args.folder}/CLAUDE.role.md with the lane's role spec`);
  console.log(`  2. Edit groups/${args.folder}/container.json (mounts, packages, MCP servers)`);
  console.log(`  3. From parent's chat, send the lane a brief: "send_message to ${args.localName}: <task>"`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
