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
COMMIT;
