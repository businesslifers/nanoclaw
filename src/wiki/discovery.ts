/**
 * Wiki discovery for the dashboard.
 *
 * Scans the install for `wiki/` directories that contain an `index.md` and
 * returns one entry per discovered wiki. The dashboard's `/api/wikis`
 * endpoint serves this list and uses each entry's `rootAbsPath` to read
 * page content from disk.
 *
 * Locations checked:
 *   - `<repo>/wiki/`              → root-level wiki (isGlobal: true, id: "root")
 *   - `<repo>/groups/global/wiki/` → cross-group wiki (isGlobal: true, id: "global")
 *   - `<repo>/groups/<folder>/wiki/` for each known agent group
 *                                  → per-group wiki (isGlobal: false, id: <folder>)
 *
 * A wiki entry is only returned if `<wikiDir>/index.md` exists.
 */
import fs from 'node:fs';
import path from 'node:path';

export interface WikiEntry {
  id: string;
  title: string;
  description: string | null;
  pageCount: number;
  lastModified: string;
  isGlobal: boolean;
  rootAbsPath: string;
}

interface KnownGroup {
  id: string;
  name: string;
  folder: string;
}

export function listWikis(cwd: string, groups: KnownGroup[]): WikiEntry[] {
  const entries: WikiEntry[] = [];

  // Repo-root /wiki — optional; absent in this install but supported for
  // operators who scaffold a top-level wiki directly.
  const rootWiki = path.join(cwd, 'wiki');
  const rootEntry = scanWikiDir(rootWiki, { id: 'root', title: 'Root', isGlobal: true });
  if (rootEntry) entries.push(rootEntry);

  // Global wiki under groups/global/wiki/
  const globalWiki = path.join(cwd, 'groups', 'global', 'wiki');
  const globalEntry = scanWikiDir(globalWiki, { id: 'global', title: 'Global', isGlobal: true });
  if (globalEntry) entries.push(globalEntry);

  // Per-group wikis. Title falls back to the agent group name if no
  // frontmatter title is given.
  for (const g of groups) {
    if (g.folder === 'global') continue; // already handled above
    const wikiDir = path.join(cwd, 'groups', g.folder, 'wiki');
    const entry = scanWikiDir(wikiDir, { id: g.folder, title: g.name, isGlobal: false });
    if (entry) entries.push(entry);
  }

  return entries;
}

interface ScanOptions {
  id: string;
  title: string;
  isGlobal: boolean;
}

function scanWikiDir(dir: string, opts: ScanOptions): WikiEntry | null {
  const indexPath = path.join(dir, 'index.md');
  if (!fs.existsSync(indexPath)) return null;

  const { description, title } = parseFrontmatter(indexPath, opts.title);
  const { pageCount, lastModified } = walkMarkdown(dir);

  return {
    id: opts.id,
    title,
    description,
    pageCount,
    lastModified,
    isGlobal: opts.isGlobal,
    rootAbsPath: fs.realpathSync(dir),
  };
}

/**
 * Pull `title` and `description` from the index.md frontmatter. Both fall
 * back: title to the supplied default, description to null. Frontmatter is
 * the YAML block between two `---` lines at the top of the file. Parser is
 * intentionally minimal — single-line scalars only — to avoid pulling in a
 * yaml dependency.
 */
function parseFrontmatter(indexPath: string, fallbackTitle: string): { title: string; description: string | null } {
  let title = fallbackTitle;
  let description: string | null = null;
  try {
    const content = fs.readFileSync(indexPath, 'utf8');
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (match) {
      for (const line of match[1].split(/\r?\n/)) {
        const m = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*):\s*(.*?)\s*$/);
        if (!m) continue;
        const key = m[1];
        const value = m[2].replace(/^['"]|['"]$/g, '');
        if (key === 'title' && value) title = value;
        if (key === 'description' && value) description = value;
      }
    }
  } catch {
    /* fall through to defaults */
  }
  return { title, description };
}

function walkMarkdown(dir: string): { pageCount: number; lastModified: string } {
  let pageCount = 0;
  let latestMs = 0;
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(current, e.name);
      if (e.isDirectory()) {
        stack.push(full);
      } else if (e.isFile() && e.name.endsWith('.md')) {
        pageCount++;
        try {
          const stat = fs.statSync(full);
          if (stat.mtimeMs > latestMs) latestMs = stat.mtimeMs;
        } catch {
          /* skip unreadable */
        }
      }
    }
  }
  const lastModified = latestMs > 0 ? new Date(latestMs).toISOString() : new Date(0).toISOString();
  return { pageCount, lastModified };
}
