#!/usr/bin/env bash
# Re-bake the Dashboard Pro patch with the current logo override.
#
# Detection order:
#   1. DASHBOARD_LOGO_PATH env var
#   2. dashboard-logo.{svg,png,webp,jpg,jpeg} at the install root
#   3. (fallback) the default NanoClaw icon already in the source patch
#
# Reads:  .claude/skills/add-dashboard-pro/resources/dashboard-customizations.patch
# Writes: patches/@nanoco__nanoclaw-dashboard@0.3.0.patch
#
# Run from the install root. After this, run `pnpm install && pnpm run build`
# and restart the service so the new layout is picked up.

set -euo pipefail

[ -f pnpm-workspace.yaml ] || {
  echo "Run from the install root (where pnpm-workspace.yaml lives)." >&2
  exit 1
}

SRC=.claude/skills/add-dashboard-pro/resources/dashboard-customizations.patch
DST=patches/@nanoco__nanoclaw-dashboard@0.3.0.patch
[ -f "$SRC" ] || { echo "Source patch missing: $SRC (is /add-dashboard-pro installed?)" >&2; exit 1; }

LOGO_PATH="${DASHBOARD_LOGO_PATH:-}"
if [ -z "$LOGO_PATH" ]; then
  for ext in svg png webp jpg jpeg; do
    if [ -f "dashboard-logo.$ext" ]; then
      LOGO_PATH="dashboard-logo.$ext"
      break
    fi
  done
fi

mkdir -p patches

if [ -n "$LOGO_PATH" ]; then
  [ -f "$LOGO_PATH" ] || { echo "Logo file not found: $LOGO_PATH" >&2; exit 1; }
  LOGO_PATH="$LOGO_PATH" SRC="$SRC" DST="$DST" node -e '
    const fs = require("fs");
    const path = require("path");
    const ext = path.extname(process.env.LOGO_PATH).toLowerCase();
    const mime = {
      ".svg": "image/svg+xml",
      ".png": "image/png",
      ".webp": "image/webp",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
    }[ext];
    if (!mime) { console.error("Unsupported logo format: " + ext); process.exit(1); }
    const data = fs.readFileSync(process.env.LOGO_PATH).toString("base64");
    const url = `data:${mime};base64,${data}`;
    const src = fs.readFileSync(process.env.SRC, "utf8");
    let n = 0;
    const out = src.replace(/(NANOCLAW_ICON_DATA_URL = \x27)data:[^\x27]+/, (_, p) => { n++; return p + url; });
    if (n !== 1) { console.error("expected 1 NANOCLAW_ICON_DATA_URL match in source patch, got " + n); process.exit(1); }
    fs.writeFileSync(process.env.DST, out);
    console.log("Baked custom logo from " + process.env.LOGO_PATH + " into " + process.env.DST);
  '
else
  cp "$SRC" "$DST"
  echo "No custom logo found — wrote default NanoClaw icon to $DST"
fi
