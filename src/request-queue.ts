import fs from 'fs';
import path from 'path';

import { QueuedRequest } from './db.js';
import { resolveGroupIpcPath } from './group-folder.js';

export type { QueuedRequest } from './db.js';

/**
 * Write the request queue snapshot for a container to read.
 * Main sees all requests; non-main sees only their own.
 */
export function writeRequestsSnapshot(
  groupFolder: string,
  isMain: boolean,
  requests: QueuedRequest[],
): void {
  const groupIpcDir = resolveGroupIpcPath(groupFolder);
  fs.mkdirSync(groupIpcDir, { recursive: true });

  const filtered = isMain
    ? requests
    : requests.filter((r) => r.requester_folder === groupFolder);

  const file = path.join(groupIpcDir, 'current_requests.json');
  fs.writeFileSync(file, JSON.stringify(filtered, null, 2));
}
