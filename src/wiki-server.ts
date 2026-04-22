import fs from 'fs';
import http from 'http';
import path from 'path';
import { marked } from 'marked';
import matter from 'gray-matter';

import { ASSISTANT_NAME, GROUPS_DIR } from './config.js';
import { readEnvFile } from './env.js';
import { logger } from './logger.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(s: unknown): string {
  const str = String(s ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Find all group folders that contain a wiki/ directory */
function discoverWikiGroups(): string[] {
  try {
    return fs
      .readdirSync(GROUPS_DIR)
      .filter((f) => {
        const wikiDir = path.join(GROUPS_DIR, f, 'wiki');
        return fs.existsSync(wikiDir) && fs.statSync(wikiDir).isDirectory();
      })
      .sort();
  } catch {
    return [];
  }
}

/** Read and parse a markdown file with frontmatter */
function readWikiPage(
  folder: string,
  pagePath: string,
): { html: string; data: Record<string, unknown>; raw: string } | null {
  const fullPath = path.join(GROUPS_DIR, folder, 'wiki', pagePath);
  // Prevent directory traversal
  const resolved = path.resolve(fullPath);
  const wikiRoot = path.resolve(path.join(GROUPS_DIR, folder, 'wiki'));
  if (!resolved.startsWith(wikiRoot)) return null;

  try {
    const content = fs.readFileSync(resolved, 'utf-8');
    const parsed = matter(content);
    const html = marked.parse(parsed.content, { async: false }) as string;
    return { html, data: parsed.data, raw: parsed.content };
  } catch {
    return null;
  }
}

/** Parse index.md to build sidebar sections */
function parseSidebar(folder: string): {
  label: string;
  items: { title: string; href: string; verdict?: string }[];
}[] {
  const indexPath = path.join(GROUPS_DIR, folder, 'wiki', 'index.md');
  try {
    const content = fs.readFileSync(indexPath, 'utf-8');
    const sections: {
      label: string;
      items: { title: string; href: string; verdict?: string }[];
    }[] = [];
    let current: {
      label: string;
      items: { title: string; href: string; verdict?: string }[];
    } | null = null;

    for (const line of content.split('\n')) {
      const sectionMatch = line.match(/^##\s+(.+)/);
      if (sectionMatch) {
        current = { label: sectionMatch[1].trim(), items: [] };
        sections.push(current);
        continue;
      }
      if (!current) continue;
      // Match markdown links: - [Title](path.md) — description
      const linkMatch = line.match(/^\s*-\s+\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch) {
        const title = linkMatch[1];
        const filePath = linkMatch[2].replace(/\.md$/, '');
        const href = `/${encodeURIComponent(folder)}/${filePath}`;
        // Detect verdict from the line text
        let verdict: string | undefined;
        if (
          line.includes('✅') ||
          line.toLowerCase().includes('worth exploring')
        )
          verdict = 'pass';
        else if (
          line.includes('⏸️') ||
          line.toLowerCase().includes('not now') ||
          line.toLowerCase().includes('interesting but')
        )
          verdict = 'maybe';
        else if (line.includes('❌') || line.toLowerCase().includes('pass'))
          verdict = 'fail';
        current.items.push({ title, href, verdict });
      }
    }

    return sections;
  } catch {
    return [];
  }
}

/** Get display name for a group folder */
function groupDisplayName(folder: string): string {
  return folder
    .replace(/^whatsapp_|^telegram_|^slack_/, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── CSS ─────────────────────────────────────────────────────────────────────

const CSS = `
:root {
  --bg: #0d1117; --bg2: #161b22; --bg3: #21262d;
  --fg: #c9d1d9; --fg2: #8b949e; --accent: #58a6ff;
  --green: #3fb950; --red: #f85149; --yellow: #d29922;
  --border: #30363d; --radius: 6px;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; background: var(--bg); color: var(--fg); line-height: 1.5; }
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }

.wiki-header { background: var(--bg2); border-bottom: 1px solid var(--border); padding: 0 1.25rem; height: 3rem; display: flex; align-items: center; justify-content: space-between; }
.wiki-header .title { font-weight: 600; font-size: 1rem; color: var(--fg); }
.wiki-header select { background: var(--bg3); border: 1px solid var(--border); border-radius: 4px; color: var(--fg); padding: 0.25rem 0.5rem; font-size: 0.8125rem; }

.wiki-layout { display: flex; min-height: calc(100vh - 3rem); }

.wiki-sidebar { width: 260px; background: var(--bg2); border-right: 1px solid var(--border); padding: 1rem 0; overflow-y: auto; flex-shrink: 0; }
.sidebar-section { padding: 0 1rem; margin-bottom: 1.25rem; }
.sidebar-label { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--fg2); margin-bottom: 0.375rem; font-weight: 600; }
.sidebar-item { display: block; padding: 0.3rem 0.75rem; border-radius: 4px; font-size: 0.8125rem; color: var(--fg2); text-decoration: none; margin-bottom: 1px; }
.sidebar-item:hover { background: var(--bg3); color: var(--fg); text-decoration: none; }
.sidebar-item.active { background: rgba(88,166,255,0.1); color: var(--accent); }
.sidebar-verdict { font-size: 0.7rem; margin-left: 0.25rem; }

.wiki-content { flex: 1; padding: 2rem 2.5rem; overflow-y: auto; max-width: 900px; }
.wiki-content h1 { font-size: 1.5rem; font-weight: 600; margin-bottom: 0.25rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--border); }
.wiki-content h2 { font-size: 1.125rem; font-weight: 600; margin: 1.5rem 0 0.5rem; color: var(--fg); }
.wiki-content h3 { font-size: 1rem; font-weight: 600; margin: 1.25rem 0 0.375rem; color: var(--fg); }
.wiki-content p { font-size: 0.9375rem; line-height: 1.7; margin-bottom: 0.75rem; }
.wiki-content ul, .wiki-content ol { padding-left: 1.5rem; margin-bottom: 0.75rem; }
.wiki-content li { font-size: 0.9375rem; line-height: 1.6; margin-bottom: 0.25rem; }
.wiki-content code { background: var(--bg3); padding: 0.125rem 0.375rem; border-radius: 3px; font-size: 0.85em; font-family: 'SFMono-Regular', Consolas, monospace; }
.wiki-content pre { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius); padding: 1rem; overflow-x: auto; margin-bottom: 1rem; }
.wiki-content pre code { background: none; padding: 0; font-size: 0.8125rem; }
.wiki-content table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; font-size: 0.875rem; }
.wiki-content th { text-align: left; color: var(--fg2); font-weight: 500; padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--border); }
.wiki-content td { padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--border); }
.wiki-content tr:hover td { background: var(--bg2); }
.wiki-content strong { color: var(--fg); }
.wiki-content blockquote { border-left: 3px solid var(--border); padding-left: 1rem; color: var(--fg2); margin-bottom: 0.75rem; }
.wiki-content hr { border: none; border-top: 1px solid var(--border); margin: 1.5rem 0; }
.wiki-content img { max-width: 100%; border-radius: var(--radius); }

.meta { color: var(--fg2); font-size: 0.8rem; margin-bottom: 1.5rem; display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center; }
.tag { background: var(--bg3); padding: 0.125rem 0.5rem; border-radius: 1rem; font-size: 0.7rem; color: var(--fg2); display: inline-block; }
.verdict-badge { display: inline-block; padding: 0.125rem 0.625rem; border-radius: 1rem; font-size: 0.75rem; font-weight: 500; }
.verdict-pass { background: rgba(63,185,80,0.15); color: var(--green); }
.verdict-maybe { background: rgba(210,153,34,0.15); color: var(--yellow); }
.verdict-fail { background: rgba(248,81,73,0.15); color: var(--red); }

.empty-state { display: flex; align-items: center; justify-content: center; min-height: 60vh; color: var(--fg2); font-style: italic; }

.wiki-content pre { position: relative; }
.wiki-content pre .copy-btn {
  position: absolute; top: 6px; right: 6px;
  font: inherit; font-size: 11px; line-height: 1;
  padding: 4px 8px; border: 1px solid var(--border);
  background: var(--bg3); color: var(--fg2);
  border-radius: 4px; cursor: pointer;
  opacity: 0.25; transition: opacity 0.15s, color 0.15s;
}
.wiki-content pre:hover .copy-btn,
.wiki-content pre .copy-btn:focus { opacity: 1; }
.wiki-content pre .copy-btn:hover { color: var(--fg); }
.wiki-content pre .copy-btn.copied { color: var(--green); opacity: 1; }

@media (max-width: 768px) {
  .wiki-sidebar { display: none; }
  .wiki-content { padding: 1.25rem; }
}
`;

// Post-processes rendered markdown code blocks to add a copy-to-clipboard
// button. Runs after DOM ready; no external dependencies.
const COPY_BUTTON_JS = `
(function(){
  function attach(pre){
    if(pre.querySelector(':scope > .copy-btn'))return;
    var btn=document.createElement('button');
    btn.type='button';btn.className='copy-btn';btn.textContent='Copy';
    btn.setAttribute('aria-label','Copy code to clipboard');
    btn.addEventListener('click',function(){
      var code=pre.querySelector('code');
      var text=(code?code.innerText:pre.innerText).replace(/\\n$/,'');
      var done=function(){
        btn.textContent='Copied!';btn.classList.add('copied');
        setTimeout(function(){btn.textContent='Copy';btn.classList.remove('copied');},1500);
      };
      if(navigator.clipboard&&navigator.clipboard.writeText){
        navigator.clipboard.writeText(text).then(done,function(){});
      }
    });
    pre.appendChild(btn);
  }
  function init(){
    var pres=document.querySelectorAll('.wiki-content pre');
    for(var i=0;i<pres.length;i++)attach(pres[i]);
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',init);
  }else{init();}
})();
`;

// ── HTML rendering ──────────────────────────────────────────────────────────

function renderPage(
  folder: string,
  pagePath: string,
  groups: string[],
): string {
  const sidebar = parseSidebar(folder);
  const page = readWikiPage(
    folder,
    pagePath.endsWith('.md') ? pagePath : pagePath + '.md',
  );

  // Normalize pagePath without .md for comparison
  const normalizedPagePath = pagePath.replace(/\.md$/, '');

  const groupOptions = groups
    .map((g) => {
      const selected = g === folder ? ' selected' : '';
      return `<option value="${escapeHtml(g)}"${selected}>${escapeHtml(groupDisplayName(g))}</option>`;
    })
    .join('');

  const sidebarHtml =
    sidebar.length === 0
      ? '<div class="sidebar-section"><p style="color:var(--fg2);font-size:0.8rem;">No index.md found</p></div>'
      : sidebar
          .map((s) => {
            const items = s.items
              .map((item) => {
                // Extract the page portion from href: /<folder>/<pagePath> -> <pagePath>
                const hrefPage = item.href.split('/').slice(2).join('/');
                const active = hrefPage === normalizedPagePath ? ' active' : '';
                const verdictIcon =
                  item.verdict === 'pass'
                    ? '<span class="sidebar-verdict">✅</span>'
                    : item.verdict === 'maybe'
                      ? '<span class="sidebar-verdict">⏸️</span>'
                      : item.verdict === 'fail'
                        ? '<span class="sidebar-verdict">❌</span>'
                        : '';
                return `<a class="sidebar-item${active}" href="${escapeHtml(item.href)}">${escapeHtml(item.title)}${verdictIcon}</a>`;
              })
              .join('');
            return `<div class="sidebar-section"><div class="sidebar-label">${escapeHtml(s.label)}</div>${items}</div>`;
          })
          .join('');

  let contentHtml: string;
  if (!page) {
    contentHtml = '<div class="empty-state">Page not found</div>';
  } else {
    // Frontmatter metadata
    let metaHtml = '';
    const tags = (page.data.tags as string[]) || [];
    const verdict = page.data.verdict as string | undefined;
    const evaluated = page.data.evaluated as string | undefined;
    const updated = page.data.updated as string | undefined;
    const source = page.data.source as string | undefined;

    const metaParts: string[] = [];
    if (verdict === 'worth-exploring')
      metaParts.push(
        '<span class="verdict-badge verdict-pass">✅ Worth exploring</span>',
      );
    else if (verdict === 'interesting-but-not-now')
      metaParts.push(
        '<span class="verdict-badge verdict-maybe">⏸️ Interesting but not now</span>',
      );
    else if (verdict === 'pass')
      metaParts.push('<span class="verdict-badge verdict-fail">❌ Pass</span>');
    if (evaluated)
      metaParts.push(`<span>Evaluated: ${escapeHtml(evaluated)}</span>`);
    if (updated) metaParts.push(`<span>Updated: ${escapeHtml(updated)}</span>`);
    if (source)
      metaParts.push(
        `<a href="${escapeHtml(source)}" target="_blank" rel="noopener noreferrer">Source ↗</a>`,
      );
    if (tags.length > 0)
      metaParts.push(
        ...tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`),
      );

    if (metaParts.length > 0)
      metaHtml = `<div class="meta">${metaParts.join('')}</div>`;

    contentHtml = `<div class="wiki-content">${metaHtml}${page.html}</div>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(groupDisplayName(folder))} Wiki — ${ASSISTANT_NAME}</title>
<style>${CSS}</style>
</head>
<body>
<header class="wiki-header">
  <span class="title">${escapeHtml(groupDisplayName(folder))} Wiki</span>
  <select onchange="window.location.href='/'+this.value">${groupOptions}</select>
</header>
<div class="wiki-layout">
  <nav class="wiki-sidebar">${sidebarHtml}</nav>
  ${contentHtml}
</div>
<script>${COPY_BUTTON_JS}</script>
</body>
</html>`;
}

// ── Server ──────────────────────────────────────────────────────────────────

export function startWikiServer(): http.Server | null {
  const envVars = readEnvFile(['WIKI_PORT']);
  const portStr = process.env.WIKI_PORT || envVars.WIKI_PORT;
  if (!portStr) return null;

  const port = parseInt(portStr, 10);
  if (isNaN(port)) return null;

  const server = http.createServer((req, res) => {
    try {
      const url = new URL(req.url ?? '/', `http://localhost:${port}`);
      const pathname = decodeURIComponent(url.pathname);

      const groups = discoverWikiGroups();

      // Root: redirect to first group
      if (pathname === '/' || pathname === '') {
        if (groups.length === 0) {
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end('<div class="empty-state">No wikis found</div>');
          return;
        }
        res.writeHead(302, {
          Location: `/${encodeURIComponent(groups[0])}`,
        });
        res.end();
        return;
      }

      // Parse: /:folder or /:folder/:page or /:folder/ideas/:page
      const parts = pathname.slice(1).split('/').filter(Boolean);
      if (parts.length === 0 || !groups.includes(parts[0])) {
        res.writeHead(404);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(renderPage(groups[0] || '', 'index.md', groups));
        return;
      }

      const folder = parts[0];
      const pagePath =
        parts.length === 1 ? 'index.md' : parts.slice(1).join('/') + '.md';

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(renderPage(folder, pagePath, groups));
    } catch (err) {
      logger.error({ err }, 'Wiki server request error');
      res.writeHead(500).end('Internal error');
    }
  });

  server.listen(port, '0.0.0.0', () => {
    logger.info({ port }, 'Wiki server listening');
  });

  return server;
}
