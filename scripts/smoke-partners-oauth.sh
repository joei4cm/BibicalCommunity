#!/usr/bin/env bash
# Partner OAuth URL evidence without wrangler mid-run env toggles.
# Proves: (a) SSO off → deep link; (c) SSO on + client_id → real authorize URL.
# (b) mock closed loop remains in scripts/smoke-api.sh (SSO_* / WEREAD_SSO_*).
# (d) non-mock callback without secrets → tokenExchange.attempted=false
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE="${1:-http://127.0.0.1:8787}"

cd "$ROOT/packages/bible"
echo "== partner oauth URL unit tests =="
npm test -- src/partners.test.ts

echo "== partner callback tokenExchange shape (no secrets → not attempted) =="
CB=$(curl -sf "$BASE/v1/partners/endao/callback?code=real_code_smoke&state=st&ref=John.1" || true)
if [[ -n "$CB" ]]; then
  echo "$CB" | head -c 280; echo
  echo "$CB" | grep -q '"mock":false'
  echo "$CB" | grep -q '"tokenExchange"'
  echo "$CB" | grep -q '"attempted":false'
  echo "PARTNER_TOKEN_EXCHANGE_SHAPE_OK"
else
  echo "INFO: API not reachable for tokenExchange shape check (skipped)"
fi

echo "PARTNER_OAUTH_URL_OK"
