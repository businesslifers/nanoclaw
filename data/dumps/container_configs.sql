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
