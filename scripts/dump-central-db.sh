#!/usr/bin/env bash
# Selective text-dump of identity-defining tables in data/v2.db.
# Output: data/dumps/<table>.sql — committed as text for diffability.
# The live data/v2.db is gitignored; restore via:
#   sqlite3 data/v2.db < data/dumps/_combined.sql
#
# Run before any commit that should snapshot install state.
# Schema migrations: dump after migrations have run on the source system,
# and on restore: create empty DB → run migrations → load dumps.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB="$REPO_ROOT/data/v2.db"
OUT="$REPO_ROOT/data/dumps"

if [[ ! -f "$DB" ]]; then
  echo "no central DB at $DB — nothing to dump" >&2
  exit 0
fi

# Identity tables: change rarely, define WHO this install is.
# Runtime tables (sessions, pending_*, chat_sdk_*) are intentionally excluded —
# they regenerate as messages flow in after restore.
IDENTITY_TABLES=(
  schema_version
  agent_groups
  messaging_groups
  messaging_group_agents
  agent_destinations
  users
  user_roles
  agent_group_members
  user_dms
)

mkdir -p "$OUT"

# Checkpoint WAL into the main DB file so the dump sees latest writes.
sqlite3 "$DB" "PRAGMA wal_checkpoint(TRUNCATE);" >/dev/null

# Per-table dumps for clean diffs.
for table in "${IDENTITY_TABLES[@]}"; do
  if sqlite3 "$DB" "SELECT name FROM sqlite_master WHERE type='table' AND name='$table';" | grep -q "^$table$"; then
    sqlite3 "$DB" ".dump $table" > "$OUT/$table.sql"
  else
    rm -f "$OUT/$table.sql"
  fi
done

# Combined dump for one-shot restore.
{
  echo "-- Combined identity-table dump for one-shot restore."
  echo "-- Apply on a fresh DB AFTER running schema migrations."
  echo "PRAGMA foreign_keys=OFF;"
  echo "BEGIN TRANSACTION;"
  for table in "${IDENTITY_TABLES[@]}"; do
    [[ -f "$OUT/$table.sql" ]] && cat "$OUT/$table.sql"
  done
  echo "COMMIT;"
} > "$OUT/_combined.sql"

echo "wrote dumps to $OUT/"
ls -1 "$OUT/"
