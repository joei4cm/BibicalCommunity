#!/usr/bin/env bash
# Non-destructive Cloudflare production deploy preflight for LogosHome API.
# Validates wrangler.production.toml structure, migration presence, and prints
# a dry-run checklist. Does not call Cloudflare APIs or mutate remote state.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API="$ROOT/apps/api"
CFG="$API/wrangler.production.toml"
MIG="$API/migrations"
fail=0

ok() { echo "OK: $*"; }
bad() { echo "FAIL: $*"; fail=1; }
info() { echo "INFO: $*"; }

echo "== LogosHome API deploy-check (non-destructive) =="
echo "root=$ROOT"
echo "config=$CFG"
echo

# ── Config file ──────────────────────────────────────────────────────────────
if [[ -f "$CFG" ]]; then
  ok "wrangler.production.toml present"
else
  bad "missing $CFG"
  echo "DEPLOY_CHECK_FAIL"
  exit 1
fi

require_line() {
  local pattern="$1"
  local label="$2"
  if rg -q -- "$pattern" "$CFG"; then
    ok "$label"
  else
    bad "$label (expected /$pattern/ in wrangler.production.toml)"
  fi
}

require_line '^name\s*=\s*"logoshome-api"' 'worker name = logoshome-api'
require_line '^main\s*=\s*"src/index\.ts"' 'main entry = src/index.ts'
require_line 'compatibility_flags\s*=\s*\["nodejs_compat"\]' 'nodejs_compat flag'
require_line 'account_id\s*=' 'account_id key present'

# Bindings
require_line 'binding\s*=\s*"DB"' 'D1 binding DB'
require_line 'database_name\s*=\s*"logoshome"' 'D1 database_name = logoshome'
require_line 'migrations_dir\s*=\s*"migrations"' 'D1 migrations_dir'
require_line 'binding\s*=\s*"MEDIA"' 'R2 binding MEDIA'
require_line 'bucket_name\s*=' 'R2 bucket_name set'
require_line 'name\s*=\s*"CALL_ROOM"' 'Durable Object binding CALL_ROOM'
require_line 'class_name\s*=\s*"CallRoomDO"' 'CallRoomDO class binding'
require_line 'new_classes\s*=\s*\["CallRoomDO"\]' 'DO migration registers CallRoomDO'

# Production vars / secret documentation
require_line 'ENVIRONMENT\s*=\s*"production"' 'ENVIRONMENT=production'
require_line 'ENDAO_SSO_ENABLED' 'partner SSO flag ENDAO_SSO_ENABLED documented'
require_line 'WEREAD_SSO_ENABLED' 'partner SSO flag WEREAD_SSO_ENABLED documented'
require_line 'PARTNER_SSO_MOCK\s*=\s*"false"' 'PARTNER_SSO_MOCK=false (prod)'
require_line 'ENDAO_OAUTH_CLIENT_ID' 'ENDAO_OAUTH_CLIENT_ID documented for real IdP'
require_line 'WEREAD_OAUTH_CLIENT_ID' 'WEREAD_OAUTH_CLIENT_ID documented for real IdP'
require_line 'PARTNER_OAUTH_REDIRECT_BASE' 'PARTNER_OAUTH_REDIRECT_BASE documented for real IdP'
require_line 'TURN_URIS' 'TURN_URIS non-secret var present'

if rg -q 'wrangler secret put HANDLE_PEPPER' "$CFG" \
  && rg -q 'wrangler secret put KEK_MASTER' "$CFG" \
  && rg -q 'wrangler secret put TURN_SECRET' "$CFG"; then
  ok "secret put docs: HANDLE_PEPPER, KEK_MASTER, TURN_SECRET"
else
  bad "production toml must document secret put for HANDLE_PEPPER, KEK_MASTER, TURN_SECRET"
fi

if rg -q 'wrangler secret put ENDAO_OAUTH_CLIENT_SECRET' "$CFG" \
  && rg -q 'wrangler secret put WEREAD_OAUTH_CLIENT_SECRET' "$CFG"; then
  ok "secret put docs: ENDAO/WEREAD_OAUTH_CLIENT_SECRET"
else
  bad "production toml must document secret put for partner OAuth client secrets"
fi

if rg -qi 'no separate JWT|opaque bearer|session token' "$CFG"; then
  ok "JWT/session model documented (opaque D1 session, no JWT secret)"
else
  bad "document session/JWT model (opaque bearer hashed in D1; no JWT secret)"
fi

# Placeholder warnings (not failures — expected until real CF resources exist)
if rg -q 'YOUR_CLOUDFLARE_ACCOUNT_ID|YOUR_D1_DATABASE_ID' "$CFG"; then
  info "placeholders still present (account_id / database_id) — replace before live deploy"
