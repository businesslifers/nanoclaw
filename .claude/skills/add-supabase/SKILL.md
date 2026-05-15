---
name: add-supabase
description: Add Supabase CLI capability to NanoClaw agents. Installs the Supabase CLI in agent containers and sets up OneCLI credential injection for api.supabase.com. Use when the user wants agents to deploy edge functions, manage projects, or otherwise drive Supabase from the CLI.
---

# Add Supabase

This skill gives NanoClaw agents the ability to drive Supabase from the CLI — deploy edge functions, manage projects, run migrations, etc. It installs the Supabase CLI in agent containers and configures OneCLI to inject Supabase credentials automatically.

**Principle:** Do the work — don't tell the user to do it. Only ask for their input when it genuinely requires manual action (pasting a token, or choosing which agents get the credential).

## Phase 1: Pre-flight

### Check if already applied

Check if the container skill exists:

```bash
test -d container/skills/supabase-cli && echo "INSTALLED" || echo "NOT_INSTALLED"
```

If `INSTALLED`, skip to Phase 3 (Configure Credentials).

### Check prerequisites

Verify OneCLI is working (required for credential injection):

```bash
onecli version 2>/dev/null && echo "ONECLI_OK" || echo "ONECLI_MISSING"
```

If `ONECLI_MISSING`, tell the user to run `/init-onecli` first, then retry `/add-supabase`. Stop here.

## Phase 2: Install Container Skill

Copy the bundled container skill into the container skills directory:

```bash
rsync -a .claude/skills/add-supabase/container-skills/ container/skills/
```

Verify:

```bash
head -5 container/skills/supabase-cli/SKILL.md
```

## Phase 3: Configure Credentials

### Check if Supabase credential already exists

```bash
onecli secrets list 2>/dev/null | grep -i supabase
```

If a Supabase credential already exists, skip to Phase 4.

### Set up Supabase access token

The agent needs a Supabase personal access token. Tell the user:

> I need your Supabase personal access token. Go to https://supabase.com/dashboard/account/tokens and create one with these settings:
>
> - **Name:** `nanoclaw` (or any name you'll recognize)
> - **Expiration:** Pick per your security policy; "No expiration" avoids rotation work
>
> After creating the token, copy it — you'll only see it once.

Once the user provides the token, add it to OneCLI:

```bash
onecli secrets create \
  --name "Supabase Access Token" \
  --type generic \
  --value "<TOKEN>" \
  --host-pattern "api.supabase.com" \
  --header-name "Authorization" \
  --value-format "Bearer {value}"
```

Verify:

```bash
onecli secrets list | grep -i supabase
```

### Assign the secret to selective-mode agents

Agents in `secretMode: "all"` already auto-receive every secret whose host pattern matches — no assignment needed (and calling `set-secrets` on them would flip them to `selective` and strip that auto-access). Only `selective`-mode agents need explicit assignment.

`set-secrets` REPLACES the entire list, so read-then-merge per agent. Ask the user which agents should get the credential (typical answers: only the dev-supabase Derek; all `mediamate` Dereks; all selective agents). Then run:

```bash
SUPABASE_SECRET_ID=$(onecli secrets list | jq -r '.[] | select(.name | test("(?i)supabase")) | .id' | head -1)

# Narrow this jq filter to the agents you want — e.g.
#   select(.secretMode=="selective" and (.identifier // "" | test("dev-supabase")))
# for just the dev-supabase Derek.
onecli agents list | jq -r '.[] | select(.secretMode=="selective") | "\(.id)\t\(.name)"' | \
while IFS=$'\t' read -r agent name; do
  CURRENT=$(onecli agents secrets --id "$agent" | jq -r '.[]')
  MERGED=$(printf '%s\n%s\n' "$CURRENT" "$SUPABASE_SECRET_ID" | grep -v '^$' | sort -u | paste -sd ',' -)
  STATUS=$(onecli agents set-secrets --id "$agent" --secret-ids "$MERGED" | jq -r '.status')
  echo "$name ($agent): $STATUS"
done
```

## Phase 4: Ensure Supabase CLI in Container Image

The Supabase CLI is installed from the official `.deb` published on GitHub releases. The npm `supabase` package explicitly refuses global install (`"Installing Supabase CLI as a global module is not supported"`), so don't go through pnpm.

Check if `supabase` is already present:

```bash
grep -q 'SUPABASE_VERSION' container/Dockerfile && echo "PRESENT" || echo "MISSING"
```

If `MISSING`:

1. Pick a current Supabase CLI version (check https://github.com/supabase/cli/releases). Add an `ARG SUPABASE_VERSION=<version>` next to the existing `ARG VERCEL_VERSION=...` line.
2. Add a new RUN layer after the pnpm-global block (or anywhere root-side before `USER node`) that fetches the .deb for the current arch and installs it. Mirror the pattern in the Dockerfile:

   ```dockerfile
   RUN ARCH="$(dpkg --print-architecture)" && \
       curl -fsSL -o /tmp/supabase.deb \
         "https://github.com/supabase/cli/releases/download/v${SUPABASE_VERSION}/supabase_${SUPABASE_VERSION}_linux_${ARCH}.deb" && \
       dpkg -i /tmp/supabase.deb && \
       rm /tmp/supabase.deb
   ```

   `dpkg --print-architecture` returns `amd64` or `arm64` — matches Supabase's asset naming.
3. Rebuild:

   ```bash
   ./container/build.sh
   ```

If `PRESENT`, skip — no rebuild needed.

Verify the binary is functional:

```bash
docker run --rm --entrypoint sh "$(docker images --format '{{.Repository}}:{{.Tag}}' | grep '^nanoclaw-agent-v2-' | head -1)" -c 'supabase --version'
```

## Phase 5: Sync Skills to Running Agent Groups

Container skills are copied once at group creation and not auto-synced. After installing or updating a container skill, sync it to all existing agent groups:

```bash
for session_dir in data/v2-sessions/ag-*; do
  if [ -d "$session_dir/.claude-shared/skills" ]; then
    rsync -a container/skills/ "$session_dir/.claude-shared/skills/"
    echo "Synced skills to: $session_dir"
  fi
done
```

## Phase 6: Restart Running Containers

Stop all running agent containers so they pick up the new skills on next wake:

```bash
docker ps --format "{{.ID}} {{.Names}}" | grep nanoclaw-v2 | awk '{print $1}' | xargs -r docker stop
```

## Done

The agent can now drive Supabase from the CLI. Key commands (always pass `SUPABASE_ACCESS_TOKEN=placeholder` so the CLI proceeds — OneCLI replaces the value at the proxy level):

- `SUPABASE_ACCESS_TOKEN=placeholder supabase functions deploy <name> --project-ref <ref>` — deploy an edge function
- `SUPABASE_ACCESS_TOKEN=placeholder supabase projects list` — list projects
- `SUPABASE_ACCESS_TOKEN=placeholder supabase secrets list --project-ref <ref>` — manage function secrets
