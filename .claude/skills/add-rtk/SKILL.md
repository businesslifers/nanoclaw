---
name: add-rtk
description: Enable the rtk token-compression proxy for an agent group. rtk is baked into the agent image; this wires a Claude Code PreToolUse hook so Bash calls route through it for 60–90% token savings on dev commands (git, cargo, pytest, docker, kubectl, etc.).
---

# Add rtk

[rtk](https://github.com/rtk-ai/rtk) is a CLI proxy delivering 60–90% token savings on common dev commands (git, cargo, pytest, docker, kubectl, etc.). It hooks into Claude Code via a `PreToolUse` hook that rewrites each Bash command to run through `rtk`.

## How rtk works on this fork — read first

The rtk binary is **baked into the agent image** at `/usr/local/bin/rtk`, not mounted. This is deliberate: this fork's mount-security model (`src/modules/mount-security/index.ts`) confines every `additional_mounts` entry under `/workspace/extra/<relative-path>` and **rejects absolute container paths** — so a binary cannot be mounted onto a `PATH` directory like `/usr/local/bin`. Baking it in (Dockerfile, the same way supabase/gh are installed) is the only way to get `rtk` on `PATH` in every group.

**Do NOT add an `additional_mounts` entry for rtk.** It will be rejected (`Additional mount REJECTED` in the host log) and is unnecessary — the image already carries the binary. Enabling rtk for a group is therefore just **wiring the hook** (Step 2) and **restarting** (Step 3).

## What this sets up

- rtk baked into the agent image at `/usr/local/bin/rtk` (Dockerfile, pinned + SHA-256 verified) — image-wide, done once
- A `PreToolUse` hook in the target group's `settings.json` so every Bash call is rewritten through rtk — per group

## Integration tests

This skill has **no in-tree integration test** by design. Its only functional reach-ins are runtime operator actions — the Dockerfile `ARG RTK_VERSION` + `RUN` block (Step 1, verified by the in-build `rtk --version` / `sha256sum -c` checks) and the `settings.json` `PreToolUse` hook write (Step 2) — neither of which leaves application source whose deletion a test could catch. Conformance is idempotent apply + `REMOVE.md`; the binary and hook are verified at runtime (see Verify).

## Step 1 — Ensure rtk is baked into the image

Check the Dockerfile already installs rtk:

```bash
grep -n 'RTK_VERSION' container/Dockerfile
```

**If the `ARG RTK_VERSION` + rtk `RUN` block are present**, confirm the current image has the binary and skip to Step 2:

```bash
IMG="$(docker images --format '{{.Repository}}:{{.Tag}}' | grep -m1 'nanoclaw-agent')"
docker run --rm --entrypoint sh "$IMG" -c 'rtk --version'
```

**If rtk is NOT in the Dockerfile** (fresh install), or you want to **bump the version**:

1. Look up the target version's per-arch SHA-256 from the release checksums:
   `https://github.com/rtk-ai/rtk/releases/download/v<version>/checksums.txt`
   (entries `rtk-x86_64-unknown-linux-musl.tar.gz` and `rtk-aarch64-unknown-linux-gnu.tar.gz`).
2. In `container/Dockerfile`, set `ARG RTK_VERSION=<version>` and ensure this `RUN` block exists after the `gh` install (update the two `SHA=` values to match the version):

   ```dockerfile
   ARG RTK_VERSION=0.42.3
   RUN ARCH="$(uname -m)" && \
       case "$ARCH" in \
         x86_64|amd64)  TARGET="x86_64-unknown-linux-musl"; \
                        SHA="5df764a633709cb85d248258d085d24ec95faa8bca0e6835a93cd57cadc4eb9e";; \
         aarch64|arm64) TARGET="aarch64-unknown-linux-gnu"; \
                        SHA="2b7fa09d06f8dbf334c55482fad2e7ce4a1f8564bc9ed1f65d9f5992db8e5527";; \
         *) echo "unsupported arch for rtk: $ARCH" >&2; exit 1;; \
       esac && \
       curl -fsSL -o /tmp/rtk.tar.gz \
         "https://github.com/rtk-ai/rtk/releases/download/v${RTK_VERSION}/rtk-${TARGET}.tar.gz" && \
       echo "${SHA}  /tmp/rtk.tar.gz" | sha256sum -c - && \
       tar -xzf /tmp/rtk.tar.gz -C /tmp && \
       install -m 0755 /tmp/rtk /usr/local/bin/rtk && \
       rm -rf /tmp/rtk.tar.gz /tmp/rtk && \
       rtk --version
   ```

3. Rebuild the image (the in-build `rtk --version` + `sha256sum -c` fail the build on a bad pin):

   ```bash
   ./container/build.sh
   ```

## Step 2 — Wire the PreToolUse hook for the target group

```bash
ncl groups list   # note the group ID, e.g. ag-1776342942165-ptgddd
```

Each group has a `settings.json` at `data/v2-sessions/<group-id>/.claude-shared/settings.json`, mounted at `/home/node/.claude/settings.json` and read by Claude Code for hooks. Add the `PreToolUse` entry with `jq` — this drops any existing rtk Bash hook first, so it is safe to re-run:

```bash
SETTINGS="data/v2-sessions/<group-id>/.claude-shared/settings.json"

jq '.hooks.PreToolUse = ((.hooks.PreToolUse // [])
      | map(select((.hooks // []) | any(.command == "rtk hook claude") | not)))
    + [{"matcher":"Bash","hooks":[{"type":"command","command":"rtk hook claude"}]}]' \
  "$SETTINGS" > /tmp/rtk-settings.json && mv /tmp/rtk-settings.json "$SETTINGS"
```

Repeat for each group you want rtk enabled on.

## Step 3 — Restart the group

```bash
ncl groups restart --id <group-id>
```

The hook is read from `settings.json` on the next container spawn; a restart applies it immediately to a running group.

## Verify

Confirm the binary resolves inside a running container, then exercise the hook:

```bash
docker exec "$(docker ps --filter "name=<group-id>" --format '{{.Names}}' | head -1)" rtk --version
```

Then ask the agent to run `git status` (or any supported command). The hook rewrites it to `rtk git status` and rtk emits compressed output. Check savings:

```bash
rtk gain   # inside the container, or on the host if rtk is installed there too
```

## Troubleshooting

### `rtk: command not found` inside the container

The **image** doesn't have rtk — this is NOT a mount problem. Confirm and rebuild via Step 1:

```bash
IMG="$(docker images --format '{{.Repository}}:{{.Tag}}' | grep -m1 'nanoclaw-agent')"
docker run --rm --entrypoint sh "$IMG" -c 'command -v rtk || echo MISSING'
```

Do **not** try to fix this by adding an `additional_mounts` entry — absolute container paths are rejected and a relative one lands at `/workspace/extra/rtk`, which is off `PATH`.

### Hook not firing

Verify the hook is in `settings.json`:

```bash
jq '.hooks.PreToolUse' data/v2-sessions/<group-id>/.claude-shared/settings.json
```

If missing, re-run Step 2, then restart (Step 3).