else
  ok "no YOUR_* placeholders in account_id / database_id"
fi

# Secrets must not be committed as [vars]
for secret in HANDLE_PEPPER KEK_MASTER TURN_SECRET; do
  if rg -q "^[[:space:]]*${secret}[[:space:]]*=" "$CFG"; then
    bad "$secret must not appear as a [vars] assignment in production toml (use wrangler secret put)"
  else
    ok "$secret not inlined in [vars]"
  fi
done

# ── Source / DO export ───────────────────────────────────────────────────────
if [[ -f "$API/src/index.ts" ]] && rg -q 'export \{ CallRoomDO \}' "$API/src/index.ts"; then
  ok "src/index.ts exports CallRoomDO"
else
  bad "src/index.ts must export CallRoomDO for DO binding"
fi

if [[ -f "$API/src/durable/CallRoomDO.ts" ]]; then
  ok "CallRoomDO source present"
else
  bad "missing apps/api/src/durable/CallRoomDO.ts"
fi

# ── Migrations ───────────────────────────────────────────────────────────────
if [[ -d "$MIG" ]]; then
  ok "migrations/ directory present"
else
  bad "missing $MIG"
fi

shopt -s nullglob
sqls=("$MIG"/*.sql)
shopt -u nullglob
if ((${#sqls[@]} > 0)); then
  ok "found ${#sqls[@]} SQL migration(s)"
  for f in "${sqls[@]}"; do
    echo "  - $(basename "$f")"
  done
else
  bad "no *.sql files under migrations/"
fi

for expected in 0001_init.sql 0002_groups_favorites.sql 0003_entitlements_prekeys.sql 0004_devotion_step.sql; do
  if [[ -f "$MIG/$expected" ]]; then
    ok "migration $expected"
  else
    bad "missing migration $expected"
  fi
done

if rg -q 'devotion_step' "$MIG/0004_devotion_step.sql"; then
  ok "0004 includes devotion_step column"
else
  bad "0004_devotion_step.sql must define devotion_step"
fi

# ── Supporting docs / scripts ────────────────────────────────────────────────
for f in "$ROOT/docs/DEPLOY.md" "$API/DEPLOY.md" "$ROOT/scripts/seed-r2-chapters.sh"; do
  if [[ -f "$f" ]]; then
    ok "present $(realpath --relative-to="$ROOT" "$f" 2>/dev/null || echo "$f")"
  else
    bad "missing $f"
  fi
done

echo
echo "── Dry-run checklist (manual; not executed by this script) ──"
cat <<'EOF'
  [ ] Fill account_id + D1 database_id (+ optional routes) in wrangler.production.toml
  [ ] wrangler login  (or set CLOUDFLARE_API_TOKEN with Workers/D1/R2 edit)
  [ ] wrangler d1 create logoshome   /   wrangler r2 bucket create logoshome-media
  [ ] wrangler secret put HANDLE_PEPPER -c wrangler.production.toml
  [ ] wrangler secret put KEK_MASTER    -c wrangler.production.toml
  [ ] wrangler secret put TURN_SECRET   -c wrangler.production.toml
  [ ] Confirm PARTNER_SSO_MOCK=false; SSO flags false until partner OAuth is ready
  [ ] wrangler d1 migrations apply logoshome --remote -c wrangler.production.toml
  [ ] wrangler deploy --dry-run -c wrangler.production.toml
  [ ] wrangler deploy -c wrangler.production.toml
  [ ] curl https://<worker-host>/health
  [ ] bash scripts/seed-r2-chapters.sh https://<worker-host>
  Note: sessions are opaque Bearer tokens hashed in D1 — no JWT_SECRET to set.
  Note: CALL_ROOM DO class CallRoomDO is registered via [[migrations]] tag v1.
EOF

echo
if [[ "${RUN_DEPLOY_DRY_RUN:-}" == "1" ]]; then
  echo "── Optional: wrangler deploy --dry-run (RUN_DEPLOY_DRY_RUN=1) ──"
  if (cd "$API" && pnpm exec wrangler deploy --dry-run -c wrangler.production.toml); then
    ok "wrangler deploy --dry-run succeeded (bundle + bindings resolve)"
    echo "DEPLOY_DRY_RUN_OK"
  else
    bad "wrangler deploy --dry-run failed"
  fi
fi

echo
if [[ "$fail" -ne 0 ]]; then
  echo "DEPLOY_CHECK_FAIL"
  exit 1
fi
echo "DEPLOY_CHECK_OK"
