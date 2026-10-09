# Deploy runbook

Short path from zero to production for LogosHome API (Workers + D1 + R2 + CallRoom DO) and web (Pages).

API-focused readiness notes (dry-run / blockers): [`apps/api/DEPLOY.md`](../apps/api/DEPLOY.md).

## GitHub Actions (recommended)

Workflow: [`.github/workflows/deploy-cloudflare.yml`](../.github/workflows/deploy-cloudflare.yml)

### Required repository secrets

| Secret | Purpose |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Workers / D1 / R2 / Pages edit |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account id |

### Optional repository secrets (synced onto the Worker when set)

| Secret | Purpose |
| --- | --- |
| `HANDLE_PEPPER` | Auth handle hashing |
| `KEK_MASTER` | Field encryption (≥32 chars) |
| `TURN_SECRET` | TURN HMAC |
| `PLATFORM_ADMIN_BOOTSTRAP_SECRET` | One-time platform admin bootstrap |

Without the optional Worker secrets, deploy still succeeds, but login/crypto/TURN will fail until you add them (Actions re-run syncs them, or use `wrangler secret put`).

### What the workflow does

1. `scripts/cf-prepare-prod-config.sh` — create/find D1 `logoshome` + R2 `logoshome-media`, write `wrangler.production.ci.toml` (gitignored)
2. Remote D1 migrations
3. `wrangler deploy` API Worker
4. Sync optional Worker secrets
5. Health check `/health`
6. Build web with `VITE_API_BASE=<worker>` and `wrangler pages deploy` → `logoshome-web`

Trigger: **Actions → Deploy Cloudflare → Run workflow**, or push to `main`.

Local equivalent (with the same two env vars):

```bash
export CLOUDFLARE_API_TOKEN=…
export CLOUDFLARE_ACCOUNT_ID=…
bash scripts/cf-prepare-prod-config.sh
# Expect: CF_PREPARE_OK
```

## 0. Preflight (local, non-destructive)

```bash
bash scripts/deploy-check.sh
# Expect: DEPLOY_CHECK_OK
```

## 1. Prerequisites

- Cloudflare account with Workers, D1, R2, Durable Objects, Pages enabled
- `pnpm` + Node 20+
- Copy `.env.example` → `.env` for local; production secrets go via Wrangler / Pages / GitHub Actions secrets, not git

## 2. Create cloud resources

**Prefer CI:** the Deploy Cloudflare workflow provisions D1 + R2 automatically via `cf-prepare-prod-config.sh`.

Manual:

```bash
cd apps/api
pnpm wrangler d1 create logoshome
# → copy database_id into wrangler.production.toml

pnpm wrangler r2 bucket create logoshome-media
# → set bucket_name in wrangler.production.toml
```

Fill placeholders in `apps/api/wrangler.production.toml` (`account_id`, `database_id`, routes) — or rely on the generated `wrangler.production.ci.toml` from the prepare script.

## 3. Migrate D1

```bash
cd apps/api
pnpm wrangler d1 migrations apply logoshome --remote -c wrangler.production.toml
# Local smoke: pnpm db:migrate:local
```

## 4. Secrets & session model

```bash
cd apps/api
pnpm wrangler secret put HANDLE_PEPPER -c wrangler.production.toml
pnpm wrangler secret put KEK_MASTER -c wrangler.production.toml
pnpm wrangler secret put TURN_SECRET -c wrangler.production.toml
# Optional Cloudflare Calls TURN (preferred real relay):
# pnpm wrangler secret put TURN_CF_KEY_ID -c wrangler.production.toml
# pnpm wrangler secret put TURN_CF_API_TOKEN -c wrangler.production.toml
```

Generate long random values (≥32 chars for `KEK_MASTER`). Never commit them.

**Sessions / JWT:** Auth uses opaque Bearer session tokens hashed in D1 (`sessions.token_hash`). There is **no** `JWT_SECRET` (or similar) to configure. Identity hashing uses `HANDLE_PEPPER`; field encryption uses `KEK_MASTER`.

**Bindings (must exist in production toml):** `DB` (D1), `MEDIA` (R2), `CALL_ROOM` → `CallRoomDO`.

**Calls / TURN:** Set `TURN_URIS` to include `turn:` / `turns:` hosts (with matching `TURN_SECRET` for coturn HMAC), **or** set `TURN_CF_KEY_ID` + `TURN_CF_API_TOKEN` for Cloudflare Calls TURN. STUN-only configs work for LAN/same-NAT demos but fail on many mobile networks.

