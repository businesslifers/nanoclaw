PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE user_roles (
        user_id        TEXT NOT NULL REFERENCES users(id),
        role           TEXT NOT NULL,
        agent_group_id TEXT REFERENCES agent_groups(id),
        granted_by     TEXT REFERENCES users(id),
        granted_at     TEXT NOT NULL,
        PRIMARY KEY (user_id, role, agent_group_id)
      );
INSERT INTO user_roles VALUES('telegram:7466423983','owner',NULL,NULL,'2026-04-27T02:35:40.816Z');
COMMIT;
