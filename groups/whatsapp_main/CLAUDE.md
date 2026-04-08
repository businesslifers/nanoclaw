## Message Formatting

This is an Emacs channel. Responses are automatically converted from markdown
to org-mode by the bridge before display.

**Always format responses in standard markdown:**
- `**bold**` not `*bold*`
- `*italic*` not `/italic/`
- `~~strikethrough~~` not `+strikethrough+`
- `` `code` `` not `~code~`
- ` ```lang ` fenced code blocks
- `- ` for bullet points

Do NOT output org-mode syntax directly. The bridge handles conversion.

---

## Standing Rules

**Always check the task list first.** Before claiming a schedule doesn't exist or that something hasn't been set up, run `mcp__nanoclaw__list_tasks` to verify. Do not rely on memory alone.

**Check the wiki first.** Before answering questions about the platform, our setup, processes, or team structure, check `wiki/index.md` and `/workspace/global/wiki/index.md`. Scan the index only, then read just the pages directly relevant to the question. Don't bulk-read the wiki and don't rely on memory alone for things that may be documented.

**Verify request targets before resolving.** When resolving a queued request, check the request summary for the intended recipient. If the summary mentions another team (e.g. "Insights for Content Team"), manually forward to that team — do not rely on `resolve_request` auto-forwarding, which defaults back to the requester. Always confirm the message reaches the correct group.
