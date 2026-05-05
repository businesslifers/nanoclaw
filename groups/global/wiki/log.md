---
scope: global
---

# Global Wiki — Log

Append-only chronological record of ingest, query, lint, and promotion events on the global wiki. One entry per operation. Format:

```
## [YYYY-MM-DD] <event-type> | <one-line summary>

<details>
```

Where `<event-type>` is `ingest`, `query`, `lint`, `promote`, or `prune`.

Recent entries are tail-readable: `tail -50 log.md` or `grep "^## \[" log.md | tail -10`.

---

## [2026-04-28] init | Wiki scaffolded by /add-karpathy-llm-wiki

Created the global wiki and per-group wikis (`dm-with-adam`, `cli-with-adam`).
Main agent: `dm-with-adam` (Janet) — sole writer for this directory.
Lint: weekly Sundays 10:00 Australia/Sydney.
