# DNS & Email Authentication

Last updated: 2026-04-22

## Mettro Policy — DNS Changes

**Mettro does not take ownership of DNS changes unless there is no other option.**

- DNS changes are the client's (or their IT team's) responsibility
- If Mettro must make a DNS change: run it through authentication verification tools AND at least one AI tool before applying
- Always confirm with Adam or Raels before touching a client's DNS
- Document every DNS change in ClickUp with before/after values

## SPF, DKIM, and DMARC — How They Work Together

These three DNS records authenticate outbound email. All three need to be correct or email lands in spam.

| Record | What it does | Common issue |
|--------|-------------|--------------|
| SPF | Lists servers authorised to send on behalf of the domain | Only one SPF record allowed per domain; missing senders cause soft/hard fails |
| DKIM | Cryptographic signature — proves email wasn't tampered with | Must be enabled per sending service; Microsoft 365 requires CNAME records added to DNS |
| DMARC | Policy: what to do when SPF/DKIM fail (none/quarantine/reject) | p=quarantine means failing emails go to spam — correct behaviour, but requires SPF+DKIM to be complete |

## Common Problem: Microsoft 365 + Zoho Coexistence

Observed with QLD Capital (April 2026): Mettro updated the SPF record to include Zoho but not Microsoft 365. Result: every email sent via Outlook hit a DMARC quarantine because SPF and DKIM both failed for M365.

**Diagnosis checklist when a client reports emails going to spam:**
1. Check SPF — does it include ALL sending services? (Zoho, M365, MailChimp, CRM, etc.)
2. Check DKIM — is each sending service's DKIM configured and enabled?
3. Check DMARC policy — is it p=quarantine or p=reject? If so, any SPF/DKIM miss = spam
4. Only one SPF record allowed — adding a second breaks both
5. SPF has a 10 DNS lookup limit — too many includes can break silently

**QLD Capital resolution (Apr 2026):**
- SPF updated: `v=spf1 include:spf.protection.outlook.com include:zohomail.com.au ~all`
- DMARC left as-is (p=quarantine is correct — don't weaken it)
- Zoho DKIM kept as-is
- Microsoft 365 DKIM: client instructed to enable in M365 admin (security.microsoft.com → Email authentication settings → DKIM) and add CNAME records to DNS

## Microsoft 365 DKIM Setup (Client-side)

1. Client goes to security.microsoft.com → Email & Collaboration → Policies & Rules → Threat Policies → Email Authentication Settings → DKIM
2. Selects their domain, copies the two CNAME records (selector1 + selector2)
3. Those CNAMEs go into DNS (Mettro adds them if we manage the DNS, or client's IT otherwise)
4. Wait 15–60 minutes for propagation
5. Client returns to same screen and enables DKIM signing

## Verification Tools

- **mail-tester.com** — send a test email, get SPF/DKIM/DMARC score out of 10
- **MXToolbox** — look up SPF, DKIM, DMARC records and check for errors
- Always verify after making any email authentication change

## DMARC Reports

DMARC rua/ruf reports go to whatever address is in the record. Large volume of XML daily reports is normal — recommend a dedicated address (e.g. dmarc@domain.com) or a service like Postmark DMARC Digests rather than a real inbox.

## See also

- [admin-tools.md](admin-tools.md) — platform incident history
- [mettro-crm-system.md](mettro-crm-system.md) — email platform decision (Brevo/AC/Kit)
