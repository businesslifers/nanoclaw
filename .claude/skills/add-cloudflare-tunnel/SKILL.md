---
name: add-cloudflare-tunnel
description: Expose a local NanoClaw service publicly via Cloudflare Tunnel with Cloudflare Access authentication. Use when the user wants to make the dashboard, a wiki, or any local service accessible from the internet without opening firewall ports. Triggers on "expose publicly", "cloudflare tunnel", "public access", "share dashboard", "external access", "access from outside", "without tailscale", or "without VPN".
---

# Add Cloudflare Tunnel

Expose a local NanoClaw service (dashboard, wiki, or any HTTP service) to the internet via Cloudflare Tunnel, protected by Cloudflare Access email-based authentication. No inbound ports are opened — the tunnel is outbound-only.

## Prerequisites

- A Cloudflare account (free tier is sufficient)
- A domain with DNS managed by Cloudflare (nameservers pointed to Cloudflare)
- The local service must be running and accessible on localhost

## Phase 1: Gather Information

Ask the user these questions using AskUserQuestion:

1. **What service are you exposing?** (dashboard, wiki, custom HTTP service)
2. **What local port is it running on?** (e.g. 3200 for the dashboard — check `.env` for `DASHBOARD_PORT` if it's the dashboard)
3. **What subdomain and domain do you want?** (e.g. `dashboard.example.com`)

## Phase 2: Check Existing Tunnel State

### Is cloudflared installed?

```bash
which cloudflared && cloudflared --version
```

If not installed, the user needs to install it. Provide the appropriate command for their platform:

**Debian/Ubuntu:**
```bash
curl -L --output /tmp/cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i /tmp/cloudflared.deb
```

**macOS:**
```bash
brew install cloudflare/cloudflare/cloudflared
```

If `sudo` is unavailable in the current session, ask the user to run the install command themselves.

### Is cloudflared authenticated?

```bash
ls ~/.cloudflared/cert.pem 2>/dev/null && echo "Authenticated" || echo "Not authenticated"
```

If not authenticated, run:
```bash
cloudflared tunnel login
```

This prints a URL. Tell the user to open it in their browser and authorize with their Cloudflare account. They need to select the domain they want to use for the tunnel.

### Does a tunnel already exist?

```bash
cloudflared tunnel list
```

If a tunnel already exists, **reuse it** — just add a new ingress rule (skip to Phase 3b). If no tunnel exists, proceed to Phase 3a.

## Phase 3a: Create a New Tunnel

```bash
cloudflared tunnel create nanoclaw
```

This creates credentials at `~/.cloudflared/<TUNNEL_ID>.json`. Note the tunnel ID from the output.

Create the initial config:

```yaml
# ~/.cloudflared/config.yml
tunnel: <TUNNEL_ID>
credentials-file: /home/<user>/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: <subdomain>.<domain>
    service: http://localhost:<port>
  - service: http_status:404
```

The catch-all `http_status:404` rule at the end is required by cloudflared.

Then create the DNS record:

```bash
cloudflared tunnel route dns nanoclaw <subdomain>.<domain>
```

Skip to Phase 4.

## Phase 3b: Add Route to Existing Tunnel

Read the existing config:

```bash
cat ~/.cloudflared/config.yml
```

Add a new ingress rule **before** the catch-all `http_status:404` rule:

```yaml
  - hostname: <subdomain>.<domain>
    service: http://localhost:<port>
```

The catch-all must always be last.

Create the DNS record:

```bash
cloudflared tunnel route dns <tunnel-name> <subdomain>.<domain>
```

Restart the tunnel service to pick up the new route:

```bash
systemctl --user restart cloudflared
```

## Phase 4: Set Up Systemd Service

Check if a cloudflared service already exists:

```bash
systemctl --user status cloudflared 2>&1 | head -3
```

If it's already running (from a previous invocation of this skill), restart it to pick up config changes:

```bash
systemctl --user restart cloudflared
```

If no service exists, create one:

```ini
# ~/.config/systemd/user/cloudflared.service
[Unit]
Description=Cloudflare Tunnel for NanoClaw
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/local/bin/cloudflared tunnel run <tunnel-name>
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
```

Replace `<tunnel-name>` with the actual tunnel name (e.g. `nanoclaw`). Adjust the `cloudflared` path if it's installed elsewhere (`which cloudflared`).

Enable and start:

```bash
systemctl --user daemon-reload
systemctl --user enable cloudflared
systemctl --user start cloudflared
```

## Phase 5: Verify

Test that the tunnel is serving the service:

```bash
sleep 5
curl -s -o /dev/null -w "%{http_code}" https://<subdomain>.<domain>/
```

Should return `200` (or `302` if Cloudflare Access is already configured). If it fails, check:

```bash
systemctl --user status cloudflared
journalctl --user -u cloudflared --no-pager -n 20
```

## Phase 6: Set Up Cloudflare Access (Authentication)

This step locks the service behind email-based authentication so only authorized users can access it.

Guide the user through the Cloudflare Zero Trust dashboard:

1. Go to **https://one.dash.cloudflare.com** (Cloudflare Zero Trust)
2. If this is the first time, they'll be asked to choose a team name — any short identifier works (e.g. company name)
3. Navigate to **Access > Applications > Add an Application**
4. Choose **Self-hosted**
5. Configure:
   - **Application name:** A descriptive name (e.g. "NanoClaw Dashboard")
   - **Session Duration:** 24 hours
   - **Add public hostname:** Enter the subdomain and select the domain
6. **Create an Access policy:**
   - **Policy name:** e.g. "Allowed Users"
   - **Action:** Allow
   - **Include rule:** Selector = "Emails", add each authorized email address
7. Click through the remaining screens (Experience settings, Advanced settings) — defaults are fine
8. **Save** the application

After saving, test by opening the URL in an incognito/private browser window. The user should see a Cloudflare login page requesting their email, followed by a one-time code.

## Summary

After completion, confirm to the user:

- **URL:** `https://<subdomain>.<domain>`
- **Authentication:** Cloudflare Access (email OTP for authorized users)
- **Service:** systemd user service (`systemctl --user start/stop/restart cloudflared`)
- **Config:** `~/.cloudflared/config.yml`
- **To add more services later:** Run this skill again — it will reuse the existing tunnel and just add a new route

## Security Notes

- No inbound firewall ports are opened — the tunnel is outbound-only
- Cloudflare Access handles authentication at the edge — requests never reach the service without valid auth
- Access policies are per-hostname, so different services can have different authorized users
- The tunnel credentials file (`~/.cloudflared/<ID>.json`) is sensitive — it should not be committed to git or shared
