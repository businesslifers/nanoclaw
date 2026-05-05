PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE user_dms (
        user_id            TEXT NOT NULL REFERENCES users(id),
        channel_type       TEXT NOT NULL,
        messaging_group_id TEXT NOT NULL REFERENCES messaging_groups(id),
        resolved_at        TEXT NOT NULL,
        PRIMARY KEY (user_id, channel_type)
      );
INSERT INTO user_dms VALUES('telegram:7466423983','telegram','mg-1777256921639-x18t1p','2026-04-29T02:29:31.949Z');
COMMIT;
