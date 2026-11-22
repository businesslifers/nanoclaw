---
name: add-impeccable
description: Add the Impeccable design discipline (1 skill + 23 sub-commands + anti-pattern CLI) to NanoClaw agents. Fetches the upstream impeccable skill bundle, drops it into container/skills/impeccable, and adds the `impeccable` CLI to the agent image. Use when the user wants agents — especially design or QA mates — to follow a shared, deterministic design vocabulary (polish, audit, critique, distill, animate, bolder, quieter, etc.) and anti-pattern detection (side-stripe borders, purple gradients, bounce easing, etc.).
---

# Add Impeccable

This skill gives NanoClaw agents access to [Impeccable](https://github.com/pbakaus/impeccable) — a design language with 7 domain references (typography, color, spatial, motion, interaction, responsive, UX writing), 23 sub-commands (`/impeccable polish`, `/impeccable critique`, …), and a CLI that detects 24+ deterministic anti-patterns. It mirrors the install shape of `/add-vercel` and `/add-supabase`: drop a container skill into `container/skills/`, add a pinned CLI to `container/cli-tools.json`, sync running sessions, restart containers.

**Principle:** Do the work — don't tell the user to do it. No tokens, no OAuth, no manual steps. Pure install.

## Pinned versions

This skill installs:

- **Impeccable skill bundle** — `skill-v4.10.0` (tag on `pbakaus/impeccable`)
- **Impeccable CLI** — `impeccable@4.10.0` (npm)

Bump these together. Since 4.x the skill's `scripts/impeccable` launcher pins an engine version (`scripts/VERSION`), and the npm CLI is a shim over a platform binary (`@impeccable/cli-<os>-<arch>`, an optional dependency pnpm installs alongside it). The launcher only uses the `impeccable` on `PATH` when its `engine-probe` reports that same engine version. On a mismatch it tries to download the engine at runtime into `~/.impeccable/`, which needs network inside the container. Before bumping, check the pair: `scripts/VERSION` at the skill tag must equal the npm CLI's `@impeccable/cli-linux-x64` optionalDependency version. Both must also be past the 3-day release-age window.

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
IMPECCABLE_SKILL_TAG="skill-v4.10.0"
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

Pin `impeccable` in `container/cli-tools.json` — the manifest the image installs global Node CLIs from (via pnpm, exact versions only). This mirrors how `vercel`, `agent-browser`, and `claude-code` are wired; never add it to the Dockerfile.

```bash
grep -q '"impeccable"' container/cli-tools.json && echo "PRESENT" || echo "MISSING"
```

If `MISSING`:

1. Append `{ "name": "impeccable", "version": "4.10.0" }` to the array in `container/cli-tools.json` (exact version — the manifest test rejects ranges).
2. If an older install still has `ARG IMPECCABLE_VERSION` and a `pnpm install -g "impeccable@…"` block in `container/Dockerfile`, delete both.
3. Rebuild:

   ```bash
   ./container/build.sh
   ```

4. Verify the binary lands in the image:

   ```bash
   docker run --rm --entrypoint sh "$(docker images --format '{{.Repository}}:{{.Tag}}' | grep '^nanoclaw-agent-v2-' | head -1)" -c 'impeccable --version; IMPECCABLE_LAUNCHER_PROBE=1 impeccable engine-probe'

   The probe must print `impeccable-engine <v>`, where `<v>` matches `container/skills/impeccable/scripts/VERSION`.
   ```

If `PRESENT`, skip — the image already has the CLI. (To upgrade, change its `version` in `cli-tools.json` and rebuild.)

## Phase 4: Clear stale per-group copies

No sync is needed. At every spawn the host links each selected shared skill into the group's `.claude-shared/skills/` as a symlink to `/app/skills/<name>`. That path is the read-only mount of `container/skills/`, so a re-fetch reaches every group as its sessions recycle.

The one thing that blocks it is a real directory left by older installs of this skill, which rsync'd a copy into each session. The host skips real entries rather than overwrite them, so that stale copy shadows the new bundle for good. Replace any such copy with the symlink:

```bash
for d in data/v2-sessions/*/.claude-shared/skills/impeccable; do
  [ -e "$d" ] && [ ! -L "$d" ] && rm -rf "$d" && ln -s /app/skills/impeccable "$d" && echo "relinked $d"
done
```

Check for local edits first (`diff -rq container/skills/impeccable <dir>`, ignoring the version bump itself). Groups that don't select `impeccable` have no entry and are untouched.

## Phase 5: Restart running containers

```bash
docker ps --filter label=nanoclaw-session --format '{{.ID}}' | xargs -r docker stop
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

- `/impeccable shape <surface>` — shape-then-build flow with visual iteration
- `/impeccable critique <surface>` — UX design review
- `/impeccable audit <surface>` — technical quality (a11y, perf, responsive)
- `/impeccable polish <surface>` — shipping-pass alignment
- `impeccable detect <path-or-url>` — deterministic anti-pattern CLI, no model required

Full command list: see `container/skills/impeccable/SKILL.md` `argument-hint`.

## Upstream bumps

To roll forward:

1. Edit the **Pinned versions** block in this SKILL.md (`IMPECCABLE_SKILL_TAG` and `IMPECCABLE_VERSION`).
2. Re-run `/add-impeccable`. The Phase 1 preflight will detect `INSTALLED`; choose "re-fetch and overwrite".
3. Bump the `impeccable` entry in `container/cli-tools.json` if the CLI version moved, then `./container/build.sh`.
4. Commit both files (this SKILL.md and `cli-tools.json`) on `main` and on `private-skills/skill/add-impeccable`. Per repo convention, private skill edits land in two places.
