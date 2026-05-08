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
INSERT INTO agent_group_members VALUES('slack:U0AD5J35TFA','ag-1777257359331-63ti7x','telegram:7466423983','2026-05-05T05:05:37.563Z');
INSERT INTO agent_group_members VALUES('slack:U0AD5J35TFA','ag-1777429834314-u4riyu','telegram:7466423983','2026-05-05T05:11:55.683Z');
INSERT INTO agent_group_members VALUES('slack:U0AD5J35TFA','ag-1778203406039-nhnh92','slack:U0AD5J35TFA','2026-05-08T01:23:26.039Z');
INSERT INTO agent_group_members VALUES('slack:UAMCT083F','ag-1778203406039-nhnh92','slack:U0AD5J35TFA','2026-05-08T03:40:19.851Z');
COMMIT;
