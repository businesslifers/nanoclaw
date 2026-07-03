---
name: add-work-items
description: Install the cross-team work-item store — the host-side feature that backs the dashboard-pro Work Items page and the agent-side work-item MCP tools. Central `work_items` table + per-session projection, a reliability sweep (delegation nags, deliverable tier cascade, weekly cadence RAG), and the container `create_work_item`/`list_work_items` tools. Dashboard-independent core: works headless. Run this BEFORE `/add-dashboard-pro`, whose Work Items page is only the UI over this store. Triggers on "add work items", "work item feature", "install work-items", "dashboard work items backend".
---

# Add Work Items (host-side cross-team store)

The **dashboard-pro Work Items page is only the front half** of a feature. This
skill installs the **back half** — the host-side work-item store — which
`/add-dashboard-pro` deliberately does not ship (its patch is dashboard-package
only). Without this feature in the tree, dashboard-pro's copied pusher/mutators
import `collectWorkItems` / the work-item mutators from files that don't exist
and the build fails.

What it installs (dashboard-independent — the agent tools + sweep work with no
dashboard at all):

- **Central store** — `work_items` + `work_item_notes` tables (migration `103`),
  DB helpers (`src/db/work-items.ts`, `src/db/work-item-notes.ts`).
- **Module** — `src/modules/work-items/` (actions, projection, sweep, wake,
  period): the reliability sweep (delegation follow-ups, deliverable tier
  cascade, weekly cadence RAG) and the per-session projection writer.
- **Session projection** — `work_items_cache` in each session's `inbound.db`,
  rewritten on container wake so the agent reads current state offline.
- **Agent tools** — `container/agent-runner/src/mcp-tools/work-items.ts`
  (`create_work_item`, `list_work_items`, …) reading the projection.
- **Wiring** — 8 idempotent anchored inserts into `modules/index.ts`,
  `db/migrations/index.ts`, `db/schema.ts`, `db/session-db.ts`,
  `session-manager.ts`, `host-sweep.ts`, `container-runner.ts`, and the
  agent-runner mcp-tools barrel.

Provenance: cut from `businesslifers/derek-v2` commits `70d916a6` +
`4f21b127`. If the host feature is ever published upstream, prefer that.

## Prerequisites

- A NanoClaw v2 install. No channel/provider/dashboard prerequisite — the core
  is dashboard-independent.
- `node` and `pnpm` on the host; `bun` for the agent-runner (already present in
  a standard install).

## Steps

Run everything from the NanoClaw project root.

### 1. Idempotence check

If the feature is already installed, stop — re-running is safe but pointless.

```bash
if grep -q "migration103" src/db/migrations/index.ts 2>/dev/null; then
  echo "work-items already installed — nothing to do."; exit 0
fi
```

### 2. Copy the new source files

These are whole-file creations (never overwrite existing files):

```bash
S=.claude/skills/add-work-items/resources
cp -r "$S/src/."       src/
cp -r "$S/container/." container/
```

That lands `src/db/work-items.ts`, `src/db/work-item-notes.ts`,
`src/db/migrations/103-work-items.ts`, `src/modules/work-items/*` (+ tests),
and `container/agent-runner/src/mcp-tools/work-items.{ts,instructions.md}`.

### 3. Apply the wiring

`wire.mjs` performs the 8 in-place edits. Every edit is guarded (idempotent)
and anchored on text present on both upstream trunk and forks, so it survives
version drift — no git-patch ancestor dependency.

```bash
node .claude/skills/add-work-items/resources/wire.mjs
```

Expect a `+`/`=` line per edit and `all wiring applied`. If it prints
`ANCHOR NOT FOUND` and exits non-zero, the tree has drifted past what this
skill version understands — **do not build**; report it. (Re-running only ever
prints `= already present`.)

### 4. Build

```bash
pnpm run typecheck        # host tsc — must be clean
pnpm run build
pnpm exec tsc -p container/agent-runner/tsconfig.json --noEmit   # agent-runner types
./container/build.sh      # rebake the agent image (the MCP tool is agent-side)
```

Migration `103` self-applies on the next host start; no manual migration step.

### 5. Verify

Run the shipped tests — they exercise migration 103 + the module logic against
a fresh in-memory DB:

```bash
pnpm exec vitest run src/db/work-items.test.ts src/modules/work-items/
```

All should pass. Then restart the host service so the sweep + migration go
live (derive this install's unit via `setup/lib/install-slug.sh`).

### 6. Then dashboard (optional)

If you want the human-facing Kanban/List/Timeline views, run `/add-dashboard`
(if not already) then `/add-dashboard-pro`. Its Work Items page is the UI over
this store; with this skill installed, its pusher/mutators now resolve and its
build succeeds.

## Notes

- **Headless is fine.** The agent tools (`create_work_item`/`list_work_items`)
  and the reliability sweep run with no dashboard. Only the human views need
  dashboard-pro.
- **The two `dashboard-work-items*.ts` files are NOT installed here** — they
  are dashboard-coupled (they import the base dashboard's pusher/mutators +
  `db/dashboard-audit`) and ship with `/add-dashboard-pro`, next to the files
  that import them.
- **Idempotent.** Safe to re-run; already-applied edits are skipped.
