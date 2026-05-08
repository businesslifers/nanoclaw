PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE user_dms (
        user_id            TEXT NOT NULL REFERENCES users(id),
        channel_type       TEXT NOT NULL,
        messaging_group_id TEXT NOT NULL REFERENCES messaging_groups(id),
        resolved_at        TEXT NOT NULL,
        PRIMARY KEY (user_id, channel_type)
      );
INSERT INTO user_dms VALUES('slack:U0AD5J35TFA','slack','mg-1777957394563-jfn9s6','2026-05-08T01:10:55.000Z');
COMMIT;
