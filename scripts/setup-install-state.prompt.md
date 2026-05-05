# Prompt: replicate install-state tracking on another NanoClaw v2 instance

Paste the body below into Claude Code (or any capable agent) on the target install.

---

I want to set up per-install state tracking on this NanoClaw v2 install so a single git remote becomes a disaster-recovery snapshot — clone it onto a new machine and the install rebuilds (modulo re-injecting OneCLI vault secrets).

## Design — what to track vs exclude

**Track on the install remote** (typically `origin`):
- `groups/*/CLAUDE.role.md`, `CLAUDE.local.md`, `memory.md`, `container.json` — personas + configs
- `groups/*/wiki/`, curated content folders (clients, voices, specs, roles), agent scripts (`*.mjs`, `*.ts`)
- `data/dumps/*.sql` — text dumps of identity-defining tables only (see below)
- `data/install-id`, `scripts/dump-central-db.sh`, `.husky/pre-commit`

**Exclude via gitignore** (these never push):
- `groups/*/sources/` — chat history, raw ingestion material; may contain PII
- `groups/*/credentials/` — live keys; real ones live in OneCLI vault
- `groups/*/data/{raw,analysis,reports,*.log}` and other regenerable runtime
- `groups/*/{node_modules,.pnpm-store,.pnpm-cache,dist}/`
- `groups/*/CLAUDE.md`, `groups/*/.claude-shared.md`, `groups/*/.claude-fragments/` — composer-managed, regenerated on spawn
- `data/v2.db`, `data/v2.db-shm`, `data/v2.db-wal` — live DB and SQLite transient state
- `data/v2-sessions/`, `data/circuit-breaker.json`, `data/cli.sock`, `data/env/`, `data/telegram-pairings.json`

**Selective DB dump rationale:** dump only identity tables (slow-growth, define WHO this install is). Skip runtime tables (sessions, pending_*, chat_sdk_*) — they regenerate as messages flow in after restore, and including them would bloat the repo over years. Identity tables to dump: `agent_groups`, `messaging_groups`, `messaging_group_agents`, `users`, `user_roles`, `agent_group_members`, `user_dms`, `schema_version`. Verify against the current schema with `sqlite3 data/v2.db ".tables"` before finalising the list.

## Plan

1. **Pre-flight — mandatory secret sweep BEFORE any git operations.** Run a comprehensive scan over `groups/` and `data/` for: `BEGIN PRIVATE KEY` blocks, `sk-ant-`, `sk_live_`, `pk_<digits>_<alnum>` ClickUp tokens, `AKIA[0-9A-Z]{16}` AWS keys, `[0-9]{8,12}:[A-Za-z0-9_-]{30,}` Telegram-style bot tokens, `Bearer ...`, `private_key`, `client_secret`. Surface every hit. If any are inside files that the new gitignore would still track, **stop and rotate the keys** (or at minimum redact and confirm with the user) before continuing. A leaked key inside a tracked file is the failure mode this whole exercise is meant to prevent.

2. **Confirm remote intent.** Run `git remote -v`. Confirm with the user which remote should become the install-state target. Don't assume — naming varies. The current `.gitignore` likely came from upstream NanoClaw and broadly excludes `groups/*` + `data/`; we're inverting that for the install remote only.

3. **Create `scripts/dump-central-db.sh`** (selective dump, WAL checkpoint first, per-table files + a `_combined.sql` for one-shot restore):

```bash
#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB="$REPO_ROOT/data/v2.db"
OUT="$REPO_ROOT/data/dumps"
[[ -f "$DB" ]] || { echo "no central DB at $DB" >&2; exit 0; }
IDENTITY_TABLES=(schema_version agent_groups messaging_groups messaging_group_agents users user_roles agent_group_members user_dms)
mkdir -p "$OUT"
sqlite3 "$DB" "PRAGMA wal_checkpoint(TRUNCATE);" >/dev/null
for t in "${IDENTITY_TABLES[@]}"; do
  if sqlite3 "$DB" "SELECT name FROM sqlite_master WHERE type='table' AND name='$t';" | grep -q "^$t$"; then
    sqlite3 "$DB" ".dump $t" > "$OUT/$t.sql"
  else rm -f "$OUT/$t.sql"; fi
done
{ echo "PRAGMA foreign_keys=OFF;"; echo "BEGIN TRANSACTION;"
  for t in "${IDENTITY_TABLES[@]}"; do [[ -f "$OUT/$t.sql" ]] && cat "$OUT/$t.sql"; done
  echo "COMMIT;"; } > "$OUT/_combined.sql"
```

`chmod +x` it. Run it once to populate `data/dumps/`.

4. **Rewrite `.gitignore`** to invert the broad rules. Remove blanket `groups/*` and `data/`. Add the specific exclusions from the Design section above. Keep generic excludes (`node_modules/`, `.env`, `.DS_Store`, etc.) intact. Note: the existing rule `**/CLAUDE.local.md` is wrong — `CLAUDE.local.md` is editable user content, not regenerated. Remove that rule and instead block only `groups/*/CLAUDE.md`, `.claude-shared.md`, `.claude-fragments/` (those ARE regenerated at spawn).

5. **Wire the husky pre-commit hook.** Check if `.husky/pre-commit` exists; if so, append (don't replace). Add:

```sh
if [ -f data/v2.db ]; then
  bash scripts/dump-central-db.sh >/dev/null
  git add data/dumps/
fi
```

This auto-refreshes dumps on every commit. No-op on fresh clones where the live DB doesn't exist yet.

6. **Preview before committing.** Use `git add -A --intent-to-add` (or equivalent) to surface what would be staged under the new gitignore. Run the secret scan again over that exact set. Show the user the full file list and counts. Only stage and commit after they confirm.

7. **Restore path doc:** mention to the user that on restore, `sqlite3 data/v2.db < data/dumps/_combined.sql` reconstructs identity state — but should run AFTER the framework's schema migrations have run on the fresh install, not before. Schema-version mismatches between dump and live can fail otherwise.

## Things to verify with the user before pushing

- Which remote? (Confirm install-state target.)
- Are there any files outside the patterns above that they want tracked or excluded? (Watch for things like `data/install-id` — small but identifying; default is to track it.)
- Should the existing local commits ahead of the install-remote ride along, or be migrated to a framework-fork remote first?

**Don't push** unless explicitly authorised. Show `git log <install-remote>/main..HEAD` first.

## Reference

If they want to compare against a working setup: github.com/businesslifers/janet-v2 (the install repo this design was first implemented on). The `.gitignore`, `scripts/dump-central-db.sh`, and `.husky/pre-commit` there are the canonical examples.
