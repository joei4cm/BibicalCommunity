#!/usr/bin/env bash
# Local API smoke against wrangler dev (default http://127.0.0.1:8787)
set -euo pipefail
BASE="${1:-http://127.0.0.1:8787}"
echo "== health =="
curl -sf "$BASE/health" | head -c 200; echo
HANDLE="smoke$(date +%s)"
PASS='SmokeTestPass123!'
echo "== register =="
REG=$(curl -sf -X POST "$BASE/v1/auth/register" -H 'content-type: application/json' \
  -d "{\"handle\":\"$HANDLE\",\"password\":\"$PASS\",\"nickname\":\"Smoke\",\"locale\":\"zh-CN\"}")
TOKEN=$(echo "$REG" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
echo "token=${TOKEN:0:12}…"
AUTH="Authorization: Bearer $TOKEN"
echo "== bible translations =="
curl -sf "$BASE/v1/bible/translations" | head -c 120; echo
echo "== chapter WEB John.1 =="
curl -sf "$BASE/v1/bible/chapter?translation=web&ref=John.1" | head -c 160; echo
echo "== me =="
curl -sf -H "$AUTH" "$BASE/v1/me" | head -c 160; echo
echo "== turn credentials =="
curl -sf -X POST -H "$AUTH" -H 'content-type: application/json' -d '{}' \
  "$BASE/v1/calls/turn-credentials" | head -c 200; echo
echo "== partners status =="
curl -sf "$BASE/v1/partners/status" | head -c 200; echo
echo "SMOKE_OK"
