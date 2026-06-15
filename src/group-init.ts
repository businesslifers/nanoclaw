import fs from 'fs';
import path from 'path';

import { DATA_DIR, GROUPS_DIR } from './config.js';
import { ensureContainerConfig } from './db/container-configs.js';
import { log } from './log.js';
import { providerProvidesAgentSurfaces } from './providers/provider-container-registry.js';
import type { AgentGroup } from './types.js';

/**
 * Default communication guidance seeded into every new group's
 * `CLAUDE.local.md`. Keeps replies short and the ask unmissable — long,
 * multi-message replies get skimmed and the user ends up asking "what do I
 * need to do?" instead of reading. Written once at creation (the seed is
 * gated on the file not existing), so per-group edits are never clobbered.
 */
const DEFAULT_COMMUNICATION_GUIDANCE = `## Communication

### Be brief and direct

Long replies get skimmed or skipped, and the user ends up asking "so what do I need to do?" instead of reading. Write so they don't have to.

- **Lead with the point.** First line = the answer, the result, or the ask. No preamble, no "Sure! I've gone ahead and…", no recap of what you did.
- **Default to 1–3 sentences.** Expand only when the user asks for detail. If you're tempted to write paragraphs, that's a sign it belongs in a task, a doc, or a wiki page, not a chat message.
- **Make the ask unmissable.** If there's something for the user to do, say it plainly on its own line — e.g. \`Need from you: a yes/no, or tell me what to change.\` If there's nothing, say \`Nothing needed from you.\` Never make them guess.
- **One message, not five.** Don't split a single thought across multiple sends.
- **Cut the process.** How you got there goes in \`<internal>\` tags, not the reply. The user wants the outcome.
- **Lists over prose for multiple items**, but keep each item to one short line. No nested bullets, no walls of text.
`;

const DEFAULT_SETTINGS_JSON =
  JSON.stringify(
    {
      env: {
        CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '1',
        CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD: '1',
        CLAUDE_CODE_DISABLE_AUTO_MEMORY: '0',
      },
      hooks: {
        PreCompact: [
          {
            hooks: [
              {
                type: 'command',
                command: 'bun /app/src/compact-instructions.ts',
              },
            ],
          },
        ],
      },
    },
    null,
    2,
  ) + '\n';

/**
 * Initialize the on-disk filesystem state for an agent group. Idempotent —
 * every step is gated on the target not already existing, so re-running on
 * an already-initialized group is a no-op.
 *
 * Called once per group lifetime at creation, or defensively from
 * `buildMounts()` for groups that pre-date this code path.
 *
 * Source code and skills are shared RO mounts — not copied per-group.
 * Skill symlinks are synced at spawn time by container-runner.ts.
 *
 * The composed `CLAUDE.md` is NOT written here — it's regenerated on every
 * spawn by `composeGroupClaudeMd()` (see `claude-md-compose.ts`). Initial
 * per-group instructions (if provided) seed `CLAUDE.local.md`.
 */
