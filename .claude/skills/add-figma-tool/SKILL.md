---
name: add-figma-tool
description: Add Figma as an MCP tool (read-only — get design context, download images) using the figma-developer-mcp community server. Wired per-group via container.json so only opted-in groups get Figma access. Requires a Figma personal access token from https://www.figma.com/developers/api#access-tokens.
---

# /add-figma-tool — Figma MCP integration

Adds the [`figma-developer-mcp`](https://www.npmjs.com/package/figma-developer-mcp) stdio MCP server to the agent container image, plus an agent-side container skill that teaches the agent how to use the Figma tools effectively.

Tools exposed to the agent (as `mcp__figma__<name>`):
- `get_figma_data` — extract layout/style/component tree for a file or a specific node
- `download_figma_images` — download SVG/PNG assets from Figma nodes

**Read-only.** This server cannot edit, comment on, or create Figma content. For write access, use Figma's official Dev Mode MCP server, which requires the Figma desktop app running on the host (not portable to headless Linux).

## What this skill is NOT

- Not OneCLI-managed in the usual way. OneCLI's HTTPS proxy mangles the `X-Figma-Token` header at request time, so credentials are forwarded to the container as a `FIGMA_API_KEY` env var (host `.env` → container env). This is the same approach the upstream `figma` skill arrived at after debugging the proxy interaction.
- Not enabled by default for any group. Each group opts in via its own `container.json`. Groups without the `figma` mcpServer entry get nothing.

## Phase 0: Pre-flight

```bash
# Helper — exits with a clear message if anything's wrong.
problems=()
[ -f container/Dockerfile ]               || problems+=("container/Dockerfile missing — wrong working directory?")
[ -f src/container-runner.ts ]            || problems+=("src/container-runner.ts missing — not a NanoClaw v2 install")
grep -q 'FIGMA_DEVELOPER_MCP_VERSION' container/Dockerfile 2>/dev/null \
  && problems+=("FIGMA_DEVELOPER_MCP_VERSION already in Dockerfile — skill may already be applied")
[ ! -d container/skills/figma ] \
  || problems+=("container/skills/figma/ already exists — skill may already be applied")
if [ ${#problems[@]} -gt 0 ]; then
  printf 'PRECONDITION FAILED:\n'; printf '  - %s\n' "${problems[@]}"
  echo 'Resolve the above before re-running.'
  exit 1
fi
echo 'Preconditions OK — safe to apply.'
```

## Phase 1: Apply

### 1. Pin the figma-developer-mcp version in the Dockerfile

Edit `container/Dockerfile`:

```diff
 ARG CLAUDE_CODE_VERSION=2.1.116
 ARG AGENT_BROWSER_VERSION=latest
 ARG VERCEL_VERSION=latest
 ARG BUN_VERSION=1.3.12
+ARG FIGMA_DEVELOPER_MCP_VERSION=0.11.0
```

And add a new pnpm-install block after the `claude-code` block:

```diff
 RUN --mount=type=cache,target=/root/.cache/pnpm \
     pnpm install -g "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}"
+
+RUN --mount=type=cache,target=/root/.cache/pnpm \
+    pnpm install -g "figma-developer-mcp@${FIGMA_DEVELOPER_MCP_VERSION}"
```

Bump the version deliberately when needed — `figma-developer-mcp` does not have a `minimumReleaseAge` policy applied since it's installed via the Dockerfile pnpm-global path, not the project lockfile.

### 2. Forward the API key from host env to the container

Edit `src/container-runner.ts`. Find the env-injection block (around line 441 — search for the comment `Environment — only vars read by code we don't own`) and add the FIGMA_API_KEY hunk:

```diff
   // Environment — only vars read by code we don't own.
   // Everything NanoClaw-specific is in container.json (read by runner at startup).
   args.push('-e', `TZ=${TIMEZONE}`);

+  // FIGMA_API_KEY is consumed inline by the figma MCP server's launcher
+  // (see container.json mcpServers.figma). The OneCLI HTTPS proxy can't
+  // inject this header cleanly so the token is forwarded directly.
+  if (process.env.FIGMA_API_KEY) {
+    args.push('-e', `FIGMA_API_KEY=${process.env.FIGMA_API_KEY}`);
+  }
+
   // Provider-contributed env vars (e.g. XDG_DATA_HOME, OPENCODE_*, NO_PROXY).
```

### 3. Drop in the container-side agent skill

```bash
mkdir -p container/skills/figma
cp .claude/skills/add-figma-tool/resources/container-skill-figma.md \
   container/skills/figma/SKILL.md
```

This is the agent's how-to-use-Figma instructions — workflow, URL parsing rules, implementation standards.

### 4. Rebuild the container image

```bash
./container/build.sh
```

This pulls `figma-developer-mcp@0.11.0` into the image at `/pnpm/figma-developer-mcp` (on `PATH`).

### 5. Compile the host

```bash
pnpm run build
```

## Phase 2: Configure the API key

Get a personal access token from https://www.figma.com/developers/api#access-tokens (Account settings → Personal access tokens → Generate new token). Read-only file access is sufficient.

Add to `.env` at the install root:

```
FIGMA_API_KEY=figd_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Restart NanoClaw so new container spawns pick up the env var:

```bash
# Linux (systemd):
systemctl --user restart nanoclaw
# macOS (launchd):
# launchctl kickstart -k gui/$(id -u)/com.nanoclaw
```

### Why .env and not OneCLI

OneCLI's vault is designed for HTTPS request-time injection via its MITM proxy. Figma's `X-Figma-Token` header doesn't survive that pattern (the proxy strips/replaces auth headers it doesn't recognize as managed). The `figma-developer-mcp` server takes the token as a CLI argument, not a request header, so it has to be available to the process at spawn time — meaning env var.

If you want centralized rotation, store the token in any secret manager you have and have a hook update `.env` + restart NanoClaw on rotation. The skill itself doesn't try to wrap that.

## Phase 3: Opt a group in

Edit the target group's `container.json` (e.g. `groups/<folder>/container.json`) — add the `figma` server to `mcpServers`:

```json
{
  "mcpServers": {
    "figma": {
      "command": "/bin/sh",
      "args": [
        "-c",
        "test -n \"$FIGMA_API_KEY\" || { echo 'figma MCP: FIGMA_API_KEY not set on host (.env)' >&2; exit 1; }; unset HTTPS_PROXY HTTP_PROXY https_proxy http_proxy; exec figma-developer-mcp --figma-api-key=\"$FIGMA_API_KEY\" --stdio"
      ],
      "env": {}
    }
  },
  "...": "preserve other existing fields"
}
```

The wrapper:
1. Bails fast with a clear stderr message if `FIGMA_API_KEY` isn't forwarded (so misconfigured groups don't crash mysteriously).
2. Clears `HTTPS_PROXY` / `HTTP_PROXY` env vars so the OneCLI gateway doesn't intercept the Figma API call (would mangle the auth header).
3. Execs `figma-developer-mcp` with the API key on the CLI and stdio transport.

The container skill at `container/skills/figma/SKILL.md` is automatically available to any group whose `skills` config includes `figma` (or `"all"`). You don't need to add it per group.

## Phase 4: Verify

Send a message to an opted-in group asking for Figma data:

> Get the design context for `https://www.figma.com/design/abc123/Demo?node-id=1-2`

The agent should call `mcp__figma__get_figma_data` with `fileKey=abc123` and `nodeId=1:2` (note the colon — the URL form `1-2` is converted to API form `1:2`) and return a structured layout tree.

If the call fails with `401`:
- The token is invalid or revoked. Generate a new one in Figma and update `.env`.
- The token doesn't have access to that file. Figma personal access tokens are scoped to files the token owner can see.

If the call fails with the launcher's `FIGMA_API_KEY not set` message:
- The host hasn't been restarted since adding `FIGMA_API_KEY` to `.env`. Restart NanoClaw and try again.

## Rollback

```bash
# Remove from the Dockerfile
sed -i '/FIGMA_DEVELOPER_MCP_VERSION/d' container/Dockerfile
sed -i '/figma-developer-mcp@/,/CACHE/d' container/Dockerfile  # may need manual cleanup

# Remove host-side env injection
# (manually revert the FIGMA_API_KEY hunk in src/container-runner.ts)

# Remove container skill
rm -rf container/skills/figma

# Remove from each group's container.json (manually delete the figma mcpServer entry)

# Remove from .env
sed -i '/^FIGMA_API_KEY=/d' .env

# Rebuild
./container/build.sh
pnpm run build
systemctl --user restart nanoclaw
```

## Updating

Distributed via the `private` remote on branch `skill/figma-tool`. Re-running `/update-private-skills` pulls new commits when the `figma-developer-mcp` version pin is bumped or the agent instructions are tuned.

To bump the figma-developer-mcp version:
1. Edit `container/Dockerfile` ARG default
2. `./container/build.sh`
3. Restart NanoClaw

No `.env` change needed for version bumps.
