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
INSERT INTO schema_version VALUES(13,'container-configs','2026-05-11T01:02:02.903Z');
INSERT INTO schema_version VALUES(14,'cli-scope','2026-05-11T01:02:02.910Z');
INSERT INTO schema_version VALUES(15,'agent-group-hidden-dashboard','2026-05-11T01:42:25.493Z');
INSERT INTO schema_version VALUES(16,'messaging-group-instance','2026-06-12T00:38:51.753Z');
INSERT INTO schema_version VALUES(17,'agent-message-policies','2026-06-19T08:29:00.833Z');
INSERT INTO schema_version VALUES(18,'approvals-approver-user-id','2026-06-19T08:29:00.833Z');
INSERT INTO schema_version VALUES(19,'work-items','2026-07-03T01:37:46.046Z');
COMMIT;
PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE agent_groups (
        id               TEXT PRIMARY KEY,
        name             TEXT NOT NULL,
        folder           TEXT NOT NULL UNIQUE,
        agent_provider   TEXT,
        created_at       TEXT NOT NULL
      , hidden_in_dashboard INTEGER NOT NULL DEFAULT 0);
INSERT INTO agent_groups VALUES('ag-1777255249928-wmdu63','CLI Agent','cli-with-adam',NULL,'2026-04-27T02:00:49.927Z',1);
INSERT INTO agent_groups VALUES('ag-1777257359331-63ti7x','Janet','dm-with-adam',NULL,'2026-04-27T02:35:59.331Z',1);
INSERT INTO agent_groups VALUES('ag-1777429834314-u4riyu','Marketing Team','marketingteam',NULL,'2026-04-29T02:30:34.313Z',0);
INSERT INTO agent_groups VALUES('ag-1777429950395-mfpkc5','Analyst','marketingteam-analyst','claude','2026-04-29T02:32:30.395Z',0);
INSERT INTO agent_groups VALUES('ag-1777429951298-sb2cr5','Collector','marketingteam-collector','claude','2026-04-29T02:32:31.298Z',0);
INSERT INTO agent_groups VALUES('ag-1777429952193-oeprs7','Reporter','marketingteam-reporter','claude','2026-04-29T02:32:32.192Z',0);
INSERT INTO agent_groups VALUES('ag-1777601813158-ualv4y','CRM','crm',NULL,'2026-05-01T02:16:53.158Z',0);
INSERT INTO agent_groups VALUES('ag-1777607105027-isi0rv','ClientMate','clientmate',NULL,'2026-05-01T03:45:05.026Z',0);
INSERT INTO agent_groups VALUES('ag-1778203406039-nhnh92','Project Management Team','project-management-team',NULL,'2026-05-08T01:23:26.039Z',0);
INSERT INTO agent_groups VALUES('ag-1778215787818-bncghq','Janet','dm-with-raeleen',NULL,'2026-05-08T04:49:47.818Z',1);
INSERT INTO agent_groups VALUES('ag-1778549688239-0u5g1v','Janet','dm-with-tracey',NULL,'2026-05-12T01:34:48.239Z',1);
INSERT INTO agent_groups VALUES('ag-1780365571870-gslxpq','Carpet One','carpet-one',NULL,'2026-06-02T01:59:31.870Z',0);
INSERT INTO agent_groups VALUES('d7dfb3be-2eef-41ce-b7ac-42156ab8ae31','PM','carpet-one-pm-project',NULL,'2026-06-02T02:14:15.088Z',0);
INSERT INTO agent_groups VALUES('7c2ec039-1d69-4b74-b814-e0af577b8479','Local Market Analyst','carpet-one-research-local-market',NULL,'2026-06-02T02:26:57.170Z',0);
COMMIT;
PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE container_configs (
        agent_group_id        TEXT PRIMARY KEY REFERENCES agent_groups(id) ON DELETE CASCADE,
        provider              TEXT,
        model                 TEXT,
        effort                TEXT,
        image_tag             TEXT,
        assistant_name        TEXT,
        max_messages_per_prompt INTEGER,
        skills                TEXT NOT NULL DEFAULT '"all"',
        mcp_servers           TEXT NOT NULL DEFAULT '{}',
        packages_apt          TEXT NOT NULL DEFAULT '[]',
        packages_npm          TEXT NOT NULL DEFAULT '[]',
        additional_mounts     TEXT NOT NULL DEFAULT '[]',
        updated_at            TEXT NOT NULL
      , cli_scope TEXT NOT NULL DEFAULT 'group');
