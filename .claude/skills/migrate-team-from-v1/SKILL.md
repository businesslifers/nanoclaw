---
name: migrate-team-from-v1
description: Port a NanoClaw v1 agent team into v2 — drives the migration interactively (sibling-detects v1, picks the channel, sets up secrets, wires the parent agent, ports filesystem + sub-agents as lane agents by default, recreates schedules, verifies). Use when the user says "port my v1 team", "migrate <team> from v1", "bring <team> into v2", or invokes /migrate-team-from-v1.
---

# Port a v1 team into v2

This skill drives the v1 → v2 team migration end-to-end. The two installs are architecturally distinct — there is no merge path. Each team is ported independently. Run v1 and v2 side-by-side until you have soaked v2 long enough to retire v1.

You (Claude) walk the user through 12 phases, asking only the decisions that genuinely vary per port. Detect what you can; ask only when ambiguous.

## Operating principles

- **Driver mode.** You execute commands and interpret output. You do not just print steps for the user to copy.
- **Verify before progressing.** Each phase has a verification gate. Don't move on if it fails.
- **Idempotent re-runs.** The helper scripts are idempotent; if a phase runs twice, no harm done.
- **One team at a time.** Don't try to batch multiple teams in one invocation.
- **Lanes by default.** Translate v1 sub-agents to lane agents unless the user opts out. See phase 4.
- **Channel-agnostic.** Detect installed channels; let the user pick. No baked channel preference.

## Phase 0 — Preflight

Run these checks. If any fails, stop and tell the user what to fix.

### 0a. Working tree

```bash
git status --porcelain
```

If non-empty, ask the user to commit or stash before continuing. A team port creates new files (groups/ folders, scripts) — a dirty tree muddies the diff.

### 0b. Locate the v1 install

Sibling-detect: scan the parent directory of the current working directory for sibling folders that look like a v1 install — presence of `store/messages.db` AND `groups/` AND no `data/v2.db`.

```bash
parent=$(dirname "$PWD")
for d in "$parent"/*/; do
  [ -f "$d/store/messages.db" ] && [ -d "$d/groups" ] && [ ! -f "$d/data/v2.db" ] && echo "$d"
done
```

- Exactly one match → use it. Tell the user "found v1 install at X."
- Zero matches → ask the user for the path.
- Multiple matches → list them and ask the user to pick.

Save the resolved path as `V1_PATH` for the rest of the session.

### 0c. Service manager

Detect how to restart v2 if needed. Try in order:

```bash
# Linux systemd (per-install unit)
for u in $(systemctl --user list-unit-files --no-legend 'nanoclaw-v2-*.service' 2>/dev/null | awk '{print $1}'); do
  systemctl --user cat "$u" 2>/dev/null | grep -q "WorkingDirectory=$PWD" && echo "systemd:$u" && break
done

# macOS launchd
launchctl list 2>/dev/null | grep -E 'nanoclaw' | awk '{print $3}' | head -1
```

Save the unit/label as `V2_SERVICE`. If neither found, note "manual restart required" — the user will restart however they normally do.

### 0d. Migrations at head

```bash
pnpm exec tsx scripts/run-migrations.ts
```

Idempotent. Confirms the central DB schema is current.

### 0e. OneCLI reachable (if used)

```bash
onecli agents list >/dev/null 2>&1 && echo "onecli-ok" || echo "onecli-not-running"
```

If not running, the user can still port a team that uses only filesystem-mounted secrets. Note the state and continue.

### 0f. Detect installed channels

List channel adapters present in the source tree, then check `.env` for known credential patterns. Build a table the user picks from in phase 3.

