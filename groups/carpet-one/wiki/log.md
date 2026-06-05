---
scope: group
group: carpet-one
---

# Janet Wiki — Log

Append-only chronological record of ingest, query, lint, and promotion events. One entry per operation. Format:

```
## [YYYY-MM-DD] <event-type> | <one-line summary>

<details>
```

Where `<event-type>` is `ingest`, `query`, `lint`, `promote`, or `prune`.

Recent entries are tail-readable: `tail -50 log.md` or `grep "^## \[" log.md | tail -10`.

---

## [2026-06-02] init | Wiki scaffolded at group creation

Empty skeleton created by `initGroupFilesystem`. No sources ingested yet.

## [2026-06-02] ingest | Carpet One Australia website fully ingested

Browsed https://www.carpetone.com.au/ including homepage, stores page, carpet page, hard flooring page, windows page, inspiration page, warranty page, and a sample store page (Stafford). Captured:
- Brand positioning, co-operative model, key CTAs and differentiators
- Full writing style and tone analysis
- Visual/image style notes
- Navigation structure
- All 3 product categories with sub-types and popular product names
- All 51 Australian store locations with name, state, phone, email, address
- Showroom-to-You service description
- Warranty language
- Inspiration content themes

Page: `wiki/entities/carpet-one-brand.md`
Screenshots saved to `/workspace/agent/sources/carpetone_*.png`