export function initGroupFilesystem(
  group: AgentGroup,
  opts?: { instructions?: string; provider?: string | null },
): void {
  const initialized: string[] = [];

  // Default agent surfaces apply unless the group's provider declares (at
  // registration) that it provides its own. Callers that don't know the
  // provider omit it — unregistered/unknown names report no capabilities,
  // so the default surfaces are written, exactly as before this seam.
  const defaultSurfaces = !providerProvidesAgentSurfaces(opts?.provider);

  // 1. groups/<folder>/ — group memory + working dir
  const groupDir = path.resolve(GROUPS_DIR, group.folder);
  if (!fs.existsSync(groupDir)) {
    fs.mkdirSync(groupDir, { recursive: true });
    initialized.push('groupDir');
  }

  // Seed instructions land in the provider's OWN memory surface. Default
  // (Claude) surfaces auto-load CLAUDE.local.md natively. A surfaces-owning
  // provider must never see stale CLAUDE.* files in its workspace — its seed
  // goes into the memory scaffold's conventional landing file instead
  // (memory/memories/imported-agent-memory.md): the container-side scaffold
  // preserves pre-existing files, and the doctrine tells the agent to read
  // that file on its first turn.
  //
  // Creation stays provider-agnostic: a DM-agent creator drops the seed in a
  // neutral `.seed.md`, and placement is deferred to here (the first spawn,
  // where the DB-resolved provider is known). Once placed it's consumed.
  // `opts.instructions` still wins for any caller that passes it inline.
  const neutralSeedFile = path.join(groupDir, '.seed.md');
  const seed =
    opts?.instructions ??
    (fs.existsSync(neutralSeedFile) ? fs.readFileSync(neutralSeedFile, 'utf-8').trimEnd() : undefined);

  if (defaultSurfaces) {
    // Local customization: every Claude group inherits DEFAULT_COMMUNICATION_GUIDANCE
    // (per-group wiki + role usage guidance) on top of any seed. See the
    // "default wiki per group" requirement.
    const claudeLocalFile = path.join(groupDir, 'CLAUDE.local.md');
    if (!fs.existsSync(claudeLocalFile)) {
      const body = (seed ? seed.trim() + '\n\n' : '') + DEFAULT_COMMUNICATION_GUIDANCE;
      fs.writeFileSync(claudeLocalFile, body);
      initialized.push('CLAUDE.local.md');
    }
  } else if (seed) {
    const seedFile = path.join(groupDir, 'memory', 'memories', 'imported-agent-memory.md');
    if (!fs.existsSync(seedFile)) {
      fs.mkdirSync(path.dirname(seedFile), { recursive: true });
      fs.writeFileSync(seedFile, seed + '\n');
      initialized.push('memory/memories/imported-agent-memory.md');
    }
  }

  // The neutral seed is single-use — drop it once the surface it belonged in
  // has been resolved, so it can't re-seed after the operator edits theirs.
  if (fs.existsSync(neutralSeedFile)) {
    fs.rmSync(neutralSeedFile);
    initialized.push('.seed.md consumed');
  }

  // Ensure container_configs row exists in the DB. Idempotent — no-op if
  // the row already exists (e.g. created by backfill or group creation).
  ensureContainerConfig(group.id);
  initialized.push('container_configs');

  // 2. data/v2-sessions/<id>/.claude-shared/ — Claude state + per-group skills
  if (defaultSurfaces) {
    const claudeDir = path.join(DATA_DIR, 'v2-sessions', group.id, '.claude-shared');
    if (!fs.existsSync(claudeDir)) {
      fs.mkdirSync(claudeDir, { recursive: true });
      initialized.push('.claude-shared');
    }

    const settingsFile = path.join(claudeDir, 'settings.json');
    if (!fs.existsSync(settingsFile)) {
      fs.writeFileSync(settingsFile, DEFAULT_SETTINGS_JSON);
      initialized.push('settings.json');
    } else {
      ensurePreCompactHook(settingsFile, initialized);
    }

    // Skills directory — created empty here; symlinks are synced at spawn
    // time by container-runner.ts based on container.json skills selection.
    const skillsDst = path.join(claudeDir, 'skills');
    if (!fs.existsSync(skillsDst)) {
      fs.mkdirSync(skillsDst, { recursive: true });
      initialized.push('skills/');
    }
  }

  // 3. groups/<folder>/wiki/ + sources/ — Karpathy-style persistent wiki.
  // The wiki container skill (container/skills/wiki/) drives ingest/query/lint;
  // here we just guarantee the on-disk skeleton exists so the agent has
  // somewhere to file knowledge from day one.
  const sourcesDir = path.join(groupDir, 'sources');
  if (!fs.existsSync(sourcesDir)) {
    fs.mkdirSync(sourcesDir, { recursive: true });
    initialized.push('sources/');
  }

  const wikiDir = path.join(groupDir, 'wiki');
  if (!fs.existsSync(wikiDir)) {
    fs.mkdirSync(wikiDir, { recursive: true });
    fs.mkdirSync(path.join(wikiDir, 'entities'), { recursive: true });
    fs.mkdirSync(path.join(wikiDir, 'concepts'), { recursive: true });
    fs.mkdirSync(path.join(wikiDir, 'topics'), { recursive: true });
    fs.writeFileSync(path.join(wikiDir, 'index.md'), renderWikiIndex(group));
    fs.writeFileSync(path.join(wikiDir, 'log.md'), renderWikiLog(group));
    initialized.push('wiki/');
  }

  if (initialized.length > 0) {
    log.info('Initialized group filesystem', {
      group: group.name,
      folder: group.folder,
      id: group.id,
      steps: initialized,
    });
  }
}

