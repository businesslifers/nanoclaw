-- Combined identity-table dump for one-shot restore.
-- Apply on a fresh DB AFTER running schema migrations.
PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE schema_version (
      version INTEGER PRIMARY KEY,
      name    TEXT NOT NULL,
      applied TEXT NOT NULL
    );
INSERT INTO schema_version VALUES(1,'initial-v2-schema','2026-04-27T02:00:36.849Z');
INSERT INTO schema_version VALUES(2,'chat-sdk-state','2026-04-27T02:00:36.850Z');
INSERT INTO schema_version VALUES(3,'pending-approvals','2026-04-27T02:00:36.850Z');
INSERT INTO schema_version VALUES(4,'agent-destinations','2026-04-27T02:00:36.851Z');
INSERT INTO schema_version VALUES(5,'pending-approvals-title-options','2026-04-27T02:00:36.851Z');
INSERT INTO schema_version VALUES(6,'dropped-messages','2026-04-27T02:00:36.851Z');
INSERT INTO schema_version VALUES(7,'drop-pending-credentials','2026-04-27T02:00:36.852Z');
INSERT INTO schema_version VALUES(8,'engage-modes','2026-04-27T02:00:36.855Z');
INSERT INTO schema_version VALUES(9,'pending-sender-approvals','2026-04-27T02:00:36.855Z');
INSERT INTO schema_version VALUES(10,'channel-registration','2026-04-27T02:00:36.857Z');
INSERT INTO schema_version VALUES(11,'approval-render-metadata','2026-04-27T02:00:36.858Z');
INSERT INTO schema_version VALUES(12,'dashboard-audit','2026-04-30T04:41:27.838Z');
COMMIT;
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
PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE messaging_groups (
        id                    TEXT PRIMARY KEY,
        channel_type          TEXT NOT NULL,
        platform_id           TEXT NOT NULL,
        name                  TEXT,
        is_group              INTEGER DEFAULT 0,
        unknown_sender_policy TEXT NOT NULL DEFAULT 'strict',
        created_at            TEXT NOT NULL, denied_at TEXT,
        UNIQUE(channel_type, platform_id)
      );
INSERT INTO messaging_groups VALUES('mg-1777255249930-a6z6ke','cli','local','Local CLI',0,'public','2026-04-27T02:00:49.927Z',NULL);
INSERT INTO messaging_groups VALUES('mg-1777256921639-x18t1p','telegram','telegram:7466423983',NULL,0,'request_approval','2026-04-27T02:28:41.639Z',NULL);
INSERT INTO messaging_groups VALUES('mg-1777429771946-afqaze','telegram','telegram:-5055500128','Marketing Team',1,'request_approval','2026-04-29T02:29:31.946Z',NULL);
INSERT INTO messaging_groups VALUES('mg-1777601737339-kdt2fr','telegram','telegram:-5116329515','CRM',1,'request_approval','2026-05-01T02:15:37.339Z',NULL);
INSERT INTO messaging_groups VALUES('mg-1777607057297-8k2t6h','telegram','telegram:-5293085842','clientmate',1,'request_approval','2026-05-01T03:44:17.297Z',NULL);
INSERT INTO messaging_groups VALUES('mg-1777957394563-jfn9s6','slack','slack:D0B16TLGLJ3',NULL,0,'request_approval','2026-05-05T05:03:14.563Z',NULL);
INSERT INTO messaging_groups VALUES('mg-1777957905683-uxjv20','slack','slack:C0B1LB9T26A','marketing-team',1,'request_approval','2026-05-05T05:11:45.683Z',NULL);
COMMIT;
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
INSERT INTO messaging_group_agents VALUES('mga-1777257359333-0ktkjn','mg-1777256921639-x18t1p','ag-1777257359331-63ti7x','shared',0,'2026-04-27T02:35:59.331Z','pattern','.','all','drop');
INSERT INTO messaging_group_agents VALUES('mga-1777429834315-t1u1ro','mg-1777429771946-afqaze','ag-1777429834314-u4riyu','shared',0,'2026-04-29T02:30:34.313Z','mention',NULL,'all','drop');
INSERT INTO messaging_group_agents VALUES('mga-1777601813160-ew67xa','mg-1777601737339-kdt2fr','ag-1777601813158-ualv4y','shared',0,'2026-05-01T02:16:53.158Z','mention',NULL,'all','drop');
INSERT INTO messaging_group_agents VALUES('mga-1777607105029-5wpulm','mg-1777607057297-8k2t6h','ag-1777607105027-isi0rv','shared',0,'2026-05-01T03:45:05.026Z','pattern','.','all','drop');
INSERT INTO messaging_group_agents VALUES('mga-1777957537561-m0w5f7','mg-1777957394563-jfn9s6','ag-1777257359331-63ti7x','shared',0,'2026-05-05T05:05:37.561Z','mention-sticky',NULL,'known','accumulate');
INSERT INTO messaging_group_agents VALUES('mga-1777957915682-2rumxc','mg-1777957905683-uxjv20','ag-1777429834314-u4riyu','shared',0,'2026-05-05T05:11:55.682Z','mention-sticky',NULL,'known','accumulate');
COMMIT;
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
COMMIT;
PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE user_dms (
        user_id            TEXT NOT NULL REFERENCES users(id),
        channel_type       TEXT NOT NULL,
        messaging_group_id TEXT NOT NULL REFERENCES messaging_groups(id),
        resolved_at        TEXT NOT NULL,
        PRIMARY KEY (user_id, channel_type)
      );
INSERT INTO user_dms VALUES('telegram:7466423983','telegram','mg-1777256921639-x18t1p','2026-04-29T02:29:31.949Z');
COMMIT;
COMMIT;
