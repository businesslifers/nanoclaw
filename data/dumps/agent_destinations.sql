PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE agent_destinations (
        agent_group_id  TEXT NOT NULL REFERENCES agent_groups(id),
        local_name      TEXT NOT NULL,
        target_type     TEXT NOT NULL,
        target_id       TEXT NOT NULL,
        created_at      TEXT NOT NULL,
        PRIMARY KEY (agent_group_id, local_name)
      );
INSERT INTO agent_destinations VALUES('ag-1777255249928-wmdu63','local-cli','channel','mg-1777255249930-a6z6ke','2026-04-27T02:00:49.927Z');
INSERT INTO agent_destinations VALUES('ag-1777257359331-63ti7x','telegram-mg-17772','channel','mg-1777256921639-x18t1p','2026-04-27T02:35:59.331Z');
INSERT INTO agent_destinations VALUES('ag-1777257359331-63ti7x','telegram-mg-17774','channel','mg-1777429771946-afqaze','2026-04-29T02:29:44.929Z');
INSERT INTO agent_destinations VALUES('ag-1777429834314-u4riyu','marketingteam','channel','mg-1777429771946-afqaze','2026-04-29T02:30:34.313Z');
INSERT INTO agent_destinations VALUES('ag-1777429834314-u4riyu','analyst','agent','ag-1777429950395-mfpkc5','2026-04-29T02:32:30.395Z');
INSERT INTO agent_destinations VALUES('ag-1777429950395-mfpkc5','parent','agent','ag-1777429834314-u4riyu','2026-04-29T02:32:30.395Z');
INSERT INTO agent_destinations VALUES('ag-1777429834314-u4riyu','collector','agent','ag-1777429951298-sb2cr5','2026-04-29T02:32:31.298Z');
INSERT INTO agent_destinations VALUES('ag-1777429951298-sb2cr5','parent','agent','ag-1777429834314-u4riyu','2026-04-29T02:32:31.298Z');
INSERT INTO agent_destinations VALUES('ag-1777429834314-u4riyu','reporter','agent','ag-1777429952193-oeprs7','2026-04-29T02:32:32.192Z');
INSERT INTO agent_destinations VALUES('ag-1777429952193-oeprs7','parent','agent','ag-1777429834314-u4riyu','2026-04-29T02:32:32.192Z');
INSERT INTO agent_destinations VALUES('ag-1777601813158-ualv4y','crm','channel','mg-1777601737339-kdt2fr','2026-05-01T02:16:53.158Z');
INSERT INTO agent_destinations VALUES('ag-1777607105027-isi0rv','clientmate','channel','mg-1777607057297-8k2t6h','2026-05-01T03:45:05.026Z');
INSERT INTO agent_destinations VALUES('ag-1777257359331-63ti7x','slack-mg-17779','channel','mg-1777957394563-jfn9s6','2026-05-05T05:05:37.561Z');
INSERT INTO agent_destinations VALUES('ag-1777429834314-u4riyu','marketing-team','channel','mg-1777957905683-uxjv20','2026-05-05T05:11:55.682Z');
INSERT INTO agent_destinations VALUES('ag-1778203406039-nhnh92','project-management-team','channel','mg-1778202109644-wu0hza','2026-05-08T02:57:31.528Z');
INSERT INTO agent_destinations VALUES('ag-1778215787818-bncghq','slack-mg-17782','channel','mg-1778215735145-qty9u2','2026-05-08T04:49:47.820Z');
INSERT INTO agent_destinations VALUES('ag-1777257359331-63ti7x','raels','agent','ag-1778215787818-bncghq','2026-05-08T05:02:40.524Z');
INSERT INTO agent_destinations VALUES('ag-1778215787818-bncghq','adam','agent','ag-1777257359331-63ti7x','2026-05-08T05:02:40.524Z');
INSERT INTO agent_destinations VALUES('ag-1778549688239-0u5g1v','slack-mg-17785','channel','mg-1778547686046-hy2q7l','2026-05-12T01:34:48.241Z');
INSERT INTO agent_destinations VALUES('ag-1777257359331-63ti7x','tracey','agent','ag-1778549688239-0u5g1v','2026-05-12T01:44:14.000Z');
INSERT INTO agent_destinations VALUES('ag-1778215787818-bncghq','tracey','agent','ag-1778549688239-0u5g1v','2026-05-12T01:44:14.000Z');
INSERT INTO agent_destinations VALUES('ag-1778549688239-0u5g1v','adam','agent','ag-1777257359331-63ti7x','2026-05-12T01:44:14.000Z');
INSERT INTO agent_destinations VALUES('ag-1778549688239-0u5g1v','raels','agent','ag-1778215787818-bncghq','2026-05-12T01:44:14.000Z');
INSERT INTO agent_destinations VALUES('ag-1780365571870-gslxpq','carpet-one','channel','mg-1780365571872-l6rq6u','2026-06-02T01:59:31.872Z');
INSERT INTO agent_destinations VALUES('ag-1780365571870-gslxpq','pm-project','agent','d7dfb3be-2eef-41ce-b7ac-42156ab8ae31','2026-06-02T02:14:15.088Z');
INSERT INTO agent_destinations VALUES('d7dfb3be-2eef-41ce-b7ac-42156ab8ae31','parent','agent','ag-1780365571870-gslxpq','2026-06-02T02:14:15.088Z');
INSERT INTO agent_destinations VALUES('ag-1780365571870-gslxpq','research-local-market','agent','7c2ec039-1d69-4b74-b814-e0af577b8479','2026-06-02T02:26:57.170Z');
INSERT INTO agent_destinations VALUES('7c2ec039-1d69-4b74-b814-e0af577b8479','parent','agent','ag-1780365571870-gslxpq','2026-06-02T02:26:57.170Z');
COMMIT;
