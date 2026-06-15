---
type: topic
created: 2026-06-05
updated: 2026-06-05
related:
  - wiki/topics/reporting-pipeline.md
  - wiki/concepts/collector-data-schema.md
---

# Google Ads Collector — proxy h2/gRPC break (Jun 2026)

Ongoing incident. The daily collector started failing for **all 7 accounts** on **Jun 3 2026** and continued Jun 4. Root cause diagnosed by the collector lane Jun 5.

## Symptom
Every account, every period (yesterday / MTD / prevMonth), after retries:
```
14 UNAVAILABLE: No connection established. Last error:
...SSL routines:ssl3_read_bytes:tlsv1 alert no application protocol... SSL alert number 120
```

## Root cause
The **OneCLI proxy began doing TLS MITM interception** (cert `CN=OneCLI Local Gateway CA; O=OneCLI`, injected via `SSL_CERT_FILE=/tmp/onecli-combined-ca.pem`). On its re-connection to Google it advertises only `http/1.1` in ALPN, never `h2`. `google-ads-node` uses gRPC over HTTP/2 and only offers `h2`, so ALPN negotiation fails → SSL alert 120 (`no_application_protocol`) → connection torn down.

Decisive test: direct connection to `googleads.googleapis.com:443` negotiates `h2` fine; via proxy it negotiates only `http/1.1`. Started Jun 3, almost certainly a proxy change from raw CONNECT tunnelling to active interception.

**Not** a credential issue, **not** a Google API change, **not** fixable by retrying.

## Fix options
1. **Infra (correct fix):** exempt `googleads.googleapis.com:443` from TLS interception (pass-through CONNECT for gRPC hosts). Low effort, admin/infra.
2. **Infra:** upgrade proxy to support h2 ALPN in its interception path. Medium effort.
3. **App-side (fastest unblock):** switch `google-ads-node` to REST transport (`rest` option in client constructor) — drops the gRPC/h2 dependency. Small code change on our side.

## Status
- 2026-06-05: relayed to channel (msg 137), awaiting decision on infra exemption vs REST workaround. Pipeline blocked until resolved.
- 2026-06-05 (later): applied the app-side REST workaround in `collector.mjs` (collector lane drafted, Janet applied — lanes are filesystem-isolated). Rewrote the single `queryAds()` wrapper to call the Google Ads REST endpoint (`POST /v23/customers/{id}/googleAds:searchStream`) with the existing service-account bearer + developer-token, added a `toSnakeCase()` normaliser (REST returns camelCase, all downstream readers use proto snake_case), dropped the `google-gax`/`google-ads-node` imports, and guarded the now-absent `adsClient.close()`. Backup at `collector.mjs.bak-20260605`.
- **Result:** the gRPC/h2 SSL-alert-120 failure is GONE (transport now works). But a *deeper* wall surfaced: the OneCLI proxy now intercepts `googleads.googleapis.com` on the application layer and returns `403 credential_not_found` ("No credentials configured for googleads.googleapis.com in OneCLI"), refusing to pass our own service-account bearer through. All 7 accounts blocked. The proxy offers a generic-connection `secret_url` connect link, but it injects a *static* credential, which does not fit our per-run rotating service-account token.
- **Conclusion:** the app-side change was necessary but not sufficient. The correct fix is now firmly the *infra host-exemption* (Fix option 1): exempt `googleads.googleapis.com` from OneCLI interception so our own auth reaches Google. Awaiting admin/infra action.
- **2026-06-12 update:** STILL UNRESOLVED. The `403 credential_not_found` wall has now failed every daily collector run from Jun 7 through Jun 12 — 6 consecutive days, 0/7 accounts succeeding each run. No infra host-exemption applied yet. Channel re-escalated to admin (Adam / Raels) on each failure. Pipeline remains fully blocked; analyst/reporter skipped throughout.

## Related open issue (separate)
**May 31 month-end date bug:** on the last day of a month the collector computed MTD start as the *next* month's 1st (e.g. start `2026-06-01`, end `2026-05-31`) → GA4 rejected the range, all 7 accounts failed May 31. Self-cleared Jun 1. Will recur every month-end until the MTD start-date logic is fixed.