INSERT INTO container_configs VALUES('ag-1777429950395-mfpkc5','claude',NULL,NULL,NULL,NULL,NULL,'"all"','{}','[]','[]','[{"hostPath":"/home/admin/Agents/janet-v2/groups/marketingteam/wiki","containerPath":"team-wiki","readonly":true}]','2026-05-13 03:06:18','group');
INSERT INTO container_configs VALUES('ag-1777255249928-wmdu63',NULL,NULL,NULL,NULL,'CLI Agent',NULL,'"all"','{}','[]','[]','[]','2026-05-11T01:02:02.911Z','group');
INSERT INTO container_configs VALUES('ag-1777601813158-ualv4y',NULL,NULL,NULL,NULL,'CRM',NULL,'"all"','{}','[]','[]','[]','2026-05-11T01:02:02.911Z','group');
INSERT INTO container_configs VALUES('ag-1777607105027-isi0rv',NULL,NULL,NULL,NULL,'clientmate',NULL,'"all"','{}','[]','[]','[]','2026-05-11T01:02:02.911Z','group');
INSERT INTO container_configs VALUES('ag-1777429951298-sb2cr5','claude',NULL,NULL,NULL,NULL,NULL,'"all"','{}','[]','[]','[{"hostPath":"/home/admin/Agents/janet-v2/groups/marketingteam/wiki","containerPath":"team-wiki","readonly":true}]','2026-05-13 03:06:18','group');
INSERT INTO container_configs VALUES('ag-1777257359331-63ti7x',NULL,NULL,NULL,NULL,'Janet',NULL,'"all"','{"figma":{"command":"/bin/sh","args":["-c","test -n \"$FIGMA_API_KEY\" || { echo ''figma MCP: FIGMA_API_KEY not set on host (.env)'' >&2; exit 1; }; unset HTTPS_PROXY HTTP_PROXY https_proxy http_proxy; exec figma-developer-mcp --figma-api-key=\"$FIGMA_API_KEY\" --stdio"],"env":{}}}','[]','[]','[{"hostPath":"~/nanoclaw-secrets/wordpress","containerPath":"wordpress-creds","readonly":true}]','2026-05-11T01:02:02.911Z','group');
INSERT INTO container_configs VALUES('ag-1778215787818-bncghq',NULL,NULL,NULL,'nanoclaw-agent-v2-8aa0b4e2:ag-1778215787818-bncghq','Janet',NULL,'"all"','{}','["poppler-utils"]','[]','[{"hostPath":"~/nanoclaw-secrets/wordpress","containerPath":"wordpress-creds","readonly":true}]','2026-05-11T01:10:52.148Z','group');
INSERT INTO container_configs VALUES('ag-1777429834314-u4riyu',NULL,'claude-opus-4-8',NULL,NULL,'Marketing Team',NULL,'"all"','{}','[]','["google-ads-node@^23.0.0"]','[]','2026-06-03T00:18:14.389Z','group');
INSERT INTO container_configs VALUES('ag-1778203406039-nhnh92',NULL,NULL,NULL,NULL,'Project Management Team',NULL,'"all"','{}','[]','[]','[]','2026-05-11T01:02:02.912Z','group');
INSERT INTO container_configs VALUES('ag-1777429952193-oeprs7','claude',NULL,NULL,NULL,NULL,NULL,'"all"','{}','[]','[]','[{"hostPath":"/home/admin/Agents/janet-v2/groups/marketingteam/wiki","containerPath":"team-wiki","readonly":true}]','2026-05-13 03:06:18','group');
INSERT INTO container_configs VALUES('ag-1778549688239-0u5g1v',NULL,NULL,NULL,NULL,NULL,NULL,'"all"','{}','[]','[]','[]','2026-05-12T01:34:48.240Z','group');
INSERT INTO container_configs VALUES('ag-1780365571870-gslxpq',NULL,NULL,NULL,NULL,NULL,NULL,'"all"','{}','[]','[]','[]','2026-06-02T01:59:31.871Z','group');
INSERT INTO container_configs VALUES('d7dfb3be-2eef-41ce-b7ac-42156ab8ae31',NULL,NULL,NULL,NULL,NULL,NULL,'"all"','{}','[]','[]','[{"hostPath":"/home/admin/Agents/janet-v2/groups/carpet-one/wiki","containerPath":"team-wiki","readonly":true}]','2026-06-02T02:14:15.088Z','group');
INSERT INTO container_configs VALUES('7c2ec039-1d69-4b74-b814-e0af577b8479',NULL,NULL,NULL,NULL,NULL,NULL,'"all"','{}','[]','[]','[{"hostPath":"/home/admin/Agents/janet-v2/groups/carpet-one/wiki","containerPath":"team-wiki","readonly":true}]','2026-06-02T02:26:57.170Z','group');
COMMIT;
PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS "messaging_groups" (
        id                    TEXT PRIMARY KEY,
        channel_type          TEXT NOT NULL,
        platform_id           TEXT NOT NULL,
        instance              TEXT NOT NULL,
        name                  TEXT,
        is_group              INTEGER DEFAULT 0,
        unknown_sender_policy TEXT NOT NULL DEFAULT 'strict',
        created_at            TEXT NOT NULL,
        denied_at             TEXT,
        UNIQUE(channel_type, platform_id, instance)
      );
