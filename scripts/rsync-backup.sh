#!/bin/bash
# Rsync NanoClaw data to rclone remote (nanoclawbackup)
# Runs daily via cron. Safe to run while NanoClaw is live —
# SQLite backups are handled by backup-db.sh (runs first).

set -euo pipefail

DEREK="/home/adam/derek"
REMOTE="nanoclawbackup:derek"
LOG="$DEREK/logs/rsync-backup.log"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG"; }

log "Backup started"

# Run local DB backup first (safe hot copy)
bash "$DEREK/scripts/backup-db.sh" >> "$LOG" 2>&1

# Archive store/auth/ (35k+ small files) into a single tarball before upload
AUTH_TAR="$DEREK/store/auth-backup.tar.gz"
tar czf "$AUTH_TAR" -C "$DEREK/store" auth >> "$LOG" 2>&1
log "Auth archive created ($(du -h "$AUTH_TAR" | cut -f1))"

# Sync store — upload the tarball, skip the auth directory and SQLite WAL/SHM
rclone sync "$DEREK/store/"       "$REMOTE/store/"       --exclude "auth/**" --exclude "messages.db-shm" --exclude "messages.db-wal" >> "$LOG" 2>&1
rclone sync "$DEREK/groups/"      "$REMOTE/groups/"      --copy-links >> "$LOG" 2>&1
rclone sync "$DEREK/config/"      "$REMOTE/config/"      >> "$LOG" 2>&1
rclone sync "$DEREK/backups/"     "$REMOTE/backups/"     >> "$LOG" 2>&1
rclone sync "$DEREK/data/sessions/" "$REMOTE/data/sessions/" >> "$LOG" 2>&1
rclone copy "$DEREK/.env"         "$REMOTE/"             >> "$LOG" 2>&1
rclone sync "$DEREK/repo-tokens/" "$REMOTE/repo-tokens/" >> "$LOG" 2>&1

# Logs — only last 7 days
rclone sync "$DEREK/logs/"        "$REMOTE/logs/" --max-age 7d >> "$LOG" 2>&1

log "Backup completed"
