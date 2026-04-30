import fs from 'fs';
import path from 'path';

import { DATA_DIR, GROUPS_DIR } from './config.js';
import { initContainerConfig } from './container-config.js';
import { log } from './log.js';
import type { AgentGroup } from './types.js';

const DEFAULT_SETTINGS_JSON =
  JSON.stringify(
    {
      env: {
        CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '1',
        CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD: '1',
        CLAUDE_CODE_DISABLE_AUTO_MEMORY: '0',
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
export function initGroupFilesystem(group: AgentGroup, opts?: { instructions?: string }): void {
  const initialized: string[] = [];

  // 1. groups/<folder>/ — group memory + working dir
  const groupDir = path.resolve(GROUPS_DIR, group.folder);
  if (!fs.existsSync(groupDir)) {
    fs.mkdirSync(groupDir, { recursive: true });
    initialized.push('groupDir');
  }

  // groups/<folder>/CLAUDE.local.md — per-group agent memory, auto-loaded by
  // Claude Code. Seeded with caller-provided instructions on first creation.
  const claudeLocalFile = path.join(groupDir, 'CLAUDE.local.md');
  if (!fs.existsSync(claudeLocalFile)) {
    const body = opts?.instructions ? opts.instructions + '\n' : '';
    fs.writeFileSync(claudeLocalFile, body);
    initialized.push('CLAUDE.local.md');
  }

  // groups/<folder>/container.json — empty container config, replaces the
  // former agent_groups.container_config DB column. Self-modification flows
  // read and write this file directly.
  if (initContainerConfig(group.folder)) {
    initialized.push('container.json');
  }

  // 2. data/v2-sessions/<id>/.claude-shared/ — Claude state + per-group skills
  const claudeDir = path.join(DATA_DIR, 'v2-sessions', group.id, '.claude-shared');
  if (!fs.existsSync(claudeDir)) {
    fs.mkdirSync(claudeDir, { recursive: true });
    initialized.push('.claude-shared');
  }

  const settingsFile = path.join(claudeDir, 'settings.json');
  if (!fs.existsSync(settingsFile)) {
    fs.writeFileSync(settingsFile, DEFAULT_SETTINGS_JSON);
    initialized.push('settings.json');
  }

  // Skills directory — created empty here; symlinks are synced at spawn
  // time by container-runner.ts based on container.json skills selection.
  const skillsDst = path.join(claudeDir, 'skills');
  if (!fs.existsSync(skillsDst)) {
    fs.mkdirSync(skillsDst, { recursive: true });
    initialized.push('skills/');
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
