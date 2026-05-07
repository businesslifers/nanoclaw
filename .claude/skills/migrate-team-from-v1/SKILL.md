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
- **Scripts are sacred.** Copy team `*.mjs` / `*.js` / `*.ts` / `*.sh` files verbatim. Do not refactor auth setup, "simplify" client construction, or modernize imports during a port — visually-equivalent code may behave differently because library APIs drift between v1's pinned versions and v2's container resolution. Path-sweep them in 7e; otherwise leave alone. (See marketing-team port: `collector.mjs`'s `createAdsClient()` was simplified during port and silently broke Google Ads auth for 6 days.)

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

The host runs central-DB migrations on startup, so an active service from 0c implies the schema is current. If 0c found nothing (manual-run install), tell the operator: "ensure the host has been started against this checkout since the last `git pull` — that's what runs migrations."

> **Don't** run `pnpm exec tsx scripts/run-migrations.ts` here — in current trunk that script is the version-upgrade runner used by `/update-nanoclaw` and takes `<from-version> <to-version> <new-core-path>` args. Calling it bare-handed errors noisily.

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
- `memory.md` — curated persona / hard rules (imported into `CLAUDE.local.md` in phase 7f)
- `wiki/` — knowledge base (copied verbatim)
- `sources/`, `self-review-proposals.json` — reference material (copied to `sources/`)
- **Any other directory or `*.md` file** (`voices/`, `client-notes/`, `clients/`, `people.md`, `preferences.md`, `mettro-voice.md`, etc.) — team-curated knowledge. Copy verbatim in phase 7c.bis. The role spec almost always references these by path, so they're load-bearing even if the standard list above doesn't name them.
- **Scripts and dep manifests** (`*.mjs`, `*.js`, `*.ts`, `*.sh`, `package.json`, lockfiles, in-folder `credentials/`) — runtime artifacts. Copied verbatim in phase 7c.bis with a dep-drift check.
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
if (grp) {
  const tasks = db.prepare(\"SELECT * FROM scheduled_tasks WHERE chat_jid = ? AND status='active'\").all(grp.jid);
  console.log('--- active scheduled_tasks (' + tasks.length + ') ---');
  for (const t of tasks) console.log(JSON.stringify(t, null, 2));
}
" "$V1_FOLDER"
```

Use `SELECT *` — v1's `scheduled_tasks` schema has drifted across versions (e.g. older builds don't have `agent_role`; newer ones do). Naming columns explicitly errors on installs that lack them. The `jid` becomes irrelevant after the channel cutover, but `container_config.additionalMounts`, the trigger pattern, and the `(schedule_value, prompt)` pairs all carry over.

### 2c. additionalMounts — credentials vs. cross-team data

If the printed `container_config` had `additionalMounts`, classify each mount before deciding what to do with it. Two distinct cases share the same shape:

**Credentials mount** — `hostPath` points at a credentials directory outside any v1 group folder (e.g. `~/nanoclaw-secrets/<team>/`, `<team>-creds/`, an absolute path under `/etc/` or `~/.config/`). These files stay where they are — phase 5a / 7c re-mount them in v2 unchanged.

**Cross-team data mount** — `hostPath` points at *another* v1 group's folder (e.g. `groups/slack_briefmate/clients`). The v1 team is sharing a sibling team's curated files (client knowledge bases, voice profiles, etc.), not exposing a secret. v2 needs an explicit decision since the source team may or may not be ported yet.

```bash
# Inspect each mount to classify
ls -la <hostPath-from-additionalMounts>
# If hostPath starts with `groups/<other-team>/` it's a cross-team data mount.
```

For each cross-team mount, ask the operator with AskUserQuestion:

| Option | When to pick |
|---|---|
| **Mount v1's path read-only** | Source team will stay on v1 indefinitely OR this is a temporary bridge until phase 12 retires v1. Easiest, but breaks when v1 is decommissioned. |
| **Copy the data into v2 team's own dir** | Source team isn't being ported; the data is small and stable. v2 team becomes decoupled — future edits in v1 don't propagate. Phase 7c skips `additionalMounts`; phase 7d copies the directory in. |
| **Port the source team first** | Source team is also being ported. Cleanest long-term — v2 team mounts the v2 source team's directory. Run this skill on the source team first, then return to this port. |

Capture the decision per mount; phase 7c reflects it.

### 2d. Decide: port vs. fresh agent

If 2a–2c found nothing meaningful to port, the rest of the skill is 10 phases of no-ops. Classify the team:

- **No customization** if ALL of: `agents.json` absent, `wiki/` absent, `sources/` absent, `container_config IS NULL` in the v1 row, `scheduled_tasks` count = 0, AND `CLAUDE.md` is the v1 boilerplate (compare against `<V1_PATH>/groups/main/CLAUDE.md` or another known-stock group — within ~5% size and no team-specific content beyond the default Janet template).
- **Some customization** otherwise.

If no customization, ask the operator with AskUserQuestion:

> v1 `<V1_FOLDER>` has no team-specific content (no agents.json, no wiki, no sources, no scheduled tasks, generic CLAUDE.md). What do you want to do?
> - **Skip the port — create a fresh agent** *(recommended)*: Use `init-group-agent.ts` directly — saves ~10 phases of no-op work.
> - **Port it anyway**: Run the full skill; you'll end up with a v2 agent group named after the team and the boilerplate copied verbatim.
> - **Pick a different team**: Show the candidate list again.

If "skip", jump straight to phase 3 (channel) → phase 6 (init-group-agent) → phase 5b (OneCLI pre-create) → phase 10 smoke test → phase 11 log. Skip phases 4, 7, 8, 9 entirely. The team has nothing to translate.

### 2e. Detect existing v2 agent (re-port check)

The skill assumes a fresh port end-to-end, but the same v1 team often has a partial v2 presence already — typically because the operator ran `init-group-agent.ts` manually, `/add-karpathy-llm-wiki` scaffolded a skeleton DM, or an earlier port was abandoned half-done. Detect the collision now, since it changes phases 5b, 6, 7a, and 7d.

Pick a candidate `V2_FOLDER` using the same rule phase 6 will (typically `V1_FOLDER` minus the channel prefix, e.g. `slack_adam_dm` → `adam-dm`). Then check three places — any single hit means re-port:

```bash
V2_FOLDER_CANDIDATE="<your guess>"

echo "--- folder ---"
[ -d "groups/$V2_FOLDER_CANDIDATE" ] && echo "EXISTS: groups/$V2_FOLDER_CANDIDATE/" || echo "(none)"

echo "--- agent_groups row by folder ---"
pnpm exec tsx -e "
const Database = require('better-sqlite3');
const db = new Database('data/v2.db', { readonly: true });
const r = db.prepare('SELECT id, name, folder FROM agent_groups WHERE folder = ?').get('$V2_FOLDER_CANDIDATE');
console.log(r ? JSON.stringify(r) : '(none)');
"

echo "--- OneCLI agent for that agent_groups.id (if any) ---"
# Pipe the id from the previous query into:
# onecli agents list | python3 -c "import json,sys; print(json.dumps([a for a in json.load(sys.stdin) if a.get('identifier')=='<id>'], indent=2))"
```

Also flag at phase 3: when the picked `mg-...` already has wirings on `messaging_group_agents`, that's another collision signal.

If any match, ask the operator with AskUserQuestion:

| Option | When to pick |
|---|---|
| **Overlay onto the existing v2 agent** *(most common)* | Earlier v2 work was a skeleton/stub. Keep the wiring + OneCLI agent + agent_groups row, drop v1 content on top. |
| **Backup then overlay** | Same as above but copy `groups/<V2_FOLDER>/` to `groups/<V2_FOLDER>.bak-<YYYYMMDD>/` first. Use when the existing v2 has hand-curated content the operator wants reversible. |
| **Abort and use a different V2_FOLDER** | Folder collision is accidental — the existing v2 agent is unrelated. Pick a different name and continue as a fresh port. |

If overlay (either form), apply these adjustments downstream:

- **Skip phase 5b** — OneCLI agent already exists. List its current assigned secrets (`onecli agents secrets --id <id>`) and confirm they match the v1 twin's set. No `onecli agents create` call.
- **Skip phase 6 (`init-group-agent.ts`)** — agent group + scaffold already in place. Capture the existing `agent_groups.id` as `V2_AGENT_GROUP_ID`. Run phase 6a's wiring audit anyway — re-ports often inherit a stray default-DM-agent wiring on the same messaging group.
- **Phase 7a clobber check** — before overwriting `CLAUDE.role.md` / `CLAUDE.local.md`, read the existing `CLAUDE.local.md`. If it's the bare-imports skeleton (just `@./CLAUDE.role.md` and maybe `@./memory.md`), overlay freely. If it contains hand-authored v2 content, surface to the operator: discard (common — v1's CLAUDE.md usually covers the same ground), preserve verbatim by copying to `CLAUDE.local-v2-authored.md.bak` for later manual merge, or abort.
- **Phase 7d wiki overlay** — `find groups/<V2_FOLDER>/wiki -type f | wc -l`. If <5 files, it's a `/add-karpathy-llm-wiki` skeleton; overlay v1's wiki freely. If ≥5 files or any file outside `index.md`/`log.md`, pause and ask the operator how to merge.
- **Phase 7e.bis container restart** — required regardless of whether you smoke-tested mid-port. The broadened trigger in 7e.bis covers this.

If no match, continue to phase 3 unchanged.

## Phase 3 — Decide the channel cutover

Show the categorized channel list from phase 0f. Ask the user to pick. Capture:

- `CHANNEL` — adapter name (e.g. `telegram`, `whatsapp`, `slack`)
- `PLATFORM_ID` — the chat ID format for the chosen channel

**If the v1 team's channel adapter isn't installed in v2** (e.g. v1 was on Slack but the v2 install only has Telegram in `src/channels/`), surface this as an explicit binary fork — don't make the operator infer it:

- **Install the missing adapter first** — run the matching `/add-<channel>` skill (e.g. `/add-slack`, `/add-discord`) before continuing this port, so the v2 agent stays on the same channel as v1.
- **Cut over to a different channel** — pick from the installed-and-configured list. The agent's role spec still works; phase 7a will need to update channel-specific formatting hints (Slack mrkdwn vs. Telegram MarkdownV2 vs. Discord standard).

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

**v1-twin lookup (do this first).** v1 installs typically already have a OneCLI agent for this team, identified by `<channel>-<team>` (e.g. `slack-crm`, `whatsapp-launchmate`). Find it before deciding mode/secrets — its assigned set is the operator's existing baseline:

```bash
onecli agents list | python3 -c "
import json, sys
v1_ident_guess = '<v1-folder-without-channel-prefix>'  # e.g. 'crm' for slack_crm
for a in json.load(sys.stdin):
    ident = a.get('identifier', '') or ''
    if ident.endswith('-' + v1_ident_guess) or ident == v1_ident_guess:
        print(json.dumps({'id': a['id'], 'identifier': ident, 'name': a.get('name'), 'mode': a.get('secret_mode')}))
"
```

If found, list its assigned secrets and surface them to the operator with AskUserQuestion: "v1 has secrets X, Y, Z assigned to this team — clone the same set, mode=all, or start fresh with just Anthropic?" Don't decide silently; the answer often differs by team scope.

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
  --agent-name "<Team Display Name>" \
  --folder "<V2_FOLDER>" \
  --engage-mode pattern \
  --engage-pattern '.' \
  --unknown-sender-policy request_approval
```

**About the two name flags** (this trips operators up):

- `--display-name` writes `messaging_groups.name` — the chat-side label (rarely visible to humans on most channels).
- `--agent-name` writes `agent_groups.name` — **the dashboard label**. v2's `src/container-runner.ts` then auto-syncs this value into `container.json.groupName` AND `container.json.assistantName` on every spawn (and re-syncs if you hand-edit those fields and the agent group name later changes). So the agent group name is effectively the single source of truth for "what is this team called" in v2.

Use the **team name** for both flags (typically the same value). Don't pass the persona name (e.g. "Janet", "Derek") to `--agent-name` — that puts the persona on the dashboard and makes multiple ported teams indistinguishable from each other (every team becomes "Janet" in the listing).

The agent's persona/voice is independent of the agent group name — it's encoded in `CLAUDE.role.md` and `memory.md` (auto-loaded via `CLAUDE.local.md`, see 7a.bis + 7f). Setting `agent_groups.name = "LaunchMate"` doesn't make the agent stop sounding like Janet; her persona instructions live in memory.md and continue to apply regardless of what the system-prompt-addendum identifier says.

Pick `V2_FOLDER` — typically a clean version of `V1_FOLDER` without prefixes (e.g. `whatsapp_insights-team` → `insights-team`).

Engage mode — translate from the v1 row's `(trigger_pattern, requires_trigger)`:

| v1 row | v2 init flags | Use case |
|---|---|---|
| `requires_trigger=0` (any `trigger_pattern`) | `--engage-mode pattern --engage-pattern '.'` | Fires on every message in the chat. v1's trigger field was a fallback hint, not a gate — agent answered everything. |
| `requires_trigger=1, trigger_pattern='@<assistant>'` | `--engage-mode mention` | Standard: only when the assistant is mentioned. |
| `requires_trigger=1, trigger_pattern=<other regex>` | `--engage-mode pattern --engage-pattern '<regex>'` | Custom trigger phrase (e.g. "hey janet"). Copy the regex over verbatim. |

`mention-sticky` (after a mention, keep replying to that user without re-mention until silence) has no v1 equivalent — only choose it if the operator wants new behavior.

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

### 6a. Audit existing wirings on the messaging group

`init-group-agent.ts` adds a wiring for the new agent but does NOT remove pre-existing wirings on the same messaging group. This bites when the messaging_group was auto-created by the channel adapter (typical: phase 3's "send a message in the new chat so the bot sees it" — that auto-creates the row AND auto-wires whatever agent the host's channel-registration flow defaulted to, often with `engage_mode='pattern'` + `engage_pattern='.'` which fires on every message).

Symptom if missed: the new agent responds to mentions correctly, but a *second* agent (typically the install's main DM agent) also responds to every message in the group. Two replies, two costs, and they share a display name so the operator can't tell from chat which one is talking.

Run:

```bash
pnpm exec tsx -e "
const Database = require('better-sqlite3');
const db = new Database('data/v2.db', { readonly: true });
const rows = db.prepare(\"SELECT mga.id, mga.engage_mode, mga.engage_pattern, ag.name, ag.id as agent_id, ag.folder FROM messaging_group_agents mga JOIN agent_groups ag ON mga.agent_group_id = ag.id WHERE mga.messaging_group_id = ?\").all('<messaging-group-id>');
for (const r of rows) console.log(JSON.stringify(r));
"
```

Substitute `<messaging-group-id>` with the `mg-...` id from phase 3 (or `init-group-agent.ts`'s output). Expect exactly **one** row — the wiring for `$V2_AGENT_GROUP_ID`. If you see more than one:

```bash
# Inspect each — confirm with the operator which to keep before deleting.
pnpm exec tsx -e "
const Database = require('better-sqlite3');
const db = new Database('data/v2.db');
const result = db.prepare(\"DELETE FROM messaging_group_agents WHERE id = ?\").run('<unwanted-mga-id>');
console.log('deleted rows:', result.changes);
"
```

Repeat for each wiring that isn't the one for `$V2_AGENT_GROUP_ID`. Don't blanket-delete: some installs intentionally wire multiple agents to a group (e.g. a hub group with multiple lanes listening). When in doubt, ask.

## Phase 7 — Drop the v1 filesystem in

### 7a. CLAUDE.role.md (team identity)

```bash
cp "$V1_PATH/groups/$V1_FOLDER/CLAUDE.md" "groups/$V2_FOLDER/CLAUDE.role.md"
```

Then read the file and edit:

- Replace any reference to v1's channel ("WhatsApp", "@<assistant> WhatsApp trigger") with the chosen v2 channel equivalent.
- **`/workspace/group/` paths from v1 must become `/workspace/agent/`** — v2 mounts the team folder at `/workspace/agent/`, not `/workspace/group/`. Phase 7e does this sweep across all team files (CLAUDE.role.md, scripts, configs); just be aware that the references you see in `CLAUDE.role.md` will move. v1 paths under `/workspace/extra/<team>-creds/...` (host-mounted secrets) DO work as-is in v2 if `additionalMounts` (phase 7c) reuses the same `containerPath`.
- Strip v1-only operational notes. Common patterns to remove or rewrite (read the whole file with this list in hand — they show up in role specs more often than not):
  - References to `ask_group` / `reply_to_lead` MCP tools — v1-only. v2 lanes/sub-agents communicate via `send_message`. If the agent is solo in v2, drop these mentions entirely.
  - Sections titled "Replying to Dispatches from Main", "If main asks you a question via ask_group", or similar — only relevant if the v2 agent has a parent lane wiring (rare for ports). For solo agents, delete the section.
  - `/workspace/global/wiki/` references — v2 has no global/shared wiki concept. Per-group wiki at `/workspace/group/wiki/` (which becomes `/workspace/agent/wiki/` after the phase 7e sweep) is the only wiki.
  - Channel-specific formatting blocks ("This is a Slack channel — use Slack mrkdwn") — replace wholesale with the v2 channel's syntax (Telegram MarkdownV2, Discord standard markdown, etc.). Don't try to translate rule-by-rule; rewrite the block.
  - "agents.json must not contain literal newlines" or other v1-only operational tics.
- **Move v1's "Improvement Backlog" / "Watch items" sections out** of `CLAUDE.role.md` into `sources/improvement-backlog.md` — they're operational state, not role spec.
- If you went lane-agent (phase 4), update the "delegation" section to refer to lane agents addressed via `send_message` rather than sub-agents addressed via Task tool.

### 7a.bis. Wire CLAUDE.role.md into the auto-load chain

**v2's composed `CLAUDE.md` does NOT auto-import `CLAUDE.role.md`.** It imports `.claude-shared.md`, the module fragments, and `CLAUDE.local.md` (which Claude Code auto-loads). So the role spec you just wrote to `CLAUDE.role.md` will be invisible to the agent unless `CLAUDE.local.md` pulls it in.

`init-group-agent.ts` creates an empty `CLAUDE.local.md`. Add a single import line:

```bash
echo '@./CLAUDE.role.md' > "groups/$V2_FOLDER/CLAUDE.local.md"
```

The agent's effective system prompt will then be: shared base + module fragments + role spec + (room below the import for operational memory you or the agent add over time). Keep the `@./CLAUDE.role.md` line at the top so the role loads first.

For lane agents (phase 8), do the same after each lane is created:

```bash
for lane in <lane-folder-1> <lane-folder-2> ...; do
  echo '@./CLAUDE.role.md' > "groups/$lane/CLAUDE.local.md"
done
```

Symptom if missed: the agent operates from the generic NanoClaw base only — it knows nothing team-specific (no Google Ads paths, no lane refs, no client-specific instructions). Reports like "I don't see a credentials/ folder" while staring at `/workspace/group/` (the empty Dockerfile WORKDIR) are the typical tell.

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

### 7c.bis. Copy team runtime + curated artifacts

Phase 7d covers wiki + sources; this step covers everything else under `groups/<v1-folder>/` that the agent needs at runtime — scripts, dep manifests, in-folder credentials, knowledge files. **Copy verbatim** — see "Scripts are sacred" in Operating principles. Refactoring during the port is what broke marketing-team's collector.

```bash
cd "$V1_PATH/groups/$V1_FOLDER"

# Scripts + dep manifests at the top level (max depth 2)
find . -maxdepth 2 -type f \
  \( -name '*.mjs' -o -name '*.js' -o -name '*.ts' -o -name '*.sh' \
     -o -name 'package.json' -o -name 'package-lock.json' -o -name 'pnpm-lock.yaml' \) \
  -not -path './node_modules/*' -not -path './data/*' -not -path './logs/*' \
  -not -path './conversations/*' -not -path './wiki/*' -not -path './sources/*' \
  -print0 | while IFS= read -r -d '' f; do
    target="$OLDPWD/groups/$V2_FOLDER/${f#./}"
    mkdir -p "$(dirname "$target")"
    cp "$f" "$target"
  done

# Folders the agent reads as state
for d in credentials clients voices client-notes roles specs; do
  [ -d "$d" ] && cp -r "$d" "$OLDPWD/groups/$V2_FOLDER/"
done

# Loose top-level knowledge files (extend per phase 2a's findings)
for f in clients.json people.md preferences.md mettro-voice.md; do
  [ -f "$f" ] && cp "$f" "$OLDPWD/groups/$V2_FOLDER/"
done

cd "$OLDPWD"
```

Skip `node_modules/` — v2 reinstalls from `package.json` via `container.json.packages.npm` (or per-spawn install). Skip `data/` and `logs/` — historical output, not configuration.

#### Dependency drift check

Before phase 7d, diff v1's *installed* dep versions against what v2 will resolve. Major-version jumps in auth/SDK packages cause silent runtime regressions that no other gate in this skill catches.

```bash
[ -f "groups/$V2_FOLDER/package.json" ] && pnpm exec tsx -e "
const fs = require('fs'); const path = require('path');
const v1Root = '$V1_PATH/groups/$V1_FOLDER';
const pkg = JSON.parse(fs.readFileSync(path.join(v1Root, 'package.json'), 'utf8'));
const deps = { ...pkg.dependencies, ...pkg.devDependencies };
console.log('package\trange\tv1-installed');
for (const [name, range] of Object.entries(deps || {})) {
  let actual = '?';
  try { actual = JSON.parse(fs.readFileSync(path.join(v1Root, 'node_modules', name, 'package.json'), 'utf8')).version; } catch {}
  console.log([name, range, actual].join('\t'));
}
"
```

Surface the table to the operator. For any package matching auth / SDK / HTTP-client patterns — `google-auth-library`, `googleapis`, `@google-cloud/*`, `@aws-sdk/*`, `axios`, `node-fetch`, `undici`, `grpc`, `@grpc/*`, `google-gax`, `google-ads-*` — **pin to v1's exact installed version** in `container.json.packages.npm` (e.g. `"google-auth-library@9.15.1"`). For everything else, accept whatever resolves and rely on phase 10f to catch breakage.

> Why this matters: `groups/<team>/package.json` is what gets installed into the container at startup. If v1 had `"google-auth-library": "^9.0.0"` and v1's lockfile resolved to `9.15.1`, but v2's pnpm picks up `10.6.2` for the same range, behaviour can diverge in non-obvious ways. The marketing-team regression: `google-auth-library 10.x` JWTs no longer flow through `google-gax 5.x`'s `createFromGoogleCredential` bridge → silent `gRPC code 16 UNAUTHENTICATED` on every Google Ads call. Pinning v1's exact version is the safe default; you can let it drift later once 10f passes.

### 7d. wiki + sources

```bash
[ -d "$V1_PATH/groups/$V1_FOLDER/wiki" ] && cp -r "$V1_PATH/groups/$V1_FOLDER/wiki" "groups/$V2_FOLDER/wiki"
mkdir -p "groups/$V2_FOLDER/sources"
[ -f "$V1_PATH/groups/$V1_FOLDER/self-review-proposals.json" ] && cp "$V1_PATH/groups/$V1_FOLDER/self-review-proposals.json" "groups/$V2_FOLDER/sources/"
[ -d "$V1_PATH/groups/$V1_FOLDER/sources" ] && cp -r "$V1_PATH/groups/$V1_FOLDER/sources/." "groups/$V2_FOLDER/sources/"
```

Always skip `logs/` — operational noise, never useful.

**Conversation transcripts are a decision** — ask the operator. v1 stored Slack/WhatsApp transcripts in `conversations/`; some teams have rich history worth preserving, others are noisy enough that a clean start is better. Show the size and let the operator pick:

```bash
SIZE=$(du -sh "$V1_PATH/groups/$V1_FOLDER/conversations" 2>/dev/null | cut -f1)
COUNT=$(find "$V1_PATH/groups/$V1_FOLDER/conversations" -type f 2>/dev/null | wc -l | tr -d ' ')
echo "v1 conversations: $COUNT files, $SIZE total"
```

Use AskUserQuestion (or plain prompt) with these three options. Default recommendation is skip; bring if the operator answers a clear use case ("yes, the agent needs to recall what was discussed about X").

| Option | Where it lands | When to pick |
|---|---|---|
| **Skip** *(default)* | not copied; v1 retains them | Fresh start. Wiki + memory.md already capture distilled knowledge. Agent can re-derive from new conversations. |
| **Copy as reference** | `groups/$V2_FOLDER/sources/v1-conversations/` | Long-tail context the wiki didn't capture. Agent can `grep` these on demand but they don't auto-load — no token cost unless the agent reaches for them. Recommended when in doubt. |
| **Restore in original location** | `groups/$V2_FOLDER/conversations/` | The team's role spec / scripts explicitly reference `conversations/` paths and would break without them. Rare — usually only matches if the v1 install ran a custom transcript-search workflow. |

```bash
# If operator picks "Copy as reference":
[ -d "$V1_PATH/groups/$V1_FOLDER/conversations" ] && \
  cp -r "$V1_PATH/groups/$V1_FOLDER/conversations" "groups/$V2_FOLDER/sources/v1-conversations"

# If operator picks "Restore in original location":
[ -d "$V1_PATH/groups/$V1_FOLDER/conversations" ] && \
  cp -r "$V1_PATH/groups/$V1_FOLDER/conversations" "groups/$V2_FOLDER/conversations"
```

**Caveat for both copy options:** transcripts are channel-formatted (Slack mrkdwn, WhatsApp emoji, etc.). The agent reading them as examples may pick up wrong formatting habits for the v2 channel. If the team is changing channels (phase 3 cutover), warn the operator that copied transcripts will reference the old channel's syntax. Copy-as-reference is safer than restore-in-place because the agent treats `sources/` as research material, not as authoritative examples.

### 7e. Migrate v1 hardcoded paths

v1 mounted the team folder at `/workspace/group/`. **v2 mounts it at `/workspace/agent/`** (the Dockerfile's `WORKDIR=/workspace/group` still exists as an empty stub, but that's not where the team's files land — they're at `/workspace/agent/`). Any `/workspace/group/...` reference in the v1 files will silently break in v2: the agent will report "the folder is empty" or scripts will throw `ENOENT` on imports.

Sweep team files (excluding historical logs the operator won't fix anyway):

```bash
find "groups/$V2_FOLDER" "groups/$V2_FOLDER"-* \
  -type f \( -name '*.mjs' -o -name '*.md' -o -name '*.json' -o -name '*.ts' -o -name '*.js' -o -name '*.sh' \) \
  -not -path '*/data/*' \
  -not -path '*/logs/*' \
  -not -path '*/conversations/*' \
  -not -path '*/v1-conversations/*' \
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
- `conversations/` and `sources/v1-conversations/` — these are historical chat transcripts. Rewriting paths inside them would falsify what was actually said in v1 (e.g. an agent quoted a path during a real chat — that quote is part of the historical record, not authoritative configuration).
- Anything outside the team's group folder

### 7e.bis — Restart any running session

If the agent's container is running at any point during this port, it already loaded the OLD role spec, the OLD `CLAUDE.local.md` imports, and the OLD `container.json` mounts into its config — none of which the host re-reads on a live container. This fires for two cases:

- **Mid-port smoke-test** — a message was sent during/before phase 7, the agent quoted file content, and the role spec / scripts were edited under it. Path edits on disk DON'T update what's already cached.
- **Re-port flow (phase 2e)** — the existing v2 agent has been live for hours/days/weeks before the port even started. Same problem: its container config and system prompt reflect pre-port state.

Either way, the agent already loaded the old role spec into its session context — and may have *also* read config files (e.g. `credentials/<service>-config.json`) that quoted v1 paths. Path edits on disk DON'T update either of those:

- **Role spec / system prompt:** loaded once at session start. A container restart fixes this part.
- **Config / data files the agent already opened:** the Claude Agent SDK persists conversation transcripts (under the session's `.claude-shared/projects/*.jsonl`). Any value the agent quoted in an earlier turn — including stale paths inside JSON configs — survives the container restart and gets re-quoted in later turns. The agent isn't lying; it's faithfully reading from its own preserved memory.

Symptom: the agent's `ls /workspace/agent/credentials/` correctly shows the live files, but its prose still describes paths under `/workspace/group/...` that it "saw earlier in the config". This was caught during the LaunchMate port — the agent acknowledged the mistake only after being explicitly told to re-read the config from disk.

#### Step 1: Restart the container (always)

```bash
docker ps --filter "name=nanoclaw-v2-$V2_FOLDER" --format '{{.ID}}' | xargs -r docker stop
# lanes too:
docker ps --filter "name=nanoclaw-v2-$V2_FOLDER-" --format '{{.ID}}' | xargs -r docker stop
```

The next inbound message spawns a new container and reloads the role spec. `.mjs` and other scripts re-read on each `node ...` invocation, so they don't need a session restart — only role specs and persistent prompts do.

#### Step 2: Clear cached session transcripts (if the agent had real-message turns before phase 7)

Skip this for fresh ports where the operator hasn't smoke-tested yet — there's nothing to clear and you don't want to wipe legit memory.

If the agent was tested mid-port (saw real messages, ran tools, quoted file content), the transcripts persist its stale reads. Optional aggressive reset:

```bash
# Find the session id(s) for this agent group
SESSION_DIRS=$(find data/v2-sessions/ -maxdepth 1 -type d -name "ag-*" 2>/dev/null)
# (or filter to a specific agent_groups.id if you've ported many)

# Clear only the SDK's transcripts; keep inbound.db / outbound.db / heartbeat
for d in $SESSION_DIRS; do
  rm -rf "$d/.claude-shared/projects" 2>/dev/null
done
```

This wipes the agent's conversation memory for that session — it forgets earlier turns entirely. Use only when the agent's stale-content quoting is causing real confusion that a plain restart didn't fix.

#### Step 3: Tell the user how to verify

If you're still in conversation with the agent, ask it to **re-read** specific files rather than recall their contents — e.g. *"Read CLAUDE.role.md and the credentials JSON, then list the actual paths shown there."* This forces fresh reads and surfaces any remaining stale-quoting before the operator gets confused by mixed-truth replies.

### 7f. CLAUDE.local.md — role + memory imports

`CLAUDE.local.md` is auto-loaded by Claude Code and is the only place per-group content reaches the agent (the composed `CLAUDE.md` does not auto-import `CLAUDE.role.md` — see 7a.bis). After 7a.bis writes the `@./CLAUDE.role.md` line, also import v1's curated memory file.

**If v1 had a `memory.md`, copy it AND add the import. It's almost always load-bearing.** This isn't optional polish — `memory.md` is where v1 teams encoded the persona ("You are Janet from The Good Place, embody her warmth..."), hard always/never rules, and team-specific defaults. The v2 `agent_groups.name` field is just the dashboard label, not a persona override; without `memory.md` imported, persona-coded agents lose their character entirely on the first message and the operator notices immediately.

```bash
LOCAL="groups/$V2_FOLDER/CLAUDE.local.md"
[ -f "$V1_PATH/groups/$V1_FOLDER/memory.md" ] && \
  cp "$V1_PATH/groups/$V1_FOLDER/memory.md" "groups/$V2_FOLDER/memory.md" && \
  echo '@./memory.md' >> "$LOCAL"
```

**On a channel cutover, scan the copied `memory.md` for channel-specific content and reframe.** Phase 7a covers this for `CLAUDE.role.md`, but `memory.md` has the same problem — and is more dangerous because the agent treats it as authoritative facts rather than instructions. Common patterns to look for after the copy:

- A "Communication Channels" section that says "we communicate exclusively via Slack" / "Teams uses WhatsApp" — the agent will repeat this as fact and may try to message the wrong destination.
- A channel-architecture table with platform JIDs / chat IDs (Slack `C0...` / WhatsApp `...@g.us` / Telegram negative integers) — those IDs are dead in v2 if the channel cut over, and the agent shouldn't try to route to them.
- Per-channel admin / privilege notes ("only adam-dm has register_group", "main channel has elevated tools") — v2 manages privilege via `user_roles`, not channel flags.
- References to v1-only MCP tools that happened to be channel-scoped (`register_group`, etc.).

Don't strip — *reframe*. Move the v1 channel architecture into a `## Historical channels (v1 — <Channel> era)` section labelled clearly as no-longer-live destinations (the table is still useful as archival reference for "what was this team called on Slack"). Add a fresh `## Communication Channels (current — v2)` section pointing at the new channel(s) and the v2 routing model (`send_message` with `to:` for cross-agent delivery; no JIDs in agent code).

If v1 and v2 are on the same channel and platform IDs survive the port, this scan is a no-op — but still grep `memory.md` for `register_group`, `target_group_jid`, and v1 MCP tool names and remove or rewrite. They'll mislead the agent on later turns.

**Symptom if missed:** the agent confidently quotes a Slack channel JID when asked "where should I send this", or refers to itself as the Slack-channel `is_main` agent in a Telegram DM, or proposes `register_group` calls that no longer exist.

In v1, `memory.md` was the per-team curated memory file (personality, principles, hard "always/never" rules). It wasn't auto-loaded by v1's stack either — but the role spec or v1 system prompt explicitly read it on every turn. In v2, the equivalent is auto-loading via `CLAUDE.local.md`.

**Symptom if missed:** the agent loses its persona / hard rules — its assigned voice or character disappears, "always X" / "never Y" guardrails go missing, and team-specific defaults the operator carefully wrote in v1 stop influencing replies.

**Final shape of the file:**

```
@./CLAUDE.role.md
@./memory.md     # only if v1 had memory.md
```

The agent will append its own observations / preferences below these imports over time. Don't pre-seed conversation history or other dynamic state — that's what `conversations/` (skipped) and the wiki are for.

### 7f.bis — Other v1 memory artifacts

If v1 had additional team-specific memory files (`people.md`, `clients.md`, `preferences.md`, `customers.md`, etc.), the rsync in 7d already copied them. They live as separate files at `/workspace/agent/<name>.md` and the agent reads them on demand (the role spec usually points to them). Don't auto-import these into `CLAUDE.local.md` unless they're small (<1KB) and load-bearing on every turn — keeping them as on-demand-readable files saves context budget.

## Phase 8 — Lane agents (only if phase 4 = lane path)

For each entry in v1's `agents.json`:

```bash
pnpm exec tsx scripts/init-lane-agent.ts \
  --parent-folder "$V2_FOLDER" \
  --folder "<parent-folder>-<role>" \
  --name "<Role>" \
  --local-name <role> \
  --provider claude \
  --model sonnet \
  --clone-secrets-from-parent
```

**Naming conventions for lanes:**
- `--name` ("Analyst", "Collector", "Reporter") becomes `agent_groups.name` and the dashboard label. Use just the role — the parent's name (e.g. "LaunchMate") groups them visually already; prefixing every lane with the team name ("LaunchMate Analyst") is verbose without adding info.
- `--folder` ("launchmate-analyst") is the on-disk folder. Team-prefixed because folders are global, not nested under the parent.
- `--local-name` ("analyst") is what the parent calls in `send_message to="analyst"`. Lowercase, role-only, matches the conversational reference. Default is `--folder` if omitted, but role-only is much friendlier for chat.

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

**Auto-port deterministically.** Read v1's `scheduled_tasks` for the team's `chat_jid` and insert each one directly into the V2 session's `inbound.db`. Don't ask the parent agent to register them — the marketing-team port did exactly that, the operator never sent the prompt, and the daily reporting pipeline schedule was silently missing for 6 days before anyone noticed. (The install-level `setup/migrate-v2/tasks.ts` already does this, but only fires when `migrate-v2.sh` is the entrypoint, and it keys on `t.group_folder` which doesn't survive a per-team rename. Per-team ports need their own deterministic insert keyed on the V2 ids we have in hand.)

### 9a. Insert v1 tasks into the V2 session

Idempotent — re-runs skip task IDs already present.

```bash
pnpm exec tsx -e "
const path = require('path');
const Database = require('better-sqlite3');

(async () => {
  const [v1Path, v1Jid, v2AgentGroupId, channel, platformId] = process.argv.slice(1);

  const { initDb } = await import('./src/db/connection.js');
  const { runMigrations } = await import('./src/db/migrations/index.js');
  const { DATA_DIR } = await import('./src/config.js');
  const { getMessagingGroupByPlatform } = await import('./src/db/messaging-groups.js');
  const { resolveSession, openInboundDb } = await import('./src/session-manager.js');
  const { insertTask } = await import('./src/modules/scheduling/db.js');

  const v2Db = initDb(path.join(DATA_DIR, 'v2.db'));
  runMigrations(v2Db);

  const mg = getMessagingGroupByPlatform(channel, platformId);
  if (!mg) { console.error('No messaging_group for ' + channel + ' ' + platformId); process.exit(1); }

  const v1Db = new Database(path.join(v1Path, 'store/messages.db'), { readonly: true });
  const tasks = v1Db.prepare(\"SELECT * FROM scheduled_tasks WHERE chat_jid = ? AND status='active'\").all(v1Jid);
  v1Db.close();
  console.log('v1 active tasks for ' + v1Jid + ': ' + tasks.length);

  // Use 'shared' session_mode — phase 6's init-group-agent.ts always wires this way.
  // If you've manually flipped a wiring to 'per-thread' or 'agent-shared', resolve the
  // session yourself and pass it to insertTask directly instead of this block.
  const { session } = resolveSession(v2AgentGroupId, mg.id, null, 'shared');
  const inb = openInboundDb(v2AgentGroupId, session.id);

  const toRecurrence = (t) => {
    if (t.schedule_type === 'cron') {
      const fields = t.schedule_value.trim().split(/\\s+/).length;
      return fields >= 5 && fields <= 6 ? t.schedule_value.trim() : undefined;
    }
    if (t.schedule_type === 'interval') {
      const m = /^(\\d+)([smhd])$/.exec(t.schedule_value.trim());
      if (!m) return undefined;
      const n = parseInt(m[1], 10), u = m[2];
      if (u === 'm' && n >= 1 && n < 60) return '*/' + n + ' * * * *';
      if (u === 'h' && n >= 1 && n < 24) return '0 */' + n + ' * * *';
      if (u === 'd' && n >= 1 && n < 28) return '0 0 */' + n + ' * *';
      return undefined;
    }
    if (t.schedule_type === 'once' || t.schedule_type === 'at') return null;
    return undefined;
  };

  let migrated = 0, skipped = 0;
  try {
    for (const t of tasks) {
      const exists = inb.prepare(\"SELECT id FROM messages_in WHERE id = ? AND kind = 'task'\").get(t.id);
      if (exists) { skipped++; console.log('skip(exists): ' + t.id); continue; }
      const recurrence = toRecurrence(t);
      if (recurrence === undefined) { skipped++; console.log('skip(unparseable schedule): ' + t.id + ' ' + t.schedule_type + ' ' + t.schedule_value); continue; }
      insertTask(inb, {
        id: t.id,
        processAfter: t.next_run || new Date().toISOString(),
        recurrence,
        platformId,
        channelType: channel,
        threadId: null,
        content: JSON.stringify({
          prompt: t.prompt,
          script: t.script ?? null,
          migrated_from_v1: { original_id: t.id, context_mode: t.context_mode ?? null },
        }),
      });
      migrated++;
      console.log('ported: ' + t.id + ' (' + t.schedule_type + ' ' + t.schedule_value + ')');
    }
  } finally { inb.close(); }
  console.log('result: migrated=' + migrated + ' skipped=' + skipped + ' total=' + tasks.length);
})().catch(e => { console.error(e); process.exit(1); });
" "$V1_PATH" "$V1_JID" "$V2_AGENT_GROUP_ID" "$CHANNEL" "$PLATFORM_ID"
```

`$V1_JID` is `grp.jid` from phase 2b. `$CHANNEL` and `$PLATFORM_ID` are from phase 3. `$V2_AGENT_GROUP_ID` is from phase 6.

### 9b. Save a human-readable reference (optional but useful)

For the agent and future operators to reason about what's scheduled. Not load-bearing for execution — 9a already inserted the rows.

```bash
cat > "groups/$V2_FOLDER/sources/v1-scheduled-tasks.md" <<'EOF'
# v1 scheduled tasks (auto-ported to v2)

<for each task from phase 2b, write:>
## <one-line description>
- Cron: `<schedule_value>`
- Prompt:
  > <prompt body, indented>
EOF
```

### 9c. Verification gate (mandatory)

```bash
pnpm exec tsx -e "
const Database = require('better-sqlite3');
const fs = require('fs'); const path = require('path');
const sessDir = 'data/v2-sessions/' + process.argv[1];
let total = 0;
for (const s of fs.readdirSync(sessDir)) {
  const f = path.join(sessDir, s, 'inbound.db');
  if (!fs.existsSync(f)) continue;
  const db = new Database(f, { readonly: true });
  total += db.prepare(\"SELECT COUNT(DISTINCT series_id) AS n FROM messages_in WHERE kind='task' AND status IN ('pending','paused')\").get().n;
  db.close();
}
console.log('v2 registered tasks: ' + total);
" "$V2_AGENT_GROUP_ID"
```

Compare to phase 2b's `active scheduled_tasks` count. **Mismatch is a blocker** — investigate before phase 10. Common causes:

- `skip(unparseable schedule)` in 9a's output — v1 has an interval/cron format the converter didn't handle (e.g. interval `2w`). Translate by hand and re-insert.
- v1's `chat_jid` doesn't match the team's actual jid (multi-channel teams in v1, or jid drift across v1 versions). Re-check phase 2b's `grp.jid`.
- A wiring isn't `shared` session_mode (rare — `init-group-agent.ts` only writes `shared`). If so, 9a inserted into the wrong session; resolve the right one and re-run.

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

If you see `Session created` but no `Message delivered` after ~10s, peek at the session DBs to see where the chain stalled. The session id appears in the `Session created` log line:

```bash
SESS_DIR="data/v2-sessions/$V2_AGENT_GROUP_ID/<session-id>"
pnpm exec tsx -e "
const Database = require('better-sqlite3');
const inb = new Database('$SESS_DIR/inbound.db', { readonly: true });
console.log('--- messages_in ---');
for (const m of inb.prepare('SELECT seq, kind, status, substr(content,1,200) AS content_preview FROM messages_in ORDER BY seq').all()) console.log(JSON.stringify(m));
const out = new Database('$SESS_DIR/outbound.db', { readonly: true });
console.log('--- messages_out ---');
for (const m of out.prepare('SELECT seq, kind, substr(content,1,200) AS content_preview, timestamp FROM messages_out ORDER BY seq').all()) console.log(JSON.stringify(m));
"
```

Real columns in current trunk: `messages_in.{seq,kind,status,content,timestamp,...}` and `messages_out.{seq,kind,content,timestamp,...}` — `content` is JSON-stringified (`{"text":"..."}`). Don't try `body` or `processing_ack` as columns; they don't exist on these tables (`processing_ack` is a sibling table on `inbound.db`, not a column).

Reading: an inbound row with no matching outbound after ~10s usually means the container crashed silently. `docker ps --filter name=nanoclaw-v2-$V2_FOLDER` and `docker logs <name>` while the container's still up.

### 10b. Credential mount

Ask the agent: "list the files under /workspace/extra/" — confirm it sees the credential files.

### 10c. Delegation

Sub-agent path: ask the parent to use a sub-agent ("have <name> do <task>") and confirm agent-runner logs show a Task-tool call with `subagent_type=<name>`.

Lane path: ask the parent to delegate ("send a brief to <name>: <task>") and confirm a NEW container spawns for the lane (separate `nanoclaw-v2-<lane>-...` in `docker ps` / `container ls`), then a reply comes back to the parent.

### 10d. Wiki access

Ask: "summarize wiki/<some-file>.md" — confirm the agent reads the file.

### 10e. Schedule fires

Schedule a one-off task for `now + 2 minutes`. Wait. The host sweep wakes the session at the scheduled time and the agent posts. Confirm in `logs/nanoclaw.log`.

### 10f. Team scripts smoke-test

For teams whose primary purpose is a script (data collection, reporting pipelines, periodic checks), the chat-reply gate (10a) doesn't prove the agent's actual job works. Run the team's scripts inside a live container and confirm they succeed.

```bash
# Locate test/probe-style scripts at the top level — safe to run unconditionally
TEST_SCRIPTS=$(find "groups/$V2_FOLDER" -maxdepth 1 -type f -name '*.mjs' \
  | xargs grep -l -iE 'test|check|probe' 2>/dev/null)

# A live container — spawn one via the 10a smoke message if none is up
CONTAINER=$(docker ps --filter "name=nanoclaw-v2-$V2_FOLDER" --format '{{.Names}}' | head -1)

for s in $TEST_SCRIPTS; do
  fname=$(basename "$s")
  echo "=== $fname ==="
  docker exec "$CONTAINER" node "/workspace/agent/$fname" 2>&1 | tail -20
  echo "exit: $?"
done
```

For non-test-named scripts (the daily pipelines themselves — `collector.mjs`, `analyst.mjs`, `reporter.mjs`, etc.), prompt the operator: *"Run `<script>` as part of verification? It will [side effects]. [Y/n]"*. If yes, run via `docker exec`. If no, note in the port log that the script wasn't smoke-tested.

**Failure patterns — any of these blocks v1 retirement:**

| Stderr pattern | Likely cause |
|---|---|
| `UNAUTHENTICATED` / `PERMISSION_DENIED` | Auth chain broken — check 7c.bis dep-drift (especially `google-auth-library` major bump) |
| `MetadataLookupWarning` followed by an auth error | google-auth-library@10.x JWT not flowing through gax bridge — pin `google-auth-library@9.15.1` and rerun |
| `ENOENT.*workspace/group` | Phase 7e path sweep missed a file — re-run the sed from 7e |
| `Cannot find module` | 7c.bis missed a dep, or `container.json.packages.npm` is incomplete — add to package list and rebuild |
| Script silently exits 0 with no output | Common when a `try/catch` swallows the auth error — read the script and check its error-reporting path |

This gate would have caught the marketing-team port's silent auth break on day one rather than 6 days later.

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
