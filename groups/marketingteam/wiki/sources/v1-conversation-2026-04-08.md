---
type: summary
created: 2026-05-05
updated: 2026-05-05
sources:
  - sources/v1-conversations/2026-04-08-conversation-2312.md
related:
  - wiki/topics/reporting-pipeline.md
  - wiki/concepts/analyst-spec.md
  - wiki/concepts/collector-data-schema.md
  - wiki/entities/qld-capital.md
  - wiki/topics/client-list.md
---

# Source Summary — v1 Conversation (Apr 2–8, 2026)

Archived conversation between Adam Jowett and Janet (v1, Slack). Covers the design and build of the full daily reporting pipeline — Collector, Analyst, Reporter — plus a live QLD Capital data pull.

## Key decisions captured

- **Analyst vs Reporter boundary**: Reporter is a dumb formatter; all interpretation and fully-formed strings come from the Analyst. Client ordering is the Reporter's job.
- **Conversion action classification**: Analyst classifies by type (call_native, call_website, form_submit, form_view, email_click) regardless of how each client named the action.
- **Contact engagement analysis**: Added to Analyst spec — form view/submission rates, phone clicks, email clicks, native calls, split paid vs organic.
- **GA4 Maroochydore fix**: Service account `janet-marketing-agent@janet-492005.iam.gserviceaccount.com` needed Viewer access added; resolved same session.

## Outcome

Collector built, tested (7/8 → 8/8 after Maroochydore fix), scheduled daily at 6am AEST. Analyst spec fully rewritten. Reporter spec aligned. Both specs stored in `specs/` in the container.
