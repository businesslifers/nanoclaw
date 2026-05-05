PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE agent_group_members (
        user_id        TEXT NOT NULL REFERENCES users(id),
        agent_group_id TEXT NOT NULL REFERENCES agent_groups(id),
        added_by       TEXT REFERENCES users(id),
        added_at       TEXT NOT NULL,
        PRIMARY KEY (user_id, agent_group_id)
      );
INSERT INTO agent_group_members VALUES('telegram:7466423983','ag-1777257359331-63ti7x',NULL,'2026-04-27T02:35:59.331Z');
COMMIT;
