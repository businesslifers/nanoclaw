---
title: OneCLI Proxy gRPC/h2 Break — June 2026
scope: group
created: 2026-06-05
updated: 2026-06-05
---

# OneCLI Proxy gRPC/h2 Break (Jun 3–4 2026)

## What happened

Starting **Jun 3 2026**, all 7 Google Ads accounts failed collection with:

```
14 UNAVAILABLE: No connection established. Last error: ...SSL routines:ssl3_read_bytes:tlsv1 alert no application protocol...:SSL alert number 120
```

Affected periods: yesterday, MTD, prevMonth — every query, after 2 retries.

## Root cause (confirmed via diagnostic)

The **OneCLI proxy (`host.docker.internal:10255`) performs full TLS MITM interception** for all outbound HTTPS traffic. When it re-establishes the TLS connection to Google, it only advertises `http/1.1` in the ALPN extension — not `h2`.

- **Direct to Google (no proxy):** `ALPN server accepted h2` ✅
- **Via proxy:** `ALPN server accepted http/1.1` ❌, certificate issued by `CN=OneCLI Local Gateway CA; O=OneCLI`

The `google-ads-node` gRPC client requires `h2` (gRPC is HTTP/2 only). When the proxy returns `http/1.1`, the gRPC client fires SSL alert 120 (`no_application_protocol`).

**Why Jun 3:** Almost certainly a proxy update or config change that switched from raw CONNECT tunnelling to active TLS interception.

## Fix applied (transport layer)

Replaced `google-ads-node` gRPC client with a direct REST `fetch` call in `collector.mjs`. All 6 `queryAds()` call sites untouched; only the function body changed.

Key details:
- Endpoint: `POST https://googleads.googleapis.com/v23/customers/{id}/googleAds:searchStream`
- Headers: `Authorization: Bearer <token>`, `developer-token`, `login-customer-id` (digits only, strip dashes)
- **camelCase → snake_case normalisation required**: REST API returns camelCase; existing consumers expect snake_case. Solved with a recursive `toSnakeCase()` helper applied to each row.
- Removed dead imports: `google-gax`, `google-ads-node`. Guarded stale `adsClient.close()` call.

## Second blocker encountered (proxy credential injection)

After the REST fix, every account returned:

```
403: {"error":"credential_not_found","message":"No credentials configured for googleads.googleapis.com in OneCLI..."}
```

The proxy is also configured to **intercept credential injection** for `googleads.googleapis.com`. It refuses to forward the app's `Authorization: Bearer` header; it wants its own managed credential.

**This is incompatible with service-account JWT auth**, which mints a rotating token (~1hr TTL) at runtime via `google-auth-library JWT.authorize()`. A static OneCLI credential would expire immediately.

**No app-side workaround exists.** The `secret_url` in the error only offers `create=generic` (static credential), not passthrough.

## Required infra change (outstanding as of 2026-06-05)

> **Exempt `googleads.googleapis.com:443` from OneCLI credential interception** — pass the `Authorization: Bearer …` header through unchanged.

Once this is applied, the REST transport fix is fully green end-to-end.

## Auth context

The collector uses **service-account JWT auth**, not OAuth2:
- Config keys: `serviceAccountEmail`, `serviceAccountKeyFile`, `developerToken`, `managerCustomerId`
- Auth flow: `google-auth-library JWT.authorize()` → bearer token minted per run
- **Opteo `google-ads-api` v23 is NOT usable** with this auth — it requires `client_id`/`client_secret`/`refresh_token` (OAuth2 installed-app only). No service-account or pre-minted token path.

## Library notes

- `google-ads-node` (Google official): pure gRPC, no REST mode, h2 required.
- `google-ads-api` v23 (Opteo): REST for queries since v20.0.1, but OAuth2-only auth.
- `google-gax` `{ fallback: 'rest' }`: uncertain — depends on whether generated client includes REST descriptors. Not tested; skipped in favour of direct fetch.
