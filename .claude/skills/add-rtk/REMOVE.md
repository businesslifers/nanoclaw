# Remove rtk

Idempotent — safe to run even if some steps were never applied. rtk on this fork is the agent image's baked binary plus a per-group `PreToolUse` hook (see SKILL.md). Disabling it for a group is just removing the hook; fully uninstalling also strips the binary from the image.

## 1. Remove the PreToolUse hook from settings.json (per group)

Run once per group that had rtk wired (`ncl groups list`). Deletes the rtk Bash hook, leaving any other `PreToolUse` entries intact:

```bash
SETTINGS="data/v2-sessions/<group-id>/.claude-shared/settings.json"

jq '.hooks.PreToolUse = ((.hooks.PreToolUse // [])
      | map(select((.hooks // []) | any(.command == "rtk hook claude") | not)))' \
  "$SETTINGS" > /tmp/rtk-settings.json && mv /tmp/rtk-settings.json "$SETTINGS"
```

## 2. Strip any legacy rtk mount (cleanup from the old skill version)

Older installs of this skill wrote a (rejected, non-functional) rtk entry into `additional_mounts`. Remove it from every group in one pass:

```bash
pnpm exec tsx scripts/fix-rtk-mounts.ts --apply   # drops any {"containerPath":"/usr/local/bin/rtk"} entry
```

(If `scripts/fix-rtk-mounts.ts` isn't present, query each group's `additional_mounts` and write back the array with the rtk entry removed, or use the host-only, operator-enforced verb for a single group instead — rejected from inside a container:)

```bash
ncl groups config remove-mount --id <group-id> \
  --host ~/.local/bin/rtk \
  --container /usr/local/bin/rtk
```

## 3. Restart affected groups

```bash
ncl groups restart --id <group-id>
```

## 4. Remove the binary from the image (optional — full uninstall)

If no group uses rtk anymore, drop it from `container/Dockerfile`: delete the `ARG RTK_VERSION` line and the rtk `RUN` block (after the `gh` install), then rebuild:

```bash
./container/build.sh
```

## 5. Remove the host binary (optional)

Only if rtk was also installed on the host and you don't use it there:

```bash
rm -f ~/.local/bin/rtk
```
