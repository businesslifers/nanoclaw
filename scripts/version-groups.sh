#!/usr/bin/env bash
# version-groups.sh — Auto-commit group config file changes
# Runs via cron every 5 minutes. Only commits text config files under groups/.
set -uo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# Safety: only commit on main branch
BRANCH=$(git branch --show-current 2>/dev/null || true)
[ "$BRANCH" != "main" ] && exit 0

# Safety: abort if another git operation is in progress
[ -f .git/index.lock ] && exit 0

# Collect changed and new text files under groups/ (exclude binaries)
FILES=()
while IFS= read -r f; do
  [ -z "$f" ] && continue
  case "$f" in
    *.jpg|*.jpeg|*.png|*.gif|*.webp|*.mp4|*.mp3|*.ogg|*.pdf|*.zip|*.tar*) continue ;;
  esac
  FILES+=("$f")
done < <(
  { git diff --name-only -- groups/ 2>/dev/null; git ls-files --others --exclude-standard -- groups/ 2>/dev/null; } | sort -u
)

[ ${#FILES[@]} -eq 0 ] && exit 0

# Build commit message from group names and filenames
# Note: avoid "GROUPS" — it's a bash builtin (readonly array of user group IDs)
CHANGED_GROUPS=$(printf '%s\n' "${FILES[@]}" | sed 's|groups/\([^/]*\)/.*|\1|' | sort -u | paste -sd,)
CHANGED_FILES=$(printf '%s\n' "${FILES[@]}" | sed 's|.*/||' | sort -u | paste -sd,)

# Stage and commit
git add -- "${FILES[@]}"
# --no-verify: skip pre-commit hooks (prettier targets *.ts, not group configs)
git commit --no-verify -m "auto(groups): ${CHANGED_GROUPS} - ${CHANGED_FILES}"
