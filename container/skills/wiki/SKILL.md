---
name: wiki
description: Maintain a persistent, LLM-curated markdown wiki for the agent group, with read access to a shared global wiki and (for the main agent only) write access to it. Use whenever the operator drops a source into sources/, asks a question that should consult the wiki, or asks for a wiki health check.
---

# Wiki

Two-tier markdown wiki maintained by the agent on behalf of the operator.

```
/workspace/agent/wiki/        ← this group's wiki (always read+write)
/workspace/agent/sources/     ← raw sources dropped here by the operator

/workspace/global/wiki/       ← shared cross-group wiki
                                  read+write for the MAIN agent (Janet, dm-with-adam)
                                  read-only for every other agent
/workspace/global/sources/    ← shared sources, same permission model as /global/wiki/
```

The main agent is identified by the host's `NANOCLAW_MAIN_GROUP_FOLDER` env var; you can verify your write access with `touch /workspace/global/.write-check 2>/dev/null && echo writable || echo readonly`.

## Three layers

1. **Sources** — `sources/`. Immutable curated documents. You read them; never modify.
2. **The wiki** — `wiki/`. Markdown directories with summaries, entity pages, concept pages, topic pages, comparisons. You own it entirely.
3. **The schema** — this file + the group's `CLAUDE.md`. Tells you how to do (1) and (2).

## Three operations

### Ingest

When the operator adds a file under `sources/` (or pastes a URL / chat content they want filed), you:

1. **Read the source completely.** For URLs that need full content, **don't use `WebFetch`** — it returns summaries. Instead:
   - Static page or document → `curl -sL <url> -o sources/<slug>.{html,pdf,md}`
   - JS-heavy / dynamic page → `agent-browser` to render then dump the DOM as markdown
   - File the downloaded copy under `sources/` so the wiki has a permanent reference
2. **Discuss takeaways briefly with the operator** — confirm what's worth filing.
3. **Update wiki pages.** A single source typically touches 5–15 pages:
   - Summary page (one per source — `wiki/sources/<slug>.md` with frontmatter linking back to the original)
   - Entity pages (people, places, orgs mentioned — create `wiki/entities/<name>.md` if missing, otherwise update)
   - Concept pages (ideas / frameworks / definitions — `wiki/concepts/<slug>.md`)
   - Topic pages (multi-source threads — `wiki/topics/<slug>.md`)
   - Cross-references in both directions
4. **Update `wiki/index.md`** — add the new pages under their category with a one-line summary.
5. **Append to `wiki/log.md`**:
   ```
   ## [YYYY-MM-DD] ingest | <source title>
   <2-3 line summary of what was added/updated>
   ```
6. **Promote to global** if the page is broadly useful (cross-cutting concept, well-known entity, definition that other agents would also benefit from). Only the main agent can write to `/workspace/global/wiki/`. Non-main agents propose promotions as chat messages: *"Worth promoting `wiki/concepts/x.md` to global. Want me to ask Janet to do it?"*.

### CRITICAL: ingest discipline — one source at a time

When the operator hands you multiple files or a folder of sources, you **MUST process them one at a time**. For each file:

1. Read it.
2. Discuss takeaways.
3. Create / update **all** the wiki pages it touches (summary + entities + concepts + topics + cross-refs + index + log).
4. **Completely finish** with that file before opening the next.

Do **not** batch-read all files and then process them together. Batching produces shallow generic pages instead of the deep integration the wiki pattern depends on. Each source deserves its own pass.

### Query

When the operator asks a question:

1. Read `wiki/index.md` first (and `/workspace/global/wiki/index.md` if relevant) to find candidate pages.
2. Drill into those pages; read the linked sources if needed for fidelity.
3. Synthesise an answer with citations: link to the wiki pages and source files used. Keep the answer in chat by default.
4. If the answer itself is broadly useful, **file it back into the wiki** as a new page (e.g. `wiki/topics/<question-slug>.md`). Update index. Append to log:
   ```
   ## [YYYY-MM-DD] query | <one-line question>
   Filed answer to wiki/topics/<slug>.md.
   ```

### Lint

A health check, run weekly via the scheduled task in `scheduled_tasks` (or any time the operator says *"lint the wiki"*). Look for:

- **Contradictions** — pages making opposing claims about the same entity
- **Stale claims** — pages superseded by newer sources
- **Orphan pages** — no inbound links from `wiki/index.md` or other pages
- **Missing pages** — concepts referenced repeatedly but never given a dedicated page
- **Broken cross-references** — links to renamed or deleted pages
- **Sources without a wiki page** — files in `sources/` that haven't been ingested

Report findings in chat. Offer to fix each issue. After applying fixes, append to log:
```
## [YYYY-MM-DD] lint | N issues found, M fixed
```

## File conventions

- **Filenames**: kebab-case, no spaces, no dates in filename (use frontmatter `created` instead).
  - Good: `wiki/entities/anthropic.md`, `wiki/topics/ipv6-fetch-bug.md`
  - Bad: `wiki/Entity - Anthropic 2026-04-28.md`
- **Frontmatter**: every wiki page has YAML frontmatter at the top:
  ```yaml
  ---
  type: entity | concept | topic | summary
  created: YYYY-MM-DD
  updated: YYYY-MM-DD
  sources:
    - sources/<slug>.{md,pdf,html}
  related:
    - wiki/entities/<other>.md
  ---
  ```
- **Links**: relative markdown links between wiki pages. Use absolute paths starting `/workspace/global/wiki/` when linking to global from a group wiki.

## Promotion path (group → global)

When you have write access to `/workspace/global/`:

1. Copy the page from `wiki/<category>/<slug>.md` to `/workspace/global/wiki/<category>/<slug>.md`. Preserve frontmatter; bump `updated` to today.
2. Replace the source group's page with a stub:
   ```md
   ---
   promoted: /workspace/global/wiki/<category>/<slug>.md
   ---
   See [global wiki](/workspace/global/wiki/<category>/<slug>.md).
   ```
3. Update `wiki/index.md` in **both** the group and the global wiki.
4. Append to `wiki/log.md` in the group AND to `/workspace/global/wiki/log.md`:
   ```
   ## [YYYY-MM-DD] promote | <slug> from <group> to global
   ```

When you don't have write access (non-main agent), propose the promotion in chat instead. Don't simulate — the operator or main agent will execute it.
