# Deploy runbook

Short path from zero to production for LogosHome API (Workers + D1 + R2) and web (Pages).

## 1. Prerequisites

- Cloudflare account with Workers, D1, R2, Pages enabled
- `pnpm` + Node 20+
- Copy `.env.example` → `.env` for local; production secrets go via Wrangler / Pages, not git

## 2. Create cloud resources

```bash
cd apps/api
pnpm wrangler d1 create logoshome
# → copy database_id into wrangler.production.toml

pnpm wrangler r2 bucket create logoshome-media
# → set bucket_name in wrangler.production.toml
```

Fill placeholders in `apps/api/wrangler.production.toml` (`account_id`, `database_id`, routes).

## 3. Migrate D1

```bash
cd apps/api
pnpm wrangler d1 migrations apply logoshome --remote -c wrangler.production.toml
# Local smoke: pnpm db:migrate:local
```

## 4. Secrets

```bash
cd apps/api
pnpm wrangler secret put HANDLE_PEPPER -c wrangler.production.toml
pnpm wrangler secret put KEK_MASTER -c wrangler.production.toml
pnpm wrangler secret put TURN_SECRET -c wrangler.production.toml
```

Generate long random values (≥32 chars for `KEK_MASTER`). Never commit them.

Optional non-secret vars (`ENDAO_SSO_ENABLED`, `WEREAD_SSO_ENABLED`, `TURN_URIS`) live under `[vars]` in the production toml.

## 5. Deploy API Worker

```bash
cd apps/api
pnpm wrangler deploy -c wrangler.production.toml
# Health: curl https://<worker-host>/health
```

## 6. Seed R2 sample Bible chapters

Automated local/prod-shaped seed (CUVS/CUVT/RCUV/CCB/LZZ + 口語訳/新改訳/新共同訳 John.1 scaffolds + entitlements):

```bash
# Against wrangler dev or a deployed Worker origin
bash scripts/seed-r2-chapters.sh https://api.example.com
# Expect: SEED_R2_OK
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

- [ ] D1 migrations applied remote
- [ ] `HANDLE_PEPPER`, `KEK_MASTER`, `TURN_SECRET` set
- [ ] Worker `/health` OK
- [ ] R2 sample / licensed chapters seeded
- [ ] Pages build has correct `VITE_API_BASE`
- [ ] Mobile EAS profile points at production API