INSERT INTO messaging_groups VALUES('mg-1777255249930-a6z6ke','cli','local','cli','Local CLI',0,'public','2026-04-27T02:00:49.927Z',NULL);
INSERT INTO messaging_groups VALUES('mg-1777601737339-kdt2fr','telegram','telegram:-5116329515','telegram','CRM',1,'request_approval','2026-05-01T02:15:37.339Z',NULL);
INSERT INTO messaging_groups VALUES('mg-1777607057297-8k2t6h','telegram','telegram:-5293085842','telegram','clientmate',1,'request_approval','2026-05-01T03:44:17.297Z',NULL);
INSERT INTO messaging_groups VALUES('mg-1777957394563-jfn9s6','slack','slack:D0B16TLGLJ3','slack',NULL,0,'request_approval','2026-05-05T05:03:14.563Z',NULL);
INSERT INTO messaging_groups VALUES('mg-1777957905683-uxjv20','slack','slack:C0B1LB9T26A','slack','marketing-team',1,'request_approval','2026-05-05T05:11:45.683Z',NULL);
INSERT INTO messaging_groups VALUES('mg-1778202109644-wu0hza','slack','slack:C0B2E8Z2HQA','slack','project-management-team',1,'request_approval','2026-05-08T01:01:49.644Z',NULL);
INSERT INTO messaging_groups VALUES('mg-1778215735145-qty9u2','slack','slack:D0B1JV7GJH3','slack',NULL,0,'request_approval','2026-05-08T04:48:55.145Z',NULL);
INSERT INTO messaging_groups VALUES('mg-1778547686046-hy2q7l','slack','slack:D0B1RV7NJ0L','slack',NULL,0,'request_approval','2026-05-12T01:01:26.046Z',NULL);
INSERT INTO messaging_groups VALUES('mg-1780365571872-l6rq6u','slack','slack:C0B7H7DLR5K','slack','Carpet One',1,'strict','2026-06-02T01:59:31.872Z',NULL);
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
INSERT INTO messaging_group_agents VALUES('mga-1777601813160-ew67xa','mg-1777601737339-kdt2fr','ag-1777601813158-ualv4y','shared',0,'2026-05-01T02:16:53.158Z','mention',NULL,'all','drop');
INSERT INTO messaging_group_agents VALUES('mga-1777607105029-5wpulm','mg-1777607057297-8k2t6h','ag-1777607105027-isi0rv','shared',0,'2026-05-01T03:45:05.026Z','pattern','.','all','drop');
INSERT INTO messaging_group_agents VALUES('mga-1777957537561-m0w5f7','mg-1777957394563-jfn9s6','ag-1777257359331-63ti7x','shared',0,'2026-05-05T05:05:37.561Z','mention-sticky',NULL,'known','accumulate');
INSERT INTO messaging_group_agents VALUES('mga-1777957915682-2rumxc','mg-1777957905683-uxjv20','ag-1777429834314-u4riyu','shared',0,'2026-05-05T05:11:55.682Z','mention-sticky',NULL,'known','accumulate');
INSERT INTO messaging_group_agents VALUES('mga-1778203406041-z7d4na','mg-1778202109644-wu0hza','ag-1778203406039-nhnh92','shared',0,'2026-05-08T01:23:26.039Z','pattern','.','known','accumulate');
INSERT INTO messaging_group_agents VALUES('mga-1778215787819-hb9nsg','mg-1778215735145-qty9u2','ag-1778215787818-bncghq','shared',0,'2026-05-08T04:49:47.820Z','mention-sticky',NULL,'known','accumulate');
INSERT INTO messaging_group_agents VALUES('mga-1778549688241-yeuk3e','mg-1778547686046-hy2q7l','ag-1778549688239-0u5g1v','shared',0,'2026-05-12T01:34:48.241Z','mention-sticky',NULL,'known','accumulate');
INSERT INTO messaging_group_agents VALUES('mga-1780365571872-gwuqaq','mg-1780365571872-l6rq6u','ag-1780365571870-gslxpq','shared',0,'2026-06-02T01:59:31.872Z','mention',NULL,'all','drop');
COMMIT;
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
INSERT INTO users VALUES('slack:UAMCT083F','slack','Raels','2026-05-08T03:32:02.578Z');
INSERT INTO users VALUES('slack:U3P7QK926','slack','Tracey','2026-05-12T01:01:26.045Z');
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
INSERT INTO user_roles VALUES('slack:U0AD5J35TFA','owner',NULL,'slack:U0AD5J35TFA','2026-05-08T01:10:55.000Z');
INSERT INTO user_roles VALUES('slack:UAMCT083F','owner',NULL,'slack:U0AD5J35TFA','2026-05-08T01:10:54.000Z');
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
INSERT INTO agent_group_members VALUES('slack:U0AD5J35TFA','ag-1778203406039-nhnh92','slack:U0AD5J35TFA','2026-05-08T01:23:26.039Z');
INSERT INTO agent_group_members VALUES('slack:UAMCT083F','ag-1778203406039-nhnh92','slack:U0AD5J35TFA','2026-05-08T03:40:19.851Z');
INSERT INTO agent_group_members VALUES('slack:UAMCT083F','ag-1778215787818-bncghq','slack:U0AD5J35TFA','2026-05-08T04:49:47.821Z');
INSERT INTO agent_group_members VALUES('slack:U3P7QK926','ag-1778549688239-0u5g1v','slack:U0AD5J35TFA','2026-05-12T01:34:48.242Z');
INSERT INTO agent_group_members VALUES('slack:U3P7QK926','ag-1778203406039-nhnh92','slack:U0AD5J35TFA','2026-05-12T04:11:06.691Z');
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
INSERT INTO user_dms VALUES('slack:U0AD5J35TFA','slack','mg-1777957394563-jfn9s6','2026-05-08T01:10:55.000Z');
COMMIT;
COMMIT;
