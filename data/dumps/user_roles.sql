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
INSERT INTO user_roles VALUES('slack:U0AD5J35TFA','owner',NULL,'slack:U0AD5J35TFA','2026-05-08T01:10:55.000Z');
INSERT INTO user_roles VALUES('slack:UAMCT083F','owner',NULL,'slack:U0AD5J35TFA','2026-05-08T04:36:42.127Z');
COMMIT;