Non-secret `[vars]`: `ENDAO_SSO_ENABLED`, `WEREAD_SSO_ENABLED`, `PARTNER_SSO_MOCK` (must be `"false"` in production), `TURN_URIS`. For real partner authorize URLs also set `ENDAO_OAUTH_CLIENT_ID` / `WEREAD_OAUTH_CLIENT_ID` and `PARTNER_OAUTH_REDIRECT_BASE` (see `wrangler.production.toml` comments). Keep partner SSO flags false until real OAuth client credentials and token exchange are wired.

## 5. Deploy API Worker

```bash
cd apps/api
pnpm wrangler deploy -c wrangler.production.toml
# Health: curl https://<worker-host>/health
```

## 6. Seed R2 Bible corpora (download path — not TypeScript)

Teaching-set fixtures (boot defaults + peers):

```bash
# Against wrangler dev or a deployed Worker origin
bash scripts/seed-r2-chapters.sh https://api.example.com
# Expect: SEED_R2_OK
```

**Public-domain full WEB** (getbible → R2 via platform admin; clients page-download into local DB):

```bash
# One-shot when CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID are set
# (and wrangler.production.toml placeholders replaced):
bash scripts/live-r2-bootstrap.sh
# Expect: CORPUS_LIVE_R2_OK / LIVE_R2_BOOTSTRAP_OK  — or CORPUS_LIVE_R2_OPEN if secrets missing

# Against an already-deployed Worker:
LIVE_R2=1 LIVE_API_BASE=https://api.example.com LIVE_R2_SKIP_DEPLOY=1 bash scripts/live-r2-bootstrap.sh
# Or seed only: bootstrap platform_admin then
#   node scripts/seed-r2-pd-full.mjs https://api.example.com "$TOKEN" web
```

**Cursor Cloud / CI secrets required for `CORPUS_LIVE_R2_OK` (production account — not wrangler `--temporary`):**

| Secret | Purpose |
|--------|---------|
| `CLOUDFLARE_API_TOKEN` | Workers + D1 + R2 edit (R2 write required) |
| `CLOUDFLARE_ACCOUNT_ID` | Account id pasted into `wrangler.production.toml` |

Also replace `YOUR_CLOUDFLARE_ACCOUNT_ID` / `YOUR_D1_DATABASE_ID` in `apps/api/wrangler.production.toml`, create the R2 bucket `logoshome-media`, then re-run `bash scripts/live-r2-bootstrap.sh`. Temporary/preview accounts cannot create R2 buckets (API auth 10000).

**Live-shaped partner IdP (authorize URL hosts, no mock):**

```bash
bash scripts/run-live-idp-probe.sh
# Expect: PARTNER_LIVE_IDP_OK (+ PARTNER_LIVE_TOKEN_EXCHANGE_OPEN until real client secrets exist)
```

See also `apps/api/scripts/seed-r2-sample.md` for the MEDIA object key format. Licensed full corpora require entitlement grants and publisher contracts — samples are demos only.

## 7. Deploy web (Cloudflare Pages)

```bash
# Set VITE_API_BASE to the Worker origin before build
export VITE_API_BASE=https://api.example.com
pnpm --filter @logoshome/web build
npx wrangler pages deploy apps/web/dist --project-name=logoshome-web
```

Details: `apps/web/pages.md`.

## 8. Mobile (EAS note)

`apps/mobile` is Expo. Store binaries use [EAS Build](https://docs.expo.dev/build/introduction/):

```bash
cd apps/mobile
npx eas-cli login
npx eas build --platform all
```

Point the app’s API base at the production Worker (env / `app.json` extra). Local `expo start` is enough for development; EAS is for TestFlight / Play tracks.

## Checklist

- [ ] `bash scripts/deploy-check.sh` → `DEPLOY_CHECK_OK`
- [ ] Placeholders replaced (`account_id`, `database_id`)
- [ ] D1 migrations applied remote
- [ ] `HANDLE_PEPPER`, `KEK_MASTER`, `TURN_SECRET` set (no JWT secret)
- [ ] `PARTNER_SSO_MOCK=false`; SSO flags off until partners ready
- [ ] Bindings live: `DB`, `MEDIA`, `CALL_ROOM`
- [ ] Worker `/health` OK
- [ ] R2 sample / licensed chapters seeded
- [ ] Pages build has correct `VITE_API_BASE`
- [ ] Mobile EAS profile points at production API
