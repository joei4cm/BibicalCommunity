#!/usr/bin/env bash
# Bootstrap production Cloudflare Workers + D1 + R2 for LogosHome corpora.
# Without credentials: documents CORPUS_LIVE_R2_OPEN and exits 0.
#
# Required for live path:
#   CLOUDFLARE_API_TOKEN   — Workers/D1/R2 edit
#   CLOUDFLARE_ACCOUNT_ID  — account id
# Optional:
#   LIVE_API_BASE          — already-deployed Worker URL (skip deploy; seed+probe only)
#   PLATFORM_ADMIN_BOOTSTRAP_SECRET — for admin PD seed (default matches local wrangler)
#   LIVE_R2_SKIP_DEPLOY=1  — only probe/seed against LIVE_API_BASE
#
# Tokens: CORPUS_LIVE_R2_OPEN | CORPUS_LIVE_R2_OK | LIVE_R2_BOOTSTRAP_OK
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
API="$ROOT/apps/api"
CFG="$API/wrangler.production.toml"
BOOTSTRAP_SECRET="${PLATFORM_ADMIN_BOOTSTRAP_SECRET:-dev-platform-admin-bootstrap}"

echo "== live R2 bootstrap =="

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" || -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then
  echo "INFO: CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID not set"
  echo "INFO: Set those secrets, fill account_id/database_id in wrangler.production.toml,"
  echo "INFO: then re-run: bash scripts/live-r2-bootstrap.sh"
  echo "INFO: Or set LIVE_API_BASE=https://<worker> LIVE_R2=1 bash scripts/smoke-corpus-live-r2.sh"
  echo "CORPUS_LIVE_R2_OPEN"
  exit 0
fi

export CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID

if [[ -n "${LIVE_API_BASE:-}" && "${LIVE_R2_SKIP_DEPLOY:-}" == "1" ]]; then
  BASE="$LIVE_API_BASE"
  echo "INFO: using existing LIVE_API_BASE=$BASE (skip deploy)"
else
  # Refuse to deploy with YOUR_* placeholders still present.
  if rg -q 'YOUR_CLOUDFLARE_ACCOUNT_ID|YOUR_D1_DATABASE_ID' "$CFG"; then
    echo "INFO: wrangler.production.toml still has YOUR_* placeholders"
    echo "INFO: Create resources then paste IDs:"
    echo "  cd apps/api && pnpm exec wrangler d1 create logoshome"
    echo "  cd apps/api && pnpm exec wrangler r2 bucket create logoshome-media"
    echo "CORPUS_LIVE_R2_OPEN"
    exit 0
  fi

  echo "== deploy Worker (production toml) =="
  (cd "$API" && pnpm exec wrangler deploy -c wrangler.production.toml) | tee /tmp/live-r2-deploy.log
  BASE=$(rg -o 'https://[a-zA-Z0-9._-]+\.workers\.dev' /tmp/live-r2-deploy.log | head -1 || true)
  if [[ -z "$BASE" && -n "${LIVE_API_BASE:-}" ]]; then
    BASE="$LIVE_API_BASE"
  fi
  if [[ -z "$BASE" ]]; then
    echo "INFO: deploy succeeded but Worker URL not parsed — set LIVE_API_BASE and re-run with LIVE_R2_SKIP_DEPLOY=1"
    echo "CORPUS_LIVE_R2_OPEN"
    exit 0
  fi
  echo "LIVE_API_BASE=$BASE"
fi

curl -sf "$BASE/health" >/dev/null

echo "== platform admin + PD WEB seed (book Gen+John minimum; FULL=1 for 66) =="
HANDLE="livepd$(date +%s)"
REG=$(curl -sf -X POST "$BASE/v1/auth/register" -H 'content-type: application/json' \
  -d "{\"handle\":\"$HANDLE\",\"password\":\"LiveR2Pass123!\",\"nickname\":\"LiveR2\",\"locale\":\"en\"}")
TOKEN=$(echo "$REG" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
test -n "$TOKEN"
AUTH="Authorization: Bearer $TOKEN"
curl -sf -X POST -H "$AUTH" -H 'content-type: application/json' \
  -d "{\"secret\":\"$BOOTSTRAP_SECRET\"}" \
  "$BASE/v1/admin/platform/bootstrap" >/dev/null

if [[ "${FULL:-}" == "1" ]]; then
  node "$ROOT/scripts/seed-r2-pd-full.mjs" "$BASE" "$TOKEN" web
else
  for nr in 1 43; do
    curl -sf -X POST -H "$AUTH" -H 'content-type: application/json' \
      -d "{\"tid\":\"web\",\"bookNr\":$nr}" \
      "$BASE/v1/admin/corpus/pd-seed" >/dev/null
  done
  echo "LIVE_PD_SEED_PARTIAL_OK books=Gen,John (FULL=1 for canon)"
fi

echo "== live corpus probe =="
LIVE_R2=1 LIVE_API_BASE="$BASE" bash "$ROOT/scripts/smoke-corpus-live-r2.sh"
echo "LIVE_R2_BOOTSTRAP_OK"
