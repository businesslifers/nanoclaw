---
name: add-wiki-viewer
description: Add a web-based wiki viewer for browsing NanoClaw group wikis in a browser. Renders markdown with sidebar navigation, YAML frontmatter display, and group switching. Use when the user wants to browse wikis in a browser, share wiki content externally, expose a wiki via the web, or view wiki pages outside of the terminal. Triggers on "wiki viewer", "browse wiki", "wiki in browser", "view wiki", "wiki web", "expose wiki", or "share wiki".
---

# Add Wiki Viewer

Add a lightweight web-based wiki viewer that renders any NanoClaw group's wiki as browsable HTML pages with sidebar navigation. Reads markdown files with YAML frontmatter directly from disk — changes made by agents are instantly visible.

## Prerequisites

- At least one group with a `wiki/` directory (set up via `/add-karpathy-llm-wiki`)
- Node.js (already present in any NanoClaw install)

## Phase 1: Pre-flight

### Check if already applied

```bash
test -f src/wiki-server.ts && echo "Already applied" || echo "Not applied"
```

If already applied, skip to Phase 3 (Configure).

## Phase 2: Apply Code Changes

### Ensure the skills remote

```bash
git remote -v
```

If the `skills` remote is missing, add it (use the appropriate remote URL for your installation).

### Merge the skill branch

```bash
git fetch skills skill/add-wiki-viewer
git merge skills/skill/add-wiki-viewer
```

If there are merge conflicts on `package-lock.json`:
```bash
git checkout --theirs package-lock.json
npm install
git add package-lock.json
git merge --continue
```

### Install dependencies

```bash
npm install marked gray-matter
```

### Build

```bash
npm run build
```

## Phase 3: Configure

### Set the wiki port

Add to `.env`:

```
WIKI_PORT=3201
```

Choose any available port. This is the port the wiki viewer will listen on.

### Wire into startup (if not already done by merge)

Check if `src/index.ts` imports and calls `startWikiServer()`. If not, add:

1. Import near the top:
```typescript
import { startWikiServer } from './wiki-server.js';
```

2. Call after the dashboard starts:
```typescript
startWikiServer();
```

### Restart NanoClaw

```bash
systemctl --user restart nanoclaw
```

Or however the user runs NanoClaw.

### Verify

```bash
# Check the server is listening
sleep 3
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3201/
```

Expected: `302` (redirect to first group wiki). Open `http://localhost:<WIKI_PORT>` in a browser to browse.

## Phase 4: Expose Publicly (Optional)

If the user wants to make the wiki accessible from the internet, use the `/add-cloudflare-tunnel` skill:

1. Run `/add-cloudflare-tunnel`
2. When asked for the service: wiki viewer
3. When asked for the port: the `WIKI_PORT` value from `.env`
4. When asked for the subdomain: user's choice (e.g. `wiki.example.com`)

This sets up a Cloudflare Tunnel route and Access policy for authentication.

## Features

- **Sidebar navigation** — Parsed from each group's `wiki/index.md`. Pages grouped by `## Section` headings.
- **Group switching** — Dropdown in the header lists all groups with wikis.
- **YAML frontmatter** — Rendered as metadata badges: tags, verdict (worth-exploring/not-now/pass), dates, source links.
- **Verdict indicators** — Sidebar shows emoji indicators for evaluated ideas (✅ ⏸️ ❌).
- **Dark theme** — Matches the NanoClaw dashboard visual style.
- **Live content** — Reads files from disk on each request. No build step — agent wiki updates are instantly visible.
- **Mobile responsive** — Sidebar hidden on small screens, content area fills the viewport.
- **Error resilient** — Request errors are caught and logged, never crash the process.

## URL Structure

```
/                              → Redirect to first group
/:folder                       → Group's wiki index page
/:folder/:page                 → Specific wiki page
/:folder/ideas/:page           → Idea page (from ideas/ subdirectory)
```

## Troubleshooting

**Wiki not starting:**
- Check `WIKI_PORT` is set in `.env`
- Check `journalctl --user -u nanoclaw` for errors
- Verify `startWikiServer()` is called in `src/index.ts`

**Page not found:**
- The URL path maps to `groups/<folder>/wiki/<page>.md`
- Check the file exists on disk
- Subdirectory pages use the path: `/folder/ideas/page-name` → `groups/folder/wiki/ideas/page-name.md`

**Sidebar empty:**
- The sidebar is parsed from `wiki/index.md` in the selected group
- It looks for `## Section` headings with `- [Title](file.md)` links underneath
- If index.md doesn't follow this format, the sidebar shows "No index.md found"
