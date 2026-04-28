#!/usr/bin/env bash
#
# Status line for janet-v2.
# Format:
#   janet-v2 | <version> (<branch>) | Janet: <Up|Down> | <ctx%> | <model> (<ctx-size>) | <last push>
#
# Reads Claude Code session JSON on stdin; runs git + service checks for the rest.

set -u
INPUT=$(cat)

# -- working dir from session, falls back to script location --
PROJECT_DIR=$(printf '%s' "$INPUT" | jq -r '.workspace.project_dir // .workspace.current_dir // .cwd // empty')
if [ -z "$PROJECT_DIR" ] || [ ! -d "$PROJECT_DIR" ]; then
  PROJECT_DIR=$(cd "$(dirname "$0")/.." && pwd)
fi

# -- nanoclaw version --
VERSION=$(node -p "require('$PROJECT_DIR/package.json').version" 2>/dev/null || echo "?")

# -- current branch --
BRANCH=$(git -C "$PROJECT_DIR" branch --show-current 2>/dev/null)
[ -z "$BRANCH" ] && BRANCH="?"

# -- janet service status (cross-platform: systemd / launchd / process fallback) --
janet_status() {
  if command -v systemctl >/dev/null 2>&1; then
    local svc
    svc=$(systemctl --user list-units --type=service --no-pager --no-legend 'nanoclaw-v2-*.service' 2>/dev/null | awk 'NR==1{print $1}')
    if [ -n "$svc" ] && systemctl --user is-active "$svc" >/dev/null 2>&1; then
      echo Up; return
    fi
  fi
  if command -v launchctl >/dev/null 2>&1 && launchctl list 2>/dev/null | grep -q nanoclaw; then
    echo Up; return
  fi
  if pgrep -f 'janet-v2/dist/index\.js' >/dev/null 2>&1; then
    echo Up; return
  fi
  echo Down
}
JANET=$(janet_status)

# -- context % remaining --
# Look for any of the field paths Claude Code may pass; otherwise fall back.
USED=$(printf '%s' "$INPUT" | jq -r '.context.used // .tokens.used // .usage.input_tokens // empty')
MAX=$(printf '%s' "$INPUT" | jq -r '.context.max // .tokens.max // empty')
if [ -n "$USED" ] && [ -n "$MAX" ] && [ "$MAX" -gt 0 ] 2>/dev/null; then
  CTX_PCT=$(( 100 - (USED * 100 / MAX) ))%
elif [ "$(printf '%s' "$INPUT" | jq -r '.exceeds_200k_tokens // false')" = "true" ]; then
  CTX_PCT="<low"
else
  CTX_PCT="?"
fi

# -- model + context window --
MODEL=$(printf '%s' "$INPUT" | jq -r '.model.display_name // .model.id // "?"')
MODEL_ID=$(printf '%s' "$INPUT" | jq -r '.model.id // ""')
case "$MODEL_ID" in
  *opus-4-7*1m*|*opus-4-7\[1m\]*) CTX_SIZE="1M" ;;
  *opus*1m*) CTX_SIZE="1M" ;;
  *sonnet*1m*) CTX_SIZE="1M" ;;
  *opus*|*sonnet*|*haiku*) CTX_SIZE="200K" ;;
  *) CTX_SIZE="?" ;;
esac

# -- last git push (relative time of latest commit on origin/main) --
LAST_PUSH=$(git -C "$PROJECT_DIR" log -1 --format=%cr origin/main 2>/dev/null)
[ -z "$LAST_PUSH" ] && LAST_PUSH="?"

printf 'janet-v2 | %s (%s) | Janet: %s | %s | %s (%s) | pushed %s\n' \
  "$VERSION" "$BRANCH" "$JANET" "$CTX_PCT" "$MODEL" "$CTX_SIZE" "$LAST_PUSH"
