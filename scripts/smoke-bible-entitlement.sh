#!/usr/bin/env bash
# Prove bible entitlement grant/list path for licensed R2 translations.
set -euo pipefail
BASE="${1:-http://127.0.0.1:8787}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

curl -sf "$BASE/health" >/dev/null

HANDLE="ent$(date +%s)"
REG=$(curl -sf -X POST "$BASE/v1/auth/register" -H 'content-type: application/json' \
  -d "{\"handle\":\"$HANDLE\",\"password\":\"EntPass12345!\",\"nickname\":\"Ent\",\"locale\":\"zh\"}")
TOKEN=$(echo "$REG" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
test -n "$TOKEN"
AUTH="Authorization: Bearer $TOKEN"

# Local development skips licensed entitlement on chapter reads.
CH=$(curl -sf "$BASE/v1/bible/chapter?translation=cuvs&ref=John.1")
echo "$CH" | grep -qE '"source":"(r2|local)"'
echo "BIBLE_ENTITLEMENT_DEV_SKIP_OK"

GRANT=$(curl -sf -X POST "$BASE/v1/bible/entitlements" -H "$AUTH" -H 'content-type: application/json' \
  -d '{"translationId":"cuvs"}')
echo "$GRANT" | grep -q '"translationId":"cuvs"'
echo "$GRANT" | grep -qE '"grantedAt":[0-9]+'

AGAIN=$(curl -sf -X POST "$BASE/v1/bible/entitlements" -H "$AUTH" -H 'content-type: application/json' \
  -d '{"translationId":"cuvs"}')
echo "$AGAIN" | grep -q '"alreadyGranted":true'

LIST=$(curl -sf -H "$AUTH" "$BASE/v1/bible/entitlements")
echo "$LIST" | grep -q '"translationId":"cuvs"'

# Also grant a ja licensed id used by multi-R2 corpus path.
curl -sf -X POST "$BASE/v1/bible/entitlements" -H "$AUTH" -H 'content-type: application/json' \
  -d '{"translationId":"kougo"}' >/dev/null
LIST2=$(curl -sf -H "$AUTH" "$BASE/v1/bible/entitlements")
echo "$LIST2" | grep -q '"translationId":"kougo"'

echo "BIBLE_ENTITLEMENT_GRANT_OK translations=cuvs,kougo"
