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
COMMIT;
