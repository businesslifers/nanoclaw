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
