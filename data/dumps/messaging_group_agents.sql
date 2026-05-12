PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE messaging_group_agents (
        id                 TEXT PRIMARY KEY,
        messaging_group_id TEXT NOT NULL REFERENCES messaging_groups(id),
        agent_group_id     TEXT NOT NULL REFERENCES agent_groups(id),
        session_mode       TEXT DEFAULT 'shared',
        priority           INTEGER DEFAULT 0,
        created_at         TEXT NOT NULL, engage_mode            TEXT, engage_pattern         TEXT, sender_scope           TEXT, ignored_message_policy TEXT,
        UNIQUE(messaging_group_id, agent_group_id)
      );
INSERT INTO messaging_group_agents VALUES('mga-1777255249930-9llpd0','mg-1777255249930-a6z6ke','ag-1777255249928-wmdu63','shared',0,'2026-04-27T02:00:49.927Z','pattern','.','all','drop');
INSERT INTO messaging_group_agents VALUES('mga-1777601813160-ew67xa','mg-1777601737339-kdt2fr','ag-1777601813158-ualv4y','shared',0,'2026-05-01T02:16:53.158Z','mention',NULL,'all','drop');
INSERT INTO messaging_group_agents VALUES('mga-1777607105029-5wpulm','mg-1777607057297-8k2t6h','ag-1777607105027-isi0rv','shared',0,'2026-05-01T03:45:05.026Z','pattern','.','all','drop');
INSERT INTO messaging_group_agents VALUES('mga-1777957537561-m0w5f7','mg-1777957394563-jfn9s6','ag-1777257359331-63ti7x','shared',0,'2026-05-05T05:05:37.561Z','mention-sticky',NULL,'known','accumulate');
INSERT INTO messaging_group_agents VALUES('mga-1777957915682-2rumxc','mg-1777957905683-uxjv20','ag-1777429834314-u4riyu','shared',0,'2026-05-05T05:11:55.682Z','mention-sticky',NULL,'known','accumulate');
INSERT INTO messaging_group_agents VALUES('mga-1778203406041-z7d4na','mg-1778202109644-wu0hza','ag-1778203406039-nhnh92','shared',0,'2026-05-08T01:23:26.039Z','pattern','.','known','accumulate');
INSERT INTO messaging_group_agents VALUES('mga-1778215787819-hb9nsg','mg-1778215735145-qty9u2','ag-1778215787818-bncghq','shared',0,'2026-05-08T04:49:47.820Z','mention-sticky',NULL,'known','accumulate');
INSERT INTO messaging_group_agents VALUES('mga-1778549688241-yeuk3e','mg-1778547686046-hy2q7l','ag-1778549688239-0u5g1v','shared',0,'2026-05-12T01:34:48.241Z','mention-sticky',NULL,'known','accumulate');
COMMIT;
