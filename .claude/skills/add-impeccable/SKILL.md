---
name: add-impeccable
description: Add the Impeccable design discipline (1 skill + 23 sub-commands + anti-pattern CLI) to NanoClaw agents. Fetches the upstream impeccable skill bundle, drops it into container/skills/impeccable, and adds the `impeccable` CLI to the agent image. Use when the user wants agents — especially design or QA mates — to follow a shared, deterministic design vocabulary (polish, audit, critique, distill, animate, bolder, quieter, etc.) and anti-pattern detection (side-stripe borders, purple gradients, bounce easing, etc.).
---

# Add Impeccable

This skill gives NanoClaw agents access to [Impeccable](https://github.com/pbakaus/impeccable) — a design language with 7 domain references (typography, color, spatial, motion, interaction, responsive, UX writing), 23 sub-commands (`/impeccable polish`, `/impeccable critique`, …), and a CLI that detects 24+ deterministic anti-patterns. It mirrors the install shape of `/add-vercel` and `/add-supabase`: drop a container skill into `container/skills/`, add a pinned CLI to the agent Dockerfile, sync running sessions, restart containers.

**Principle:** Do the work — don't tell the user to do it. No tokens, no OAuth, no manual steps. Pure install.

## Pinned versions

This skill installs:

- **Impeccable skill bundle** — `skill-v3.1.1` (tag on `pbakaus/impeccable`)
- **Impeccable CLI** — `impeccable@2.1.9` (npm)

Bump these together when a new release lands. Skill and CLI version independently upstream; check both before bumping.

## Phase 1: Pre-flight

### Check if already applied

```bash
test -d container/skills/impeccable && echo "INSTALLED" || echo "NOT_INSTALLED"
```

If `INSTALLED`, ask the user whether to (a) skip, (b) re-fetch and overwrite (use for upstream version bumps — confirm the pinned-version block in this SKILL.md has been updated first), or (c) abort. Default to skip.

### Check prerequisites

```bash
command -v gh >/dev/null && echo "GH_OK" || echo "GH_MISSING"
test -f container/Dockerfile && echo "DOCKERFILE_OK" || echo "DOCKERFILE_MISSING"
```

If `GH_MISSING`, install `gh` first (`apt install gh` on Linux, `brew install gh` on macOS) — the upstream fetch goes through the GitHub API, not git clone, because the bundle is in a sparse subdirectory and a shallow checkout is wasteful here. If `DOCKERFILE_MISSING`, this isn't a NanoClaw install — stop.

## Phase 2: Fetch and install the container skill

Fetch the upstream impeccable bundle at the pinned tag into `container/skills/impeccable/`. Use a temp clone with a sparse checkout — smaller than tarball download for a multi-MB subdirectory, and gives a clean source for diffing on later bumps.

```bash
IMPECCABLE_SKILL_TAG="skill-v3.1.1"
tmp=$(mktemp -d)
git -C "$tmp" init -q
git -C "$tmp" remote add origin https://github.com/pbakaus/impeccable.git
git -C "$tmp" config core.sparseCheckout true
echo ".claude/skills/impeccable/" > "$tmp/.git/info/sparse-checkout"
git -C "$tmp" fetch --depth 1 origin "refs/tags/${IMPECCABLE_SKILL_TAG}" -q
git -C "$tmp" checkout FETCH_HEAD -q

rm -rf container/skills/impeccable
mkdir -p container/skills/impeccable
cp -r "$tmp/.claude/skills/impeccable/." container/skills/impeccable/
rm -rf "$tmp"

ls container/skills/impeccable/
```

Expected output: `SKILL.md`, `reference/`, `scripts/`.

### Path remap — important

Upstream `SKILL.md` and the loader scripts reference `.claude/skills/impeccable/...`. Inside a NanoClaw agent container the skill mounts at `/app/skills/impeccable/...` (see `src/container-runner.ts:359`). Without a remap, `node .claude/skills/impeccable/scripts/load-context.mjs` would resolve to a non-existent path inside the container.

Splice a path-mapping note in between the upstream YAML frontmatter and the body. Don't edit the upstream paths in-place — keeps later upstream diffs clean.

```bash
SKILL=container/skills/impeccable/SKILL.md
# Find the line number of the closing `---` of the YAML frontmatter (i.e. the
# second `---` line in the file). awk uses a small state machine, with no
# `$0`-style interpolation that some harness loaders strip when rendering.
end_fm=$(awk '/^---$/{n=n+1; if(n==2){print NR; exit}}' "$SKILL")
{
  head -n "$end_fm" "$SKILL"
  cat <<'EOF'

> **NanoClaw path mapping** — this container skill lives at `/app/skills/impeccable/` (read-only mount from `container/skills/impeccable/` on the host). Where the upstream skill body below references `.claude/skills/impeccable/...`, substitute `/app/skills/impeccable/...` for every Bash invocation. Example: `node .claude/skills/impeccable/scripts/load-context.mjs` → `node /app/skills/impeccable/scripts/load-context.mjs`.

---
EOF
  tail -n +"$((end_fm+1))" "$SKILL"
} > "$SKILL.new" && mv "$SKILL.new" "$SKILL"

head -20 "$SKILL"
```

Verify the frontmatter is still at the top and the path-mapping note appears immediately after.

## Phase 3: Add the Impeccable CLI to the agent image

Pin `impeccable` in the pnpm-global block of `container/Dockerfile`. This mirrors how `vercel`, `agent-browser`, and `claude-code` are wired.

```bash
grep -q 'IMPECCABLE_VERSION' container/Dockerfile && echo "PRESENT" || echo "MISSING"
```

If `MISSING`:

1. Add `ARG IMPECCABLE_VERSION=2.1.9` next to the existing `ARG VERCEL_VERSION=...` line.
2. Add `pnpm install -g "impeccable@${IMPECCABLE_VERSION}"` in the same `RUN` block that installs `vercel` and `agent-browser`. Match its indentation and continuation style exactly.
3. Rebuild:

   ```bash
   ./container/build.sh
   ```

4. Verify the binary lands in the image:

   ```bash
   docker run --rm --entrypoint sh "$(docker images --format '{{.Repository}}:{{.Tag}}' | grep '^nanoclaw-agent-v2-' | head -1)" -c 'impeccable --version'
   ```

If `PRESENT`, skip — the image already has the CLI. (Bump the `ARG` value if you're upgrading; that path is a `MISSING`-treated rebuild.)

## Phase 4: Sync the skill to running agent groups

Per-session `.claude-shared/skills/` directories are seeded at session creation; they don't auto-pick-up new container skills. Push the new directory into each existing session's shared-skills dir, matching the pattern used by `/add-supabase` and `/add-vercel`:

```bash
for session_dir in data/v2-sessions/ag-*; do
  if [ -d "$session_dir/.claude-shared/skills" ]; then
    rsync -a container/skills/impeccable "$session_dir/.claude-shared/skills/"
    echo "Synced impeccable to: $session_dir"
  fi
done
```

## Phase 5: Restart running containers

```bash
docker ps --format "{{.ID}} {{.Names}}" | grep nanoclaw-v2 | awk '{print $1}' | xargs -r docker stop
```

Cold containers will pick the skill up on next wake. Containers that don't restart cleanly (rare) can be killed with `docker kill` and respawned by the next inbound message.

## Phase 6: Wire opinionated mates (optional)

Impeccable is broadly useful, but its real value lands on design and code-review mates. If the user has design or qa mates, add a one-line nudge to each mate's `CLAUDE.local.md` so the discipline is invoked by default rather than only when the user types `/impeccable …`:

```
- design-digital-* mates: append "Run `/impeccable critique` on every UI direction before sending. Use `/impeccable polish` for shipping-pass."
- qa-code-*, qa-accessibility-* mates: append "Use `/impeccable audit` for technical UI checks (a11y, performance, responsive) and `/impeccable critique` for design-quality review when reviewing UI diffs."
```

Skip this phase if the install has no design/qa mates yet — add the lines when those mates are created.

## Done

Verify by sending a parent agent a message like `"polish the landing page hero"` — if the agent loads the `impeccable` skill and runs `/impeccable polish hero`, the install is wired correctly.

Key invocations the agent now understands:

- `/impeccable craft <surface>` — shape-then-build flow with visual iteration
- `/impeccable critique <surface>` — UX design review
- `/impeccable audit <surface>` — technical quality (a11y, perf, responsive)
- `/impeccable polish <surface>` — shipping-pass alignment
- `impeccable detect <path-or-url>` — deterministic anti-pattern CLI, no model required

Full command list: see `container/skills/impeccable/SKILL.md` `argument-hint`.

## Upstream bumps

To roll forward:

1. Edit the **Pinned versions** block in this SKILL.md (`IMPECCABLE_SKILL_TAG` and `IMPECCABLE_VERSION`).
2. Re-run `/add-impeccable`. The Phase 1 preflight will detect `INSTALLED`; choose "re-fetch and overwrite".
3. Bump `ARG IMPECCABLE_VERSION` in `container/Dockerfile` if the CLI version moved (this triggers the rebuild path in Phase 3).
4. Commit both files (this SKILL.md and the Dockerfile) on `main` and on `private-skills/skill/add-impeccable`. Per repo convention, private skill edits land in two places.