```bash
# Adapters present in the codebase
ls src/channels/*.ts 2>/dev/null | xargs -n1 basename | sed 's/\.ts$//' | grep -Ev '^(index|registry|chat-sdk-bridge|adapter)$'

# Credentials configured in .env (key = adapter, value = env var grep pattern)
# Examples — extend as channels are added:
grep -qE '^TELEGRAM_BOT_TOKEN=.+' .env 2>/dev/null && echo "telegram:configured"
grep -qE '^DISCORD_BOT_TOKEN=.+' .env 2>/dev/null && echo "discord:configured"
grep -qE '^SLACK_BOT_TOKEN=.+' .env 2>/dev/null && echo "slack:configured"
grep -qE '^WHATSAPP_(BAILEYS|SESSION)' .env 2>/dev/null && echo "whatsapp:configured"
grep -qE '^WHATSAPP_CLOUD_(ACCESS_TOKEN|PHONE_NUMBER_ID)' .env 2>/dev/null && echo "whatsapp_cloud:configured"
grep -qE '^IMESSAGE_(API_KEY|MODE)=' .env 2>/dev/null && echo "imessage:configured"
grep -qE '^MATRIX_(ACCESS_TOKEN|HOMESERVER)=' .env 2>/dev/null && echo "matrix:configured"
grep -qE '^TEAMS_(BOT_ID|APP_PASSWORD)=' .env 2>/dev/null && echo "teams:configured"
grep -qE '^WEBEX_BOT_TOKEN=.+' .env 2>/dev/null && echo "webex:configured"
grep -qE '^GCHAT_(SERVICE_ACCOUNT|PROJECT_ID)' .env 2>/dev/null && echo "gchat:configured"
grep -qE '^LINEAR_API_KEY=.+' .env 2>/dev/null && echo "linear:configured"
grep -qE '^GITHUB_(APP_ID|TOKEN)=' .env 2>/dev/null && echo "github:configured"
grep -qE '^RESEND_API_KEY=.+' .env 2>/dev/null && echo "resend:configured"
```

Categorize:

- **Installed and configured** — adapter file present + credentials in `.env`
- **Installed only** — adapter file present, credentials not configured
- **Not installed** — adapter file absent (omit from the picker)

Save the categorized list for phase 3. Don't recommend one — the user picks based on what the team needs.

## Phase 1 — Pick the team

List candidates under `<V1_PATH>/groups/`:

```bash
for d in "$V1_PATH"/groups/*/; do
  name=$(basename "$d")
  size=$(du -sh "$d" 2>/dev/null | cut -f1)
  has_agents=$([ -f "$d/agents.json" ] && echo "agents" || echo "-")
  has_wiki=$([ -d "$d/wiki" ] && echo "wiki" || echo "-")
  echo "$name | $size | $has_agents | $has_wiki"
done
```

Show the table. Ask the user which folder to port. Save as `V1_FOLDER`.

## Phase 2 — Inventory the v1 team

### 2a. Filesystem

```bash
ls -la "$V1_PATH/groups/$V1_FOLDER/"
```

Note which of these exist (skip the ones marked skip):

- `agents.json` — sub-agent definitions (translated in phase 8)
- `CLAUDE.md` — team identity / voice / rules (becomes `CLAUDE.role.md`)
- `wiki/` — knowledge base (copied verbatim)
- `sources/`, `self-review-proposals.json` — reference material (copied to `sources/`)
- `conversations/`, `logs/`, empty `scripts/` — **skip these**

### 2b. v1 DB row + scheduled tasks

`sqlite3` may not be installed on the host. Use `tsx` against v1's SQLite. Note that the script uses `process.argv[1]` because tsx passes the first user arg there (NOT [2]).

```bash
cd "$V1_PATH" && pnpm exec tsx -e "
const Database = require('better-sqlite3');
const db = new Database('store/messages.db', { readonly: true });
const folder = process.argv[1];
const grp = db.prepare('SELECT * FROM registered_groups WHERE folder = ?').get(folder);
console.log('--- registered_groups ---');
console.log(JSON.stringify(grp, null, 2));
const tasks = db.prepare(\"SELECT id, schedule_type, schedule_value, next_run, agent_role, prompt FROM scheduled_tasks WHERE chat_jid = ? AND status='active'\").all(grp.jid);
console.log('--- active scheduled_tasks (' + tasks.length + ') ---');
for (const t of tasks) console.log(JSON.stringify(t, null, 2));
" "$V1_FOLDER"
```

Save the output. The `jid` becomes irrelevant after the channel cutover, but `container_config.additionalMounts`, the trigger pattern, and the `(schedule_value, prompt)` pairs all carry over.

### 2c. Host-mounted secrets

