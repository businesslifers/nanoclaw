PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE users (
        id           TEXT PRIMARY KEY,
        kind         TEXT NOT NULL,
        display_name TEXT,
        created_at   TEXT NOT NULL
      );
INSERT INTO users VALUES('cli:local','cli','Adam','2026-04-27T02:00:49.927Z');
INSERT INTO users VALUES('telegram:7466423983','telegram','Adam','2026-04-27T02:35:40.816Z');
INSERT INTO users VALUES('slack:U0AD5J35TFA','slack','Adam Jowett','2026-05-05T05:03:14.563Z');
COMMIT;