const PRE_COMPACT_COMMAND = 'bun /app/src/compact-instructions.ts';

/**
 * Patch an existing settings.json to add the PreCompact hook if missing.
 * Runs on every group init so pre-existing groups pick up the hook.
 */
function ensurePreCompactHook(settingsFile: string, initialized: string[]): void {
  try {
    const raw = fs.readFileSync(settingsFile, 'utf-8');
    const settings = JSON.parse(raw);

    // Check if there's already a PreCompact hook with our command.
    const existing = settings.hooks?.PreCompact as unknown[] | undefined;
    if (existing && JSON.stringify(existing).includes(PRE_COMPACT_COMMAND)) return;

    // Add the hook, preserving existing hooks.
    if (!settings.hooks) settings.hooks = {};
    if (!settings.hooks.PreCompact) settings.hooks.PreCompact = [];
    settings.hooks.PreCompact.push({
      hooks: [{ type: 'command', command: PRE_COMPACT_COMMAND }],
    });

    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2) + '\n');
    initialized.push('settings.json (added PreCompact hook)');
  } catch {
    // Don't break init if settings.json is malformed — it'll use whatever's there.
  }
}

function renderWikiIndex(group: AgentGroup): string {
  const today = new Date().toISOString().slice(0, 10);
  return `---
scope: group
group: ${group.folder}
title: ${group.name}
description: ${group.name} wiki — agent-maintained persistent knowledge base.
updated: ${today}
---

# ${group.name} Wiki — Index

Knowledge base for the **${group.name}** agent group. Read this file FIRST on any query so you can pull from existing pages instead of re-deriving from raw sources.

## How to use this index

Every wiki page should be linked here under its category with a one-line summary. New ingests append entries here AND to \`log.md\`. Stale or orphan pages are pruned during periodic lint passes.

## Categories

### Entities
*People, places, organisations, products, projects.*

_(none yet)_

### Concepts
*Ideas, frameworks, definitions.*

_(none yet)_

### Topics
*Threads spanning multiple sources — investigations, recurring reports, ongoing themes._

_(none yet)_

## Cross-wiki links

- Global wiki: \`/workspace/global/wiki/index.md\` (read-only from non-main groups; promote pages there when they become useful cross-group).
`;
}

function renderWikiLog(group: AgentGroup): string {
  const today = new Date().toISOString().slice(0, 10);
  return `---
scope: group
group: ${group.folder}
---

# ${group.name} Wiki — Log

Append-only chronological record of ingest, query, lint, and promotion events. One entry per operation. Format:

\`\`\`
## [YYYY-MM-DD] <event-type> | <one-line summary>

<details>
\`\`\`

Where \`<event-type>\` is \`ingest\`, \`query\`, \`lint\`, \`promote\`, or \`prune\`.

Recent entries are tail-readable: \`tail -50 log.md\` or \`grep "^## \\[" log.md | tail -10\`.

---

## [${today}] init | Wiki scaffolded at group creation

Empty skeleton created by \`initGroupFilesystem\`. No sources ingested yet.
`;
}
