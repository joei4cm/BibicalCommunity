# LogosHome API — Cloudflare deploy readiness

Worker + D1 (`DB`) + R2 (`MEDIA`) + Durable Object (`CALL_ROOM` → `CallRoomDO`).

Full product runbook: [`docs/DEPLOY.md`](../../docs/DEPLOY.md).

## Preflight (no Cloudflare credentials)

```bash
# from repo root
bash scripts/deploy-check.sh
# Expect: DEPLOY_CHECK_OK
```

Validates `wrangler.production.toml` structure, bindings, secret documentation, and SQL migrations. Non-destructive.

## Config

| Item | Value |
|------|--------|
| Config | `wrangler.production.toml` |
| Worker name | `logoshome-api` |
| Bindings | `DB` (D1), `MEDIA` (R2), `CALL_ROOM` (DO → `CallRoomDO`) |
| Secrets | `HANDLE_PEPPER`, `KEK_MASTER`, `TURN_SECRET` via `wrangler secret put` |
| Session auth | Opaque Bearer tokens hashed in D1 — **no JWT secret** |
| Partner SSO | `ENDAO_SSO_ENABLED` / `WEREAD_SSO_ENABLED` vars; keep `PARTNER_SSO_MOCK=false` |

Placeholders `YOUR_CLOUDFLARE_ACCOUNT_ID` and `YOUR_D1_DATABASE_ID` must be replaced before a live deploy.

## Wrangler dry-run (this environment)

```bash
cd apps/api
pnpm exec wrangler deploy --dry-run -c wrangler.production.toml
```

**Status (Cloud Agent):**

| Check | Result |
|-------|--------|
| `wrangler whoami` | Not authenticated (no login / `CLOUDFLARE_API_TOKEN`) |
| `wrangler deploy --dry-run -c wrangler.production.toml` | **Succeeded** — bundled ~473 KiB (gzip ~93 KiB); bindings listed: `CALL_ROOM`, `DB`, `MEDIA` + production vars |
| Live `wrangler deploy` / remote D1 / secret put | **Blocked** until Cloudflare credentials + real resource IDs |

Dry-run only validates the Worker bundle and config shape; it does not create resources or upload.

## Live deploy blockers

1. Cloudflare auth (`wrangler login` or API token with Workers, D1, R2, DO edit)
2. Real `account_id` + D1 `database_id` (and R2 bucket) in production toml — still `YOUR_*` placeholders
3. Secrets set remotely: `HANDLE_PEPPER`, `KEK_MASTER`, `TURN_SECRET`
4. Remote D1 migrations applied
5. Optional: custom route / zone; R2 chapter seed via `scripts/seed-r2-chapters.sh`
