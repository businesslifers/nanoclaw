---
title: Closeout report with outstanding items
mate: pm-project
schema_version: 1
last_reviewed: 2026-05-13
---

# Closeout report with outstanding items

## Task

Given the following situation — *"Twelve-week marketing-site rebuild has launched on the conference deadline. All headline deliverables (homepage, product pages, about page, contact page, blog template, design system) are live and signed off. Three loose ends: (1) the customer-stories section that was added as a phase-2 deliverable mid-project is partially live — pattern is built, two of five case studies are published, three are still in content production; (2) analytics tracking on the contact-form conversion event is in place but the counterparty's CRM ingestion of that event is unverified — the counterparty's IT team owns that connection; (3) one of the product-page hero illustrations was launched with a placeholder commissioned from stock, pending the final illustration which was delayed by an illustrator availability issue. The counterparty has not yet signed off on closing the engagement."* — produce the closeout report.

The output is the structured closeout document. It is internal-first; an external-facing summary may be drafted separately for sign-off, but the brief is the full internal version.

## Conditions to compare

1. Baseline model (no mate context)
2. Mate prompt only
3. Mate prompt + wiki
4. Mate fully loaded under a real claw with the project profile, original deliverable list, and full engagement history available

## What good looks like

- Lead summary in one or two sentences: "Project launched on deadline against all headline deliverables. Three outstanding items prevent formal closeout; each has an owner and a path to resolution." Not "the project was a success".
- Structured into: deliverables confirmed against the original list (homepage, product pages, about, contact, blog template, design system — each ticked); deliverables added or changed mid-project (the customer-stories section, named explicitly as added in week 6, with what was delivered against what was agreed); outstanding items; what was learned; recommended follow-up; closeout status.
- Outstanding items are named, owned, and dated, not glossed:
  - Customer-stories section: 2 of 5 case studies live; 3 in content production with the content owner named; recommended follow-up is to confirm the post-launch delivery date in writing.
  - Contact-form CRM ingestion: tracking event in place on the team's side; counterparty IT team owns the ingestion connection; recommended follow-up is a written handover note to the counterparty IT lead with the event spec and a verification request.
  - Product-page hero illustration: live with a stock placeholder; final illustration in production with the illustrator; recommended follow-up is a swap-in date and a confirmation that the placeholder licence covers the interim window.
- States explicitly that the engagement is not formally closed yet — the project is not done until handover is completed, documentation is filed, and sign-off is received. Names what's required to close: counterparty sign-off on the launched site, written confirmation on the three outstanding items, handover of credentials / asset folders / documentation.
- Names what was learned in concrete project-specific terms (the conference deadline forced a swap-in pattern for the illustration; the mid-project scope addition was scoped correctly as phase-2 and didn't compromise the launch; the CRM ingestion gap should have been confirmed earlier in the project rather than at handover) — not "great teamwork" platitudes.
- Plain language, structured, scan-able. No padding.

## What bad looks like

- "Project completed successfully" as the lead summary; outstanding items relegated to a footnote
- Closeout marks the project as closed before counterparty sign-off and the three outstanding items have a path to resolution
- Outstanding items listed without an owner or a path to resolution
- Lessons learned section reads as praise rather than concrete project-specific observations
- Doesn't distinguish between deliverables agreed at kickoff and deliverables added mid-project (the customer-stories addition deserves explicit acknowledgement, not silent inclusion)
- Drafts the counterparty sign-off message directly inside the closeout report instead of as a separate, reviewable artifact
- Softens or omits the CRM-ingestion gap because it's on the counterparty's side — the gap still affects whether the launch is truly complete from the counterparty's perspective and belongs in the report

## Notes

This eval tests the projects-don't-drift-to-a-close reflex. Closeout is the easiest phase to phone in — the work is done, the launch went out, everyone wants to celebrate and move on. A weak closeout report calls it done, glosses the loose ends, and leaves the team carrying an undefined obligation. A strong closeout report names exactly what's left, who owns each thing, and what "done" actually requires — and refuses to close the project until those conditions are met.
