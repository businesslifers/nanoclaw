---
scope: group
group: marketingteam-collector
---

## [2026-06-05] ingest | OneCLI proxy gRPC/h2 break investigation — three-layer diagnosis: TLS MITM (alert 120), REST transport rewrite, proxy credential injection blocker. Infra exemption pending.

# Collector Wiki — Log

Append-only chronological record of ingest, query, lint, and promotion events. One entry per operation. Format:

```
## [YYYY-MM-DD] <event-type> | <one-line summary>

<details>
```

Where `<event-type>` is `ingest`, `query`, `lint`, `promote`, or `prune`.

Recent entries are tail-readable: `tail -50 log.md` or `grep "^## \[" log.md | tail -10`.

---

## [2026-06-04] init | Wiki scaffolded at group creation

Empty skeleton created by `initGroupFilesystem`. No sources ingested yet.
