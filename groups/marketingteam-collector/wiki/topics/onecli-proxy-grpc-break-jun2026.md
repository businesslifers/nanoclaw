---
title: OneCLI Proxy gRPC/h2 Break — June 2026 (REVISED)
scope: group
created: 2026-06-05
updated: 2026-06-24
---

# Google Ads Outage — June 2026 (Root Cause Revised)

## Revised root cause (2026-06-24)

The original diagnosis below (TLS MITM, ALPN, credential injection blocker) was **a misdiagnosis**.

The real root cause confirmed by parent (Janet, 2026-06-24):

> A stale `login-customer-id: 3218082250` header in `collector.mjs queryAds()` — already removed.

The service account has **direct access** to all 7 active clients. No MCC/manager-account `login-customer-id` header is needed or should be sent.

The fix was simply removing that header. The REST transport rewrite and "infra exemption" hypothesis were unnecessary detours.

**ALPN/h2 status (confirmed 2026-06-24):** The OneCLI proxy uses CONNECT tunneling — it does NOT do TLS MITM. Probe shows `ALPN: server accepted h2`, cert issuer is Google Trust Services (not OneCLI CA). There was never a TLS interception issue.

**Credential injection (confirmed 2026-06-24):** OneCLI 2.2.3 has no host-level exemption mechanism. The 403 `credential_not_found` seen in June was a consequence of the stale header triggering a different auth path, not a proxy interception issue.

---

## Original (incorrect) diagnosis — preserved for reference

### What happened

Starting **Jun 3 2026**, all 7 Google Ads accounts failed collection with:

```
14 UNAVAILABLE: No connection established. Last error: ...SSL routines:ssl3_read_bytes:tlsv1 alert no application protocol...:SSL alert number 120
```

Affected periods: yesterday, MTD, prevMonth — every query, after 2 retries.

### Claimed root cause (WRONG)

~~The OneCLI proxy (`host.docker.internal:10255`) performs full TLS MITM interception for all outbound HTTPS traffic. When it re-establishes the TLS connection to Google, it only advertises `http/1.1` in the ALPN extension — not `h2`.~~

### Claimed fix (WRONG)

~~Replaced `google-ads-node` gRPC client with a direct REST `fetch` call in `collector.mjs`.~~

### Second blocker claimed (WRONG)

~~After the REST fix, every account returned 403 credential_not_found. Proxy was intercepting `Authorization: Bearer`. Required infra change: exempt `googleads.googleapis.com:443` from OneCLI credential interception.~~

## Auth context (still accurate)

The collector uses **service-account JWT auth**, not OAuth2:
- Config keys: `serviceAccountEmail`, `serviceAccountKeyFile`, `developerToken`, `managerCustomerId`
- Auth flow: `google-auth-library JWT.authorize()` → bearer token minted per run
- No `login-customer-id` header — service account has direct access to all 7 accounts
- **Opteo `google-ads-api` v23 is NOT usable** with this auth — OAuth2 installed-app only.
