import fs from 'fs';
import path from 'path';

import { DATA_DIR, DEFAULT_AGENT_PROVIDER, GROUPS_DIR } from './config.js';
import { ensureContainerConfig } from './db/container-configs.js';
import { stageGroupPersona } from './group-persona.js';
import { log } from './log.js';
import { migrateClaudeMemorySettings } from './migrate-claude-memory-settings.js';
import { providerProvidesAgentSurfaces } from './providers/provider-container-registry.js';
import type { AgentGroup } from './types.js';

/**
 * Default communication guidance appended to every new group's staged
 * standing instructions (`instructions.prepend.md`). Keeps replies short
 * and the ask unmissable — long,
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
      autoMemoryEnabled: false,
      env: {
        CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD: '1',
        CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1',
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
 * The provider project document is regenerated on every spawn. Initial
 * standing instructions are staged once in the provider-neutral prepend file.
 */
export function initGroupFilesystem(
  group: AgentGroup,
  opts?: { instructions?: string; provider?: string | null },
): void {
  const initialized: string[] = [];

  // `opts.provider` absent means "caller has no provider opinion" — for a
  // brand-new group that resolves to the instance default, so the scaffold and
  // the stamped config row both match it. A caller that knows the provider
  // (subagent → parent's, spawn → resolved, setup → operator's pick) passes it
  // explicitly — including `claude` — which pins the group and skips the
  // default. ensureContainerConfig is INSERT OR IGNORE, so this only stamps a
  // genuinely new group; existing rows are never touched.
  const providerHint = (opts?.provider ?? DEFAULT_AGENT_PROVIDER).toLowerCase();

  // Default agent surfaces apply unless the provider declares (at registration)
  // that it provides its own.
  const defaultSurfaces = !providerProvidesAgentSurfaces(providerHint);

  // 1. groups/<folder>/ — group memory + working dir
  const groupDir = path.resolve(GROUPS_DIR, group.folder);
  if (!fs.existsSync(groupDir)) {
    fs.mkdirSync(groupDir, { recursive: true });
    initialized.push('groupDir');
  }

  // Local customization: staged standing instructions inherit
  // DEFAULT_COMMUNICATION_GUIDANCE after the persona. Only staged when a
  // creator passes instructions — a bare init leaves the persona file
  // absent so /migrate-memory can still place legacy seeds.
  if (
    opts?.instructions &&
    stageGroupPersona(groupDir, `${opts.instructions.trimEnd()}\n\n${DEFAULT_COMMUNICATION_GUIDANCE}`)
  ) {
    initialized.push('instructions.prepend.md');
  }

  // Ensure container_configs row exists in the DB. Idempotent — no-op if
  // the row already exists (e.g. created by backfill or group creation). On a
  // fresh row, stamp the resolved provider hint so a new group is created on
  // the instance default (or the caller's explicit pick).
  ensureContainerConfig(group.id, providerHint);
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
    } else if (migrateClaudeMemorySettings(settingsFile)) {
      initialized.push('settings.json (reconciled Claude settings)');
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
