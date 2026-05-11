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
COMMIT;
