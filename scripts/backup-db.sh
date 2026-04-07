#!/bin/bash
# Daily SQLite backup with 7-day retention
DB="/home/adam/derek/store/messages.db"
BACKUP_DIR="/home/adam/derek/backups"
BACKUP_FILE="$BACKUP_DIR/messages-$(date +%Y%m%d).db"

# Use node + better-sqlite3 for safe .backup (no sqlite3 CLI installed)
node -e "
  const Database = require('better-sqlite3');
  const db = new Database('$DB', { readonly: true });
  db.backup('$BACKUP_FILE').then(() => {
    console.log('Backup complete: $BACKUP_FILE');
    db.close();
  }).catch(err => {
    console.error('Backup failed:', err.message);
    db.close();
    process.exit(1);
  });
"

# Delete backups older than 7 days
find "$BACKUP_DIR" -name "messages-*.db" -mtime +7 -delete 2>/dev/null