If the printed `container_config` had `additionalMounts`, list each mount path:

```bash
ls -la <hostPath-from-additionalMounts>
```

These files stay where they are — v2 mounts them with the same `additionalMounts` shape (phase 7c).

## Phase 3 — Decide the channel cutover

Show the categorized channel list from phase 0f. Ask the user to pick. Capture:

- `CHANNEL` — adapter name (e.g. `telegram`, `whatsapp`, `slack`)
- `PLATFORM_ID` — the chat ID format for the chosen channel

If the user picks **WhatsApp (Baileys)**, surface this constraint:

> Baileys WhatsApp can only own one session per WhatsApp number. If v1 is currently running on the team's WhatsApp account, you must stop v1 before scanning the QR for v2 — there is no graceful handover. Plan ~30 minutes downtime. Alternatively: spin up v2 on a second WhatsApp number and add it to the same group. Or: switch to WhatsApp Cloud (Meta API) via /add-whatsapp-cloud.

If the user picks **Telegram**, capture the chat ID. The fast path: if the bot has been added to the new Telegram group and any message was sent there, v2's adapter already auto-created a `messaging_groups` row. Look for the most recent unnamed/new-titled telegram row:

```bash
pnpm exec tsx -e "
const Database = require('better-sqlite3');
const db = new Database('data/v2.db', { readonly: true });
const rows = db.prepare(\"SELECT id, name, platform_id, created_at FROM messaging_groups WHERE channel_type='telegram' AND created_at > datetime('now','-30 minutes') ORDER BY created_at DESC\").all();
for (const r of rows) console.log(JSON.stringify(r));
"
```

The negative integer in `platform_id` (`telegram:-1001234567890`) is the chat ID. **Do not approve any channel-registration card** that landed in the operator's DM — phase 6 wires the right agent group and clears stale approvals automatically.

For Slack/Discord/WhatsApp/etc., follow that channel's specific path to obtain the platform ID. If the user doesn't know, search the install for that channel's setup skill (`grep '/add-<channel>' .claude/skills/`).

## Phase 4 — Decide the delegation model

If v1's `agents.json` had sub-agents, they need to be translated. Two ways:

| | Claude Code sub-agents | **Lane agents (recommended default)** |
|---|---|---|
| Where they live | `groups/<team>/.claude/agents/<name>.md` | Their own `agent_groups` row + `groups/<name>/` folder |
| Container | Same as parent | Each lane gets its own container |
| Provider/model | Inherits parent | Per-lane (mix Claude / Codex / OpenCode) |
| Dashboard tile | No | Yes |
| Shared memory with parent | Yes (same context) | No (separate containers) |
| Delegation | Task tool | `send_message` to local destination |
| Setup cost | Drop a `.md` file | `init-lane-agent.ts` per lane |
| Best for | Fast delegation, single provider | Mixed providers, dashboard ops visibility |

**Default to lane agents.** Confirm with the user before proceeding. Only switch to sub-agents if the user has a specific reason (single-provider install with no need for ops visibility, and wants the simplicity).

If v1's `agents.json` is absent/empty, this phase is a no-op — the parent is solo. Skip phase 8.

## Phase 5 — Set up secrets

Two cases. Both can apply if the team uses both kinds.

### 5a. Filesystem-mounted secrets

If v1's `additionalMounts` pointed at host paths (e.g. `~/nanoclaw-secrets/<team>/`), **leave the files where they are**. They're outside both v1 and v2 working directories. v2 mounts them when phase 7c wires `additionalMounts` into `container.json`. No vault changes.

### 5b. OneCLI-managed secrets (proxy injection)

Auto-created v2 OneCLI agents start in `selective` mode with **no secrets assigned**, even if matching secrets exist in the vault. Symptom: first message hangs or returns 401. Pre-create the agent and assign secrets BEFORE the first container spawn.

This step runs AFTER phase 6 (which gives you the v2 `agent_groups.id`). Plan it now; execute after phase 6.

