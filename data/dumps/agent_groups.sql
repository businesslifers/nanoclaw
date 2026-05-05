PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE agent_groups (
        id               TEXT PRIMARY KEY,
        name             TEXT NOT NULL,
        folder           TEXT NOT NULL UNIQUE,
        agent_provider   TEXT,
        created_at       TEXT NOT NULL
      );
INSERT INTO agent_groups VALUES('ag-1777255249928-wmdu63','CLI Agent','cli-with-adam',NULL,'2026-04-27T02:00:49.927Z');
INSERT INTO agent_groups VALUES('ag-1777257359331-63ti7x','Janet','dm-with-adam',NULL,'2026-04-27T02:35:59.331Z');
INSERT INTO agent_groups VALUES('ag-1777429834314-u4riyu','Marketing Team','marketingteam',NULL,'2026-04-29T02:30:34.313Z');
INSERT INTO agent_groups VALUES('ag-1777429950395-mfpkc5','Analyst','marketingteam-analyst','claude','2026-04-29T02:32:30.395Z');
INSERT INTO agent_groups VALUES('ag-1777429951298-sb2cr5','Collector','marketingteam-collector','claude','2026-04-29T02:32:31.298Z');
INSERT INTO agent_groups VALUES('ag-1777429952193-oeprs7','Reporter','marketingteam-reporter','claude','2026-04-29T02:32:32.192Z');
INSERT INTO agent_groups VALUES('ag-1777601813158-ualv4y','CRM','crm',NULL,'2026-05-01T02:16:53.158Z');
INSERT INTO agent_groups VALUES('ag-1777607105027-isi0rv','ClientMate','clientmate',NULL,'2026-05-01T03:45:05.026Z');
COMMIT;
