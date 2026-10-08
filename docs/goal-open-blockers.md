# Goal OPEN blockers — close checklist

Authoritative remaining gates from `bash scripts/smoke-goal-open-gates.sh`
(`GOAL_OPEN_GATES_OK remaining=4`). Each row is **blocked on external input**;
local scaffolds/smokes already exist and must not be re-invented as PASS.

| Gate token | What “OK” requires | What to provide | Close command |
|------------|--------------------|-----------------|---------------|
| `CORPUS_LIVE_R2_OPEN` → `CORPUS_LIVE_R2_OK` | Production Cloudflare account with Workers + D1 + R2; Worker deployed; PD corpus seeded; live catalog probe | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`; fill `apps/api/wrangler.production.toml` `account_id` + D1 `database_id` (no `YOUR_*`) | `bash scripts/live-r2-bootstrap.sh` then expect `LIVE_R2_BOOTSTRAP_OK` / `CORPUS_LIVE_R2_OK` |
| `PARTNER_LIVE_IDP_OPEN` → `PARTNER_LIVE_IDP_OK` | Real Endao / WeRead OAuth authorize + token hosts (not `mock-authorize` / `mock-token`) | Live partner client ids/secrets; set Worker vars `ENDAO_OAUTH_*` / `WEREAD_OAUTH_*` to real IdP URLs; `PARTNER_SSO_MOCK=false` | `PARTNER_LIVE_IDP=1 bash scripts/smoke-partner-live-idp.sh <LIVE_API_BASE>` |
| `DEVICE_HANDSET_E2E_OPEN` → `DEVICE_HANDSET_E2E_OK` | Physical phone (or USB-attached handset) running Expo/web product chat + crypto path | Device + USB/network for agent; or attach CI device farm | Extend `scripts/smoke-device-crypto.sh` / handset runbook once device is available. **Handset-shaped Playwright already PASS** (`DEVICE_HANDSET_SHAPED_OK`) |
| `LIBSIGNAL_WORKERS_OPEN` → `LIBSIGNAL_WORKERS_OK` | Official `@signalapp/libsignal-client` on Workers/browser (WASM or Workers-native) | **Upstream Signal product** — Signal documents no web/WASM build of modern libsignal-client. Product Workers **default** remains **X25519**. Opt-in OpenE2EE product client: `createProductSignalClient("opene2ee")` / `LOGOSHOME_SIGNAL_BACKEND=opene2ee` (`LIBSIGNAL_OPENE2EE_PRODUCT_OK`) plus PQXDH/msg probes (`LIBSIGNAL_OPENE2EE_PQXDH_OK` / `LIBSIGNAL_OPENE2EE_MSG_OK`) — candidate protocol, **not** official / not wire-compatible | Re-run `bash scripts/smoke-libsignal-workers.sh`; flip product default to OpenE2EE only via explicit product decision; official OK still needs Signal WASM |

## Already evidenced (do not regress)

- Corpora: whole-Bible download → local DB; boot `cuvs`+`nasb`; no TS verse packs
- WeDevote-shaped reader: `/app/bible/{tid}/{book}/{chapter}` continuous prose
- Partner **local** token exchange: `PARTNER_TOKEN_EXCHANGE_OK`
- Node native PQXDH: `LIBSIGNAL_NATIVE_ROUNDTRIP_OK` / `LIBSIGNAL_NATIVE_NODE_OK`
- Workers-portable crypto fallback: `LIBSIGNAL_WORKERS_FALLBACK_OK` (x25519 + webcrypto + product)
- OpenE2EE Workers-shaped PQXDH peer match + AES-GCM msg: `LIBSIGNAL_OPENE2EE_PQXDH_OK` / `LIBSIGNAL_OPENE2EE_MSG_OK`
- OpenE2EE opt-in product SignalClient (Kyber bundle + peer roundtrip): `LIBSIGNAL_OPENE2EE_PRODUCT_OK`

## Why these stay OPEN in CI

Cloud Agent / PR CI has no Cloudflare production token, no partner IdP client secrets,
no physical handset, and Signal does not publish an official Workers/browser libsignal.
Temporary `wrangler deploy --temporary` preview accounts **cannot** create R2 buckets
(auth 10000) — production account token is mandatory for `CORPUS_LIVE_R2_OK`.
