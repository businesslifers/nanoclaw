---
name: add-codegraph
description: Enable the codegraph code-intelligence MCP server for an agent group whose workspace holds a real source tree. codegraph is baked into the agent image; this wires a per-group MCP server (codegraph_explore) so the agent answers "how does X work / where is Y / what calls Z" in one call instead of a grep+read loop. Only useful for lanes that keep a full local checkout (TS/JS/Python/Go/Rust/etc.) — skip Handlebars-only or gh-api-patch lanes.
---

# Add codegraph — code-intelligence MCP server

[codegraph](https://github.com/colbymchenry/codegraph) builds a SQLite knowledge graph of a source tree (symbols, call edges, blast radius) via tree-sitter, and serves it over MCP as a single tool, `codegraph_explore`, which returns the relevant symbols' verbatim source plus the call paths among them in one call. It is the same tool already wired into this repo's host dev session (`.mcp.json` + `.codegraph/`); this skill brings it **into a team container**, scoped per agent group.

## How it works

- **Binary** is a self-contained GitHub-release tarball (bundles its own Node; MIT; no API key, no auth, no secret). Baked into the agent image at `/usr/local/bin/codegraph` — `additional_mounts` can't reach PATH dirs, so baking is the only option.
- **Per-group opt-in** via the `container_configs.mcp_servers` map in the central DB (NOT `container.json`, which is regenerated from the DB at spawn and would clobber a hand edit). The server is a small `/bin/sh` wrapper that `cd`s into the workspace, refuses to start if no index exists, then `exec`s `codegraph serve --mcp`.
- **Index** lives at `<workspace>/.codegraph/` (built once with `codegraph init`), persists across container restarts (the group folder is a RW persistent mount), and auto-syncs on file changes while the server runs.

## When NOT to use this

codegraph only pays off for a group whose workspace holds a **full local source tree** in a supported language (TS/JS, Python, Go, Rust, Java, C#, PHP, Ruby, C/C++, Swift, Kotlin, Scala, Dart, Lua, Svelte, Vue, Astro). Do **not** wire it for:

- Lanes that edit a remote via `gh api` patch scripts with **no local checkout** (nothing to index).
- **Ghost/Handlebars** theme lanes — `.hbs` is not a supported language.
- design / QA / DM / coordinator groups (no source tree).

The gating criterion is a **real source tree in a supported language**, not the provider. The per-group `mcp_servers` wiring works for **both claude and codex** — claude spawns the stdio server via the Agent SDK; codex translates the same `command`/`args`/`env` into `config.toml` `[mcp_servers.*]` (`container/agent-runner/src/providers/codex.ts`). The `instructions` field, however, only composes into the always-on prompt on claude — codex groups would need that guidance placed elsewhere.

## Phase 1 — Pre-flight

### Already applied?

```bash
grep -q 'CODEGRAPH_VERSION' container/Dockerfile && echo "image: applied" || echo "image: not applied"
```

If applied, re-run Phase 2 anyway — every step is idempotent and skips work already in place (so a re-run is safe AND a version bump is not blocked) — then continue to Phase 3 (wire a group).

### Latest version + checksums

```bash
gh api repos/colbymchenry/codegraph/releases/latest --jq '.tag_name'
url=$(gh api repos/colbymchenry/codegraph/releases/latest --jq '.assets[]|select(.name=="SHA256SUMS").browser_download_url')
curl -fsSL "$url"
```

Note the tag (e.g. `v1.1.1`) and the SHA256 for `codegraph-linux-x64.tar.gz` and `codegraph-linux-arm64.tar.gz`. Use them as `CODEGRAPH_VERSION` and the two `SHA=` values in the Dockerfile block below.

## Phase 2 — Bake the binary into the image

### 1. Dockerfile

Skip this whole step if `grep -q 'CODEGRAPH_VERSION' container/Dockerfile` already matches (the layer is in place; only edit the existing block when bumping the version + SHAs).

Add the version ARG to the pinned-ARG block (next to `RTK_VERSION`, ~line 38):

```dockerfile
ARG CODEGRAPH_VERSION=1.1.1
```

Add the install block immediately **after** the `rtk` block and **before** the first `pnpm install -g` (it belongs with the other static-tarball CLIs — supabase/gh/rtk). codegraph ships a **nested** tarball (`codegraph-linux-<arch>/bin/codegraph` + bundled `lib/` and `node`), so extract the whole dir with `--strip-components=1` and symlink the binary — do NOT `install` a single file:

```dockerfile
# codegraph — code-intelligence MCP server. Self-contained GitHub-release tarball
# (bundles its own Node), pinned + SHA-256 verified per arch; build fails closed
# on mismatch. The archive nests bin/codegraph + lib/ + node under one dir, so
# strip it and symlink the binary onto PATH (additional_mounts can't reach PATH).
RUN ARCH="$(uname -m)" && \
    case "$ARCH" in \
      x86_64|amd64)  CGARCH="x64";   SHA="0be7013c579227284e8032f8a369770ad02663d67a13478781590a30dd57ee7f";; \
      aarch64|arm64) CGARCH="arm64"; SHA="289bc3351a2b5e5b760082ae59b340aac510fa34ebec31da549696425a6c76ec";; \
      *) echo "unsupported arch for codegraph: $ARCH" >&2; exit 1;; \
    esac && \
    curl -fsSL -o /tmp/codegraph.tar.gz \
      "https://github.com/colbymchenry/codegraph/releases/download/v${CODEGRAPH_VERSION}/codegraph-linux-${CGARCH}.tar.gz" && \
    echo "${SHA}  /tmp/codegraph.tar.gz" | sha256sum -c - && \
    mkdir -p /opt/codegraph && \
    tar -xzf /tmp/codegraph.tar.gz -C /opt/codegraph --strip-components=1 && \
    ln -sf /opt/codegraph/bin/codegraph /usr/local/bin/codegraph && \
    rm -f /tmp/codegraph.tar.gz && \
    codegraph --version
```

If you bump the version, update both `SHA=` values from the release's `SHA256SUMS`.

### 2. Structural test

Copy the test into the host test tree and run it (the Dockerfile reach-in isn't importable, so a structural test guards it from being dropped on an upgrade):

```bash
cp .claude/skills/add-codegraph/codegraph-dockerfile.test.ts src/codegraph-dockerfile.test.ts
pnpm exec vitest run src/codegraph-dockerfile.test.ts
```

### 3. Rebuild and smoke-test the image

The buildkit caches COPY/RUN layers aggressively; prune the builder first for a clean rebuild (see CLAUDE.md "Container Build Cache").

```bash
docker builder prune -f
./container/build.sh
# This install's image is slug-scoped (not the generic nanoclaw-agent:latest) —
# resolve it the same way build.sh does:
IMG="$(bash -c 'source setup/lib/install-slug.sh; container_image_base'):latest"
docker run --rm --entrypoint codegraph "$IMG" --version   # expect: 1.1.1
```

## Phase 3 — Wire a group (per-group opt-in)

Replace `<GROUP>` with the agent-group folder (e.g. `dev-react-launchmate`). This resolves the id, writes the MCP server (with an always-on instructions block) into the DB, builds the index, and restarts.

### 1. Resolve the group id and confirm it qualifies

```bash
pnpm exec tsx scripts/q.ts data/v2.db \
  "SELECT id, folder, agent_provider FROM agent_groups WHERE folder='<GROUP>'"
```

Confirm the workspace holds a real source tree: `ls groups/<GROUP>` should show app source (a `package.json`, `apps/`, `src/`, etc.), not just agent scaffolding (`wiki/`, `conversations/`, `CLAUDE.*`). A blank/NULL `agent_provider` is normal — it resolves to `claude` at runtime; the authoritative provider is `container_configs.provider`. The wiring below works for claude and codex alike.

### 2. Write the MCP server config to the DB

The wrapper `cd`s into `/workspace/agent`, refuses to start if the index is missing (so a half-wired group never crashes the session — the tool just goes absent, the figma pattern), then serves. The `instructions` field is composed into the agent's always-on system prompt so it actually reaches for the tool.

```bash
GID=$(pnpm exec tsx scripts/q.ts data/v2.db "SELECT id FROM agent_groups WHERE folder='<GROUP>'")
pnpm exec tsx -e '
import { initDb } from "./src/db/connection";
import { getContainerConfig, updateContainerConfigJson } from "./src/db/container-configs";
initDb("data/v2.db");
const gid = process.argv[1];
const cfg = getContainerConfig(gid);
if (!cfg) { console.error("no container_config row for", gid); process.exit(1); }
const servers = JSON.parse(cfg.mcp_servers || "{}");
servers.codegraph = {
  command: "/bin/sh",
  args: ["-c", "cd /workspace/agent && { test -d .codegraph || { echo \"codegraph: no index at /workspace/agent/.codegraph — run codegraph init in the group workspace\" >&2; exit 1; }; } && exec codegraph serve --mcp"],
  env: {},
  instructions: "## codegraph — code intelligence\nYour source tree at /workspace/agent is indexed by codegraph. BEFORE grep/find or reading files to understand or locate code, call the codegraph_explore MCP tool (mcp__codegraph__codegraph_explore) — one call returns the relevant symbols verbatim source plus call paths and blast radius. Name a file or symbol to read its current source. Fall back to grep only when codegraph returns nothing."
};
updateContainerConfigJson(gid, "mcp_servers", servers);
console.log("wired codegraph for", gid);
' "$GID"
```

(This per-group write is a runtime DB action with no in-tree source line, so a registration test is structurally inapplicable — per skill-guidelines, the Dockerfile install is the only code reach-in and is guarded by `codegraph-dockerfile.test.ts`.)

### 3. Build the index

Build it in a throwaway container from the freshly-built image (no host codegraph needed). `groups/<GROUP>/` mounts at `/workspace/agent`, so the index lands at `groups/<GROUP>/.codegraph/` on the host and persists:

```bash
IMG="$(bash -c 'source setup/lib/install-slug.sh; container_image_base'):latest"
docker run --rm -v "$PWD/groups/<GROUP>:/workspace/agent" \
  --entrypoint /bin/sh "$IMG" \
  -c 'cd /workspace/agent && codegraph init && codegraph status'
```

`codegraph init` operates on the current directory, skips `node_modules`/gitignored paths, and writes `.codegraph/`. It does not need committing — codegraph writes its own `.gitignore`. Run this off-peak: the initial index build is CPU-heavy on a large tree.

### 4. Restart so the agent picks up the new config + instructions

```bash
pnpm exec tsx src/cli/client.ts groups restart --id "$GID"
```

(For a cold group with no running container, the next inbound message spawns it with the new config — no explicit restart needed.)

## Phase 4 — Verify

```bash
IMG="$(bash -c 'source setup/lib/install-slug.sh; container_image_base'):latest"

# baked binary works in the image
docker run --rm --entrypoint codegraph "$IMG" --version

# the container can read the mounted index through the exact serve cwd
docker run --rm -v "$PWD/groups/<GROUP>:/workspace/agent" \
  --entrypoint /bin/sh "$IMG" -c 'cd /workspace/agent && codegraph status'

# the index is queryable from the image
docker run --rm -v "$PWD/groups/<GROUP>:/workspace/agent" \
  --entrypoint /bin/sh "$IMG" \
  -c 'cd /workspace/agent && codegraph explore "<a symbol you expect in the tree>"'
```

Then exercise it end-to-end: send the group a message that requires understanding its own code and confirm it calls `mcp__codegraph__codegraph_explore` (visible in the session transcript) rather than grepping.

## Troubleshooting

- **`codegraph: command not found` in the container** — the image wasn't rebuilt. `docker builder prune -f && ./container/build.sh`, then restart.
- **`codegraph_explore` returns nothing / server won't start** — the index is missing. Run Phase 3 step 3 (`codegraph init`) in `groups/<GROUP>/`; confirm `groups/<GROUP>/.codegraph/codegraph.db` exists.
- **Index seems stale** — the server auto-syncs while running; force a rebuild with `( cd groups/<GROUP> && codegraph sync )`. To disable the background watcher entirely, add `"CODEGRAPH_NO_DAEMON": "1"` to the server's `env`.
- **Wrong tree indexed** — `codegraph init` indexes from the workspace root down. If the group's workspace mixes agent scaffolding with source, that's fine (codegraph only parses code files), but a huge index means `node_modules` wasn't excluded — confirm a `.gitignore` lists it.

## Remove

See `REMOVE.md` — strips the Dockerfile block + ARG, deletes the copied test, and (per group) removes the `codegraph` entry from `container_configs.mcp_servers` and the `.codegraph/` index.
