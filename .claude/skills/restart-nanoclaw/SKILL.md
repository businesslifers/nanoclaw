# Restart NanoClaw

Restart the NanoClaw service. Detects the service manager and runs the right command.

## Output style

- Do NOT add commentary between steps — let the tool output speak for itself.
- After verification, print a single summary line in this format:
  ```
  NanoClaw restarted (PID XXXXX) — WhatsApp connected, Telegram connected
  ```
  List only the channels that appear in the log. If a channel didn't connect, say so.

## Steps

1. **Build** (picks up any code changes). Source nvm first since non-interactive shells don't load it automatically:
   ```bash
   export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && npm run build
   ```

2. **Detect and restart** — run detection and the matching restart command back-to-back in a single bash call. Use the first match in priority order: pm2 (by instance name), nohup wrapper, systemd user, systemd system, launchd. The instance name is the basename of the project directory (e.g., `derek`).

   ```bash
   INSTANCE=$(basename "$PWD")
   if npx pm2 pid "$INSTANCE" 2>/dev/null | grep -qE '^[0-9]+$'; then
     npx pm2 restart "$INSTANCE" && echo "Restarted via pm2 ($INSTANCE)"
   elif test -f start-nanoclaw.sh; then
     bash start-nanoclaw.sh
   elif systemctl --user list-unit-files nanoclaw.service 2>/dev/null | grep -q nanoclaw; then
     systemctl --user restart nanoclaw && echo "Restarted via systemd (user)"
   elif systemctl list-unit-files nanoclaw.service 2>/dev/null | grep -q nanoclaw; then
     sudo systemctl restart nanoclaw && echo "Restarted via systemd (system)"
   elif launchctl list 2>/dev/null | grep -q nanoclaw; then
     launchctl kickstart -k "gui/$(id -u)/com.nanoclaw" && echo "Restarted via launchd"
   else
     echo "ERROR: No service manager found" >&2 && exit 1
   fi
   ```

3. **Verify** — poll the log for channel connection lines (up to 45s). WhatsApp typically takes 30-40s due to session conflict cycling (440 errors are normal). Run this as a **single bash call**:
   ```bash
   PID=$(pgrep -f "node.*$PWD/dist/index" | head -1)
   for i in $(seq 1 45); do
     sleep 1
     # Check for both channels in logs from this PID only
     WA=$(grep -c "Connected to WhatsApp" logs/nanoclaw.log 2>/dev/null | tail -1)
     TG=$(grep -c "Telegram bot connected" logs/nanoclaw.log 2>/dev/null | tail -1)
     # WhatsApp connects multiple times during conflict cycle; consider stable
     # once we also see "NanoClaw running" (startup complete)
     RUNNING=$(grep "$PID" logs/nanoclaw.log 2>/dev/null | grep -c "NanoClaw running")
     if [ "$RUNNING" -ge 1 ] && { [ "$WA" -ge 1 ] || [ "$TG" -ge 1 ]; }; then
       # Wait 2 more seconds for both channels to finish connecting
       sleep 2
       break
     fi
   done
   echo "---"
   grep -E "($PID).*(Connected to WhatsApp|Telegram bot connected|NanoClaw running|ERROR)" logs/nanoclaw.log | tail -5 | sed 's/\x1b\[[0-9;]*m//g'
   ```
   Do NOT run additional bash calls to re-check — this single loop handles the full wait.

4. If the loop times out (45s) without connection lines, show the last 20 lines of `logs/nanoclaw.error.log` and `logs/nanoclaw.log`.
