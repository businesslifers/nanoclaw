# Zoho Platform Knowledge

Last updated: 2026-05-07

Mettro uses Zoho for client email marketing (Zoho Campaigns) and CRM automation. This page documents platform behaviour, quirks, and workflow patterns discovered in session.

---

## Zoho Campaigns

Used by QLD Capital (and likely other clients) for marketing email workflows.

### Known limitations

- **No preview link generation.** Zoho Campaigns does not provide a shareable preview link for sent or scheduled emails. If a client wants to click a link in a spreadsheet and see what the email looked like, Zoho cannot supply that link natively.
- **Email tracking workaround (Option 1 discussed May 5 2026):** Capture the email HTML from Zoho and store it in a linked document (Google Drive, ClickUp, etc.) so the client can reference it. This requires manual effort per email and is prone to becoming stale if the email is updated after capture.

### QLD Capital workflow context

QLD Capital has a marketing calendar (Google Sheet) tracking email workflows. All emails are built and sent from Zoho Campaigns (with possibly a small amount from Zoho CRM). The problem: the sheet cannot link to a live preview of each email. Raels raised this May 5 as an open UX/process problem — solution not yet confirmed.

---

## Zoho CRM — Conditional Email Workflows

### Use case

Client wants a multi-email drip sequence (e.g. 7–14 days apart) triggered by a field update (e.g. "Offer Pending Acceptance"). But: if the field changes (e.g. to "Offer Accepted"), the sequence should stop. The requirement: no "zombie emails" — sequences should not keep sending after the trigger condition is no longer true.

### How to build this in Zoho CRM

Use a **workflow with decision nodes (wait conditions)**:

1. **Trigger:** Field updated to target value (e.g. "Offer Pending Acceptance")
2. **Send email 1** immediately (or with a short delay)
3. **Wait node:** Set a delay (e.g. 7 days)
4. **Decision node:** Check — is the field STILL "Offer Pending Acceptance"?
   - YES: proceed to Email 2
   - NO: exit the workflow (no more emails sent)
5. Repeat pattern: Send email 2, wait, check condition again, send email 3, etc.

**Key concept:** The decision node is not just a time delay — it is a live field check at the moment the delay expires. If the record's status has changed, the workflow exits cleanly.

Raels confirmed this makes sense (May 6): "so it's a wait condition?" — yes, the wait condition includes a field check before proceeding.

### Not the same as separate workflows

This is more efficient than setting up separate email workflows per step. A single workflow with embedded decision nodes handles the conditional branching internally.

---

## See also

- [mettro-crm-system.md](mettro-crm-system.md) — Mettro's broader CRM system design (HeyReach, Make.com, Apollo)
- [mettro-tools.md](mettro-tools.md) — Mettro production tools
