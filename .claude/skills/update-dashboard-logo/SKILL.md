---
name: update-dashboard-logo
description: Re-bake the Dashboard Pro patch with a new sidebar logo / favicon and reapply it. Use when /add-dashboard-pro is already installed and the operator wants to change the logo without re-running the full install (which would fail the existing-patch preflight). Drop a new file at the install root (`dashboard-logo.svg` / `.png` / `.webp` / `.jpg`) or set `DASHBOARD_LOGO_PATH=path/to/file`, then run this skill.
---

# /update-dashboard-logo — change the Dashboard Pro logo without reinstalling

The Dashboard Pro logo and favicon are inlined as a base64 data URL inside `patches/@nanoco__nanoclaw-dashboard@0.3.0.patch`. To change them, the patch must be regenerated and re-applied. Re-running `/add-dashboard-pro` does not work for this — its preflight refuses to overwrite an existing patch — so this skill exists to do the in-place update.

## Phase 0: Preflight

```bash
problems=()
[ -f pnpm-workspace.yaml ] || problems+=("Not at the install root (no pnpm-workspace.yaml)")
[ -f patches/@nanoco__nanoclaw-dashboard@0.3.0.patch ] \
  || problems+=("Dashboard Pro patch missing — run /add-dashboard-pro first")
[ -f .claude/skills/add-dashboard-pro/resources/rebake-dashboard-logo.sh ] \
  || problems+=("Re-bake helper missing — run /update-private-skills to refresh /add-dashboard-pro")
[ -f .claude/skills/add-dashboard-pro/resources/dashboard-customizations.patch ] \
  || problems+=("Source patch missing in /add-dashboard-pro resources — run /update-private-skills")
if [ ${#problems[@]} -gt 0 ]; then
  printf 'PRECONDITION FAILED:\n'; printf '  - %s\n' "${problems[@]}"
  exit 1
fi
echo 'Preconditions OK.'
```

## Phase 1: Choose a logo

The helper resolves the logo source in this order:

1. `DASHBOARD_LOGO_PATH` env var (explicit override)
2. `dashboard-logo.{svg,png,webp,jpg,jpeg}` at the install root (auto-detected, first match wins)
3. The default NanoClaw icon (used when neither is set — selecting this clears any prior custom logo)

The sidebar slot is 80×80 px, so square assets render best. SVG is recommended (sharp at any size + small payload).

Drop the new logo at the install root (or update the env var) before continuing. To revert to the default NanoClaw icon, delete or rename your `dashboard-logo.*` and unset `DASHBOARD_LOGO_PATH`.

## Phase 2: Re-bake and reapply

```bash
bash .claude/skills/add-dashboard-pro/resources/rebake-dashboard-logo.sh

pnpm install         # re-applies the regenerated patch into node_modules
pnpm run build
```

`pnpm install` notices the patch file changed and re-applies it to the dashboard package. The host code is unchanged, so `pnpm run build` is fast — it's only there to keep the build artifact consistent.

## Phase 3: Restart and verify

```bash
# Linux (systemd) — restart this install's unit:
for u in $(systemctl --user list-unit-files --no-legend 'nanoclaw-v2-*.service' | awk '{print $1}'); do
  systemctl --user cat "$u" | grep -q "WorkingDirectory=$PWD" && systemctl --user restart "$u" && break
done

# macOS (launchd):
# launchctl kickstart -k gui/$(id -u)/com.nanoclaw
```

Open the dashboard. The sidebar logo (top of the left nav, above "Dashboard Pro") and the browser favicon should now show the new image. The favicon is often aggressively cached by the browser — hard-reload (Cmd-Shift-R / Ctrl-Shift-R) if it looks unchanged.

## Reproducibility

`patches/@nanoco__nanoclaw-dashboard@0.3.0.patch` is regenerated each run; commit it (and your `dashboard-logo.*` source file, if you keep one in-repo) so future installs from a clean clone produce the same dashboard.

## Rollback

To revert to the default NanoClaw icon:

```bash
rm -f dashboard-logo.svg dashboard-logo.png dashboard-logo.webp dashboard-logo.jpg dashboard-logo.jpeg
unset DASHBOARD_LOGO_PATH
bash .claude/skills/add-dashboard-pro/resources/rebake-dashboard-logo.sh
pnpm install && pnpm run build
# then restart the service as in Phase 3
```

## Updating

Distributed via the `private` remote on branch `skill/update-dashboard-logo`. Re-run `/update-private-skills` to pull updates.
