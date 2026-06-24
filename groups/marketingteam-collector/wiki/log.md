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

## [2026-06-24] query | Connectivity re-check — 7/7 accounts healthy, root cause confirmed

Adam asked for a "check again" on Google Ads connectivity. Parent ran the real collector from their container: 7/7 accounts succeeded (data date 2026-06-23). No auth issue. Confirmed the June root cause was the stale `login-customer-id` header (now removed); service account has direct access to all 7 accounts. Lane wiki corrected accordingly.