```bash
# 1. Discover v1's secret assignments (V1's identifier is its v1 group name, e.g. "whatsapp-<team>").
V1_OC_ID=$(onecli agents list 2>/dev/null | python3 -c "import json,sys; ids=[a['id'] for a in json.load(sys.stdin) if a.get('identifier')=='<v1-onecli-identifier>']; print(ids[0] if ids else '')")
[ -n "$V1_OC_ID" ] && onecli agents secrets --id "$V1_OC_ID"
onecli secrets list

# 2. AFTER phase 6 completes — pre-create the v2 agent. Identifier MUST match v2 agent_groups.id.
onecli agents create --identifier <V2_AGENT_GROUP_ID> --name "<Display Name>"

# 3. Either flip to mode=all (every host-pattern-matching secret injects)
NEW=$(onecli agents list | python3 -c "import json,sys; print([a['id'] for a in json.load(sys.stdin) if a.get('identifier')=='<V2_AGENT_GROUP_ID>'][0])")
onecli agents set-secret-mode --id "$NEW" --mode all

# OR stay selective and copy v1's exact set
onecli agents set-secrets --id "$NEW" --secret-ids "$(onecli agents secrets --id "$V1_OC_ID" | python3 -c 'import json,sys; print(",".join(json.load(sys.stdin)))')"
```

For lane agents (phase 8), `init-lane-agent.ts --clone-secrets-from-parent` does this automatically — no manual `onecli` work needed.

## Phase 6 — Create the v2 agent group + wire the channel

```bash
pnpm exec tsx scripts/init-group-agent.ts \
  --channel "$CHANNEL" \
  --platform-id "$PLATFORM_ID" \
  --display-name "<Team Display Name>" \
  --agent-name "<assistant name from .env ASSISTANT_NAME>" \
  --folder "<V2_FOLDER>" \
  --engage-mode pattern \
  --engage-pattern '.' \
  --unknown-sender-policy request_approval
```

Pick `V2_FOLDER` — typically a clean version of `V1_FOLDER` without prefixes (e.g. `whatsapp_insights-team` → `insights-team`).

Engage mode notes:

- `mention` (require `@<assistant>`) is fine for noisy channels.
- `pattern '.'` matches every message — what KDPup-style team groups use.

Unknown-sender-policy:

