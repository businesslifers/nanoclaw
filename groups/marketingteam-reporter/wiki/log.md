---
scope: group
group: marketingteam-reporter
---

# Reporter Wiki — Log

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

## [2026-07-06] ingest | Filed Slack mrkdwn conventions from parent dispatch

Parent (Janet) dispatched a campaign-audit reformat request with explicit Slack rules (bullets, bold headers, no em dashes, link syntax, section ordering). Confirms existing lane conventions in CLAUDE.role.md — filed as [concepts/slack-mrkdwn-conventions.md](concepts/slack-mrkdwn-conventions.md) since this is the first real-world confirmation, not just self-declared rules.
