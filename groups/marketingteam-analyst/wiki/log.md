---
scope: group
group: marketingteam-analyst
---

# Analyst Wiki — Log

Append-only chronological record of ingest, query, lint, and promotion events. One entry per operation. Format:

```
## [YYYY-MM-DD] <event-type> | <one-line summary>

<details>
```

Where `<event-type>` is `ingest`, `query`, `lint`, `promote`, or `prune`.

Recent entries are tail-readable: `tail -50 log.md` or `grep "^## \[" log.md | tail -10`.

---

## [2026-07-06] init | Wiki scaffolded at group creation

Empty skeleton created by `initGroupFilesystem`. No sources ingested yet.

## [2026-07-06] ingest | Full-audit dispatch from parent (Raels task), filed local-pack conversion-gap concept

Parent dispatched a 50-campaign, 7-account audit for prioritisation. 5 of 8 zero-conversion enabled campaigns were "Local 3-Pack Search" / "Google Local Listing PMax" format across 5 different accounts (Carpet One Bundall/Logan City/Redcliffe/Rockhampton, Haus Of Rattan) — filed as [[local-pack-conversion-gap]] since it's likely to recur on future audits. Flagged for parent to consider promoting to team wiki as a marketing-wide convention.