- `request_approval` for sensitive teams (admin DM'd to approve any new sender)
- `public` if the channel is wide-open and trusted

What this does:

- Creates `agent_groups` row.
- Scaffolds `groups/<V2_FOLDER>/{CLAUDE.role.md, CLAUDE.local.md, container.json, .claude-fragments/}`.
- Reuses any auto-created `messaging_groups` row from the channel adapter.
- Inserts `messaging_group_agents` wiring.
- Clears stale `pending_channel_approvals` for this messaging group.

After this completes, the script prints the new `agent_groups.id`. Capture it as `V2_AGENT_GROUP_ID` and execute phase 5b's pre-create.

## Phase 7 — Drop the v1 filesystem in

### 7a. CLAUDE.role.md (team identity)

```bash
cp "$V1_PATH/groups/$V1_FOLDER/CLAUDE.md" "groups/$V2_FOLDER/CLAUDE.role.md"
```

Then read the file and edit:

- Replace any reference to v1's channel ("WhatsApp", "@<assistant> WhatsApp trigger") with the chosen v2 channel equivalent.
- **`/workspace/group/` paths from v1 must become `/workspace/agent/`** — v2 mounts the team folder at `/workspace/agent/`, not `/workspace/group/`. Phase 7e does this sweep across all team files (CLAUDE.role.md, scripts, configs); just be aware that the references you see in `CLAUDE.role.md` will move. v1 paths under `/workspace/extra/<team>-creds/...` (host-mounted secrets) DO work as-is in v2 if `additionalMounts` (phase 7c) reuses the same `containerPath`.
- Strip v1-only operational notes (e.g. "agents.json must not contain literal newlines" — v1-specific).
- **Move v1's "Improvement Backlog" / "Watch items" sections out** of `CLAUDE.role.md` into `sources/improvement-backlog.md` — they're operational state, not role spec.
- If you went lane-agent (phase 4), update the "delegation" section to refer to lane agents addressed via `send_message` rather than sub-agents addressed via Task tool.

### 7b. Sub-agents (only if phase 4 = sub-agent path)

For each entry in v1's `agents.json`, create one file at `groups/<V2_FOLDER>/.claude/agents/<name>.md`:

```markdown
---
name: <name>
description: <one-line copy from agents.json[name].description — first sentence is what the parent reads to decide when to delegate>
model: sonnet
---

<paste agents.json[name].prompt here, line breaks restored from \n literals>
```

- Strip lines like `Do not call mcp__nanoclaw__send_message. Return your results to me.` — Claude Code subagents already do that.
- Keep all operational context (site lists, API patterns, output formats).

If phase 4 = lane, **skip 7b** and use phase 8 instead.

### 7c. container.json

Edit `groups/$V2_FOLDER/container.json` (currently `{}`):

```json
{
  "mcpServers": {},
  "packages": {
    "apt": ["<from v1 container_config.packages.apt>"],
    "npm": ["<from v1 container_config.packages.npm>"]
  },
  "additionalMounts": [
    { "hostPath": "<from v1>", "containerPath": "<from v1, keep same name so role-spec paths still work>", "readonly": true }
  ],
  "skills": "all"
}
```

If v1 had no per-team npm deps, leave `packages.npm` as `[]`. If no extra mounts, drop `additionalMounts` entirely. The `npm` deps were typically installed under `/tmp` per session in v1 — they don't survive container restarts in v2, so move them into the image build via `packages.npm`.

> **Don't clobber host-managed fields.** After the first container spawn, v2 adds `groupName`, `assistantName`, and `agentGroupId` to `container.json`. Leave those alone on subsequent edits.

### 7d. wiki + sources

```bash
[ -d "$V1_PATH/groups/$V1_FOLDER/wiki" ] && cp -r "$V1_PATH/groups/$V1_FOLDER/wiki" "groups/$V2_FOLDER/wiki"
mkdir -p "groups/$V2_FOLDER/sources"
[ -f "$V1_PATH/groups/$V1_FOLDER/self-review-proposals.json" ] && cp "$V1_PATH/groups/$V1_FOLDER/self-review-proposals.json" "groups/$V2_FOLDER/sources/"
[ -d "$V1_PATH/groups/$V1_FOLDER/sources" ] && cp -r "$V1_PATH/groups/$V1_FOLDER/sources/." "groups/$V2_FOLDER/sources/"
```

Skip `conversations/` and `logs/` — fresh start in v2.

### 7e. Migrate v1 hardcoded paths

v1 mounted the team folder at `/workspace/group/`. **v2 mounts it at `/workspace/agent/`** (the Dockerfile's `WORKDIR=/workspace/group` still exists as an empty stub, but that's not where the team's files land — they're at `/workspace/agent/`). Any `/workspace/group/...` reference in the v1 files will silently break in v2: the agent will report "the folder is empty" or scripts will throw `ENOENT` on imports.

Sweep team files (excluding historical logs the operator won't fix anyway):

```bash
find "groups/$V2_FOLDER" "groups/$V2_FOLDER"-* \
  -type f \( -name '*.mjs' -o -name '*.md' -o -name '*.json' -o -name '*.ts' -o -name '*.js' -o -name '*.sh' \) \
  -not -path '*/data/*' \
  -not -path '*/logs/*' \
  -not -path '*/conversations/*' \
  -print0 | xargs -0 sed -i 's|/workspace/group/|/workspace/agent/|g'
```

The `groups/$V2_FOLDER-*` glob also picks up lane folders created in phase 8. If you're running this between 7d and phase 8 (recommended), the lane folders don't exist yet — re-run the sed after phase 8 completes (or run it now AND after phase 8; sed is idempotent).

Verify zero reachable references remain:

```bash
grep -rln "/workspace/group" "groups/$V2_FOLDER" "groups/$V2_FOLDER"-* 2>/dev/null \
  | grep -vE '/(data|logs|conversations)/' || echo "(clean)"
```

Expected output: `(clean)`. If anything else prints, open those files and adjust by hand — they may have non-path uses (e.g. a markdown link with `/workspace/group/` in display text).

What this catches in practice:
- `.mjs` scripts that hardcode `/workspace/group/node_modules/...` import paths
- Role specs (`CLAUDE.role.md`, `roles/<name>.md`, `specs/<name>-role.md`) that reference data/credentials paths
- `credentials/*.json` config files with `serviceAccountKeyFile` etc.
- Cron prompt bodies in `sources/v1-scheduled-tasks.md` (phase 9)

What it skips:
- `data/` and `logs/` — historical output from v1, not files the v2 agent reads
- Anything outside the team's group folder

### 7f. Leave CLAUDE.local.md empty

`CLAUDE.local.md` is the agent's own memory. Don't seed with v1 history.

## Phase 8 — Lane agents (only if phase 4 = lane path)

For each entry in v1's `agents.json`:

```bash
pnpm exec tsx scripts/init-lane-agent.ts \
  --parent-folder "$V2_FOLDER" \
  --folder "<lane-folder>" \
  --name "<Lane Display Name>" \
  --provider claude \
  --model sonnet \
  --clone-secrets-from-parent
```

The script:

1. Creates the lane's `agent_groups` row (no messaging-channel wiring).
2. Scaffolds the lane's filesystem.
3. Inserts bidirectional `agent_destinations` (parent → `<local-name>`, lane → `parent`).
4. Calls `writeDestinations` for every active session of the parent so the running container sees the new lane immediately (no restart).
5. Pre-creates the lane's OneCLI agent and clones the parent's assigned secrets.

After running, write each lane's role spec to `groups/<lane-folder>/CLAUDE.role.md` — adapt the v1 sub-agent prompt to lane-agent framing (`send_message to="parent"` instead of "return to me"). Add mounts/npm deps to `groups/<lane-folder>/container.json` if the lane needs the same credential mount as the parent.

To pick a different provider/model later, update `agent_groups` directly:

```bash
pnpm exec tsx -e "
const path = require('path');
(async () => {
  const { initDb } = await import('./src/db/connection.js');
  const { runMigrations } = await import('./src/db/migrations/index.js');
  const { updateAgentGroup } = await import('./src/db/agent-groups.js');
  const { DATA_DIR } = await import('./src/config.js');
  const db = initDb(path.join(DATA_DIR, 'v2.db')); runMigrations(db);
  updateAgentGroup('<lane-agent-groups-id>', { agent_provider: 'codex', model: 'gpt-5' });
})().catch(e => { console.error(e); process.exit(1); });
"
```

## Phase 9 — Recreate scheduled tasks

v1 tracked schedules globally; v2 tracks them per-session in the session's `inbound.db messages_in.recurrence`, woken by the host's 60-second sweep.

**Recommended:** save the v1 prompt bodies and let the parent agent register the schedules through its own MCP tools.

```bash
# Save schedules to a file the parent agent can read
cat > "groups/$V2_FOLDER/sources/v1-scheduled-tasks.md" <<'EOF'
# v1 scheduled tasks (to register in v2)

<for each task from phase 2b, write:>
## <one-line description>
- Cron: `<schedule_value>`
- Prompt:
  > <prompt body, indented>
EOF
```

Then in the wired channel, send to the parent:

> @<assistant> read `sources/v1-scheduled-tasks.md` and schedule each cron task listed there (specify the timezone if non-default). Confirm each one back to me.

The agent confirms; verify the recurrence landed by inspecting `messages_in.recurrence` in the session DB if needed.

**Fallback** (only worth it for >5 schedules being recreated en masse): direct insert into the session's `inbound.db messages_in` with `recurrence` set. Fiddly; skip unless scripting many ports.

## Phase 10 — Verification

Don't trust the port until each gate passes.

### 10a. Smoke test

Post a test message in the wired channel. Expect a reply within ~10 seconds.

```bash
tail -n 100 logs/nanoclaw.log | grep -E "($V2_FOLDER|$V2_AGENT_GROUP_ID)"
# expected sequence: Session created → OneCLI gateway applied → Spawning container → Message delivered
tail -n 50 logs/nanoclaw.error.log
# clean (transient channel polling errors during outages are harmless retries)
```

### 10b. Credential mount

Ask the agent: "list the files under /workspace/extra/" — confirm it sees the credential files.

### 10c. Delegation

Sub-agent path: ask the parent to use a sub-agent ("have <name> do <task>") and confirm agent-runner logs show a Task-tool call with `subagent_type=<name>`.

Lane path: ask the parent to delegate ("send a brief to <name>: <task>") and confirm a NEW container spawns for the lane (separate `nanoclaw-v2-<lane>-...` in `docker ps` / `container ls`), then a reply comes back to the parent.

### 10d. Wiki access

Ask: "summarize wiki/<some-file>.md" — confirm the agent reads the file.

### 10e. Schedule fires

Schedule a one-off task for `now + 2 minutes`. Wait. The host sweep wakes the session at the scheduled time and the agent posts. Confirm in `logs/nanoclaw.log`.

If any check fails, **do not retire v1**. Diagnose with `/debug` and fix before continuing.

## Phase 11 — Log the port

Each install keeps its own port history. If `docs/migrate-team-from-v1.md` exists, append a Past-ports entry. If it doesn't exist, create one with a header and the entry below.

Print this pre-filled block for the user to append:

```markdown
### <Team Display Name> — <YYYY-MM-DD> (port #<N>)

| Field | Value |
|---|---|
| v1 folder | `<V1_PATH>/groups/<V1_FOLDER>/` |
| v1 channel | <v1 channel + JID/ID + trigger> |
| v1 secrets | <list of secret paths or onecli secret names> |
| v1 sub-agents | <names + provider/model> |
| v1 npm deps | <list> |
| v1 active schedules | <count + summary> |
| v2 parent folder | `<V2_FOLDER>` (agent_groups.id `<V2_AGENT_GROUP_ID>`) |
| v2 channel | <CHANNEL> — `messaging_groups.platform_id = <PLATFORM_ID>` |
| v2 mount path | `<containerPath>` |
| Delegation model chosen | **<Lane agents | Sub-agents>** — <reason> |
| v2 lanes (if lane path) | <names + agent_groups.ids> |
```

Tell the user: "Append this to `docs/migrate-team-from-v1.md` Past ports section. The doc is install-local — it stays in this repo, not the skill."

## Phase 12 — Decommission v1 (deferred)

After the user has soaked v2 for a week or two with no issues:

```bash
# Linux v1 systemd unit (typically the un-suffixed one)
systemctl --user stop nanoclaw.service
systemctl --user disable nanoclaw.service

# macOS launchd
launchctl unload ~/Library/LaunchAgents/com.nanoclaw.plist
```

Leave the v1 codebase + `store/messages.db` in place as a fallback for at least another month. Do **not** run `git pull` in the v1 directory — the v2 repo is its upstream and merging trips the banner in v1's CLAUDE.md.

## Maintenance

- **Trunk script updates.** This skill ships pinned copies of `scripts/init-group-agent.ts` and `scripts/init-lane-agent.ts`. If the v2 trunk later updates these scripts, `/update-nanoclaw` will conflict on next merge. Resolve by accepting the trunk version (the skill's copies are snapshots, not authoritative).
- **New channel adapters.** Phase 0f's detection is dynamic — new adapters in `src/channels/` are picked up automatically. If a new adapter uses a credential pattern not in 0f's grep list, append it.
- **OneCLI CLI changes.** Phases 5b and 8 call `onecli` subcommands by name. If those names change, this skill needs an update via the `private-skills` remote.

## Rename an agent group (after the fact)

Three places get out of sync if you rename via the DB only:

```bash
# 1. agent_groups.name (drives the dashboard label)
pnpm exec tsx -e "
const Database = require('better-sqlite3');
const db = new Database('data/v2.db');
db.prepare('UPDATE agent_groups SET name = ? WHERE id = ?').run('<New Name>', '<agent-groups-id>');
"

# 2. groups/<folder>/container.json `groupName` (hand-edit; assistantName stays as the persona)

# 3. OneCLI agent name
NEW=$(onecli agents list | python3 -c "import json,sys; print([a['id'] for a in json.load(sys.stdin) if a.get('identifier')=='<agent-groups-id>'][0])")
onecli agents rename --id "$NEW" --name "<New Name>"   # check 'onecli agents' for exact subcommand
```

Folder name and `agent_groups.id` are best left alone — too many references.
