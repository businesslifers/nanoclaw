# Remove codegraph

Every step is idempotent — safe to run even if some steps were never applied.

## 1. Un-wire any groups (do this first, before removing the binary)

For each group you wired, drop the `codegraph` entry from its MCP config and delete the index:

```bash
GID=$(pnpm exec tsx scripts/q.ts data/v2.db "SELECT id FROM agent_groups WHERE folder='<GROUP>'")
pnpm exec tsx -e '
import { initDb } from "./src/db/connection";
import { getContainerConfig, updateContainerConfigJson } from "./src/db/container-configs";
initDb("data/v2.db");
const gid = process.argv[1];
const servers = JSON.parse(getContainerConfig(gid).mcp_servers || "{}");
delete servers.codegraph;
updateContainerConfigJson(gid, "mcp_servers", servers);
console.log("un-wired codegraph for", gid);
' "$GID"
pnpm exec tsx src/cli/client.ts groups restart --id "$GID"
rm -rf groups/<GROUP>/.codegraph
```

To find every wired group:

```bash
pnpm exec tsx scripts/q.ts data/v2.db \
  "SELECT agent_group_id FROM container_configs WHERE mcp_servers LIKE '%codegraph%'"
```

## 2. Strip the Dockerfile install layer

Open `container/Dockerfile` and delete the `codegraph` block (the `# codegraph — code-intelligence MCP server` comment and its `RUN` that downloads + extracts the tarball), plus the `ARG CODEGRAPH_VERSION=...` line in the pinned-ARG block near the top. If they're already gone, skip.

## 3. Delete the copied test

```bash
rm -f src/codegraph-dockerfile.test.ts
```

## 4. Rebuild and restart

```bash
docker builder prune -f && ./container/build.sh
source setup/lib/install-slug.sh
systemctl --user restart $(systemd_unit)              # Linux
# launchctl kickstart -k gui/$(id -u)/$(launchd_label)   # macOS
```

The image bump only matters for groups that haven't respawned yet; running containers keep their current image until they next start.
