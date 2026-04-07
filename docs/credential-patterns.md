# Credential Patterns for NanoClaw Groups

Two patterns exist for giving container agents access to credentials. Using the wrong one is the most common cause of new team setup failures.

## Pattern 1: Proxy-Injected (OneCLI)

**How it works:** The OneCLI gateway sits between the container and the internet. When the agent makes an HTTPS request to a matching host, OneCLI intercepts it and injects the credential as an HTTP header (usually `Authorization`).

**When to use:** Standard HTTP APIs where the client makes direct requests and the server expects a token/key in a header.

**Examples:** Anthropic API, Pexels, Unsplash, GitHub API, Gemini API, Parallel AI.

**Manifest entry:**
```json
{
  "name": "PEXELS_API_KEY",
  "type": "generic",
  "host_pattern": "api.pexels.com",
  "credential_access": "proxy"
}
```

**Agent code:** Just make HTTP requests normally — the header is injected transparently. The agent never sees the raw key.

## Pattern 2: File-Mounted

**How it works:** The credential file is placed on the host at `~/nanoclaw-secrets/{group}/`, which is bind-mounted into the container at `/workspace/extra/{name}/`. The agent reads the file directly at runtime.

**When to use:** Clients that need the raw key/credential to do their own auth (JWT signing, OAuth flows, SSH).

**Examples:**
- **Ghost Admin API** — client needs `id:secret` to generate JWTs locally
- **Google service accounts** — JSON key file loaded by `google-auth-library`
- **SSH keys** — used directly by SSH clients for server access

**Manifest entry:**
```json
{
  "path": "~/nanoclaw-secrets/insights/ghost-admin-api-key.txt",
  "description": "Ghost Admin API key (id:secret format)",
  "credential_access": "file",
  "container_path": "/workspace/extra/insights-creds/ghost-admin-api-key.txt"
}
```

**Agent code:**
```javascript
const key = fs.readFileSync('/workspace/extra/insights-creds/ghost-admin-api-key.txt', 'utf8').trim();
```

## How to Choose

| Question | If yes → |
|----------|----------|
| Does the client just make HTTP requests with an auth header? | Proxy |
| Does the client need the raw key to sign tokens (JWT, HMAC)? | File |
| Is it a JSON key file (Google, Firebase)? | File |
| Is it an SSH key? | File |
| Is it a simple API key sent as a header? | Proxy |

## Common Mistakes

### `process.env.SECRET_NAME` — does not work
OneCLI does not inject environment variables into containers. It intercepts HTTP traffic via a proxy. If the CLAUDE.md tells the agent to read `process.env.X`, the value will always be `undefined`.

### Using proxy for Ghost Admin API
The `@tryghost/admin-api` client needs the raw `id:secret` key to generate JWTs locally. OneCLI's proxy injects an `Authorization` header, but the client never makes a raw HTTP request with that header — it constructs its own JWT first. Use file-mount instead.

### Missing `host_pattern` on proxy secrets
OneCLI matches requests by hostname. A proxy secret without `host_pattern` will never be injected into any request. Always set `host_pattern` for proxy secrets.

### Forgetting the mount allowlist
Even if the mount is in the DB and the directory exists, `~/.config/nanoclaw/mount-allowlist.json` must permit the path. Check `allowedRoots` includes the parent directory.

## Validation

Run the pre-flight check after setting up a new team:

```bash
npx tsx scripts/validate-group.ts whatsapp_team-name
npx tsx scripts/validate-group.ts --all
```

This validates all credentials, mounts, and OneCLI configuration against the manifest.
