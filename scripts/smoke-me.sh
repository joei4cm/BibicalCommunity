#!/usr/bin/env bash
# Me profile / privacy / search smoke.
set -euo pipefail
BASE="${1:-http://127.0.0.1:8787}"
PASS='SmokeTestPass123!'
TS="$(date +%s)"

echo "== me smoke: register A (discoverable) + B =="
REG_A=$(curl -sf -X POST "$BASE/v1/auth/register" -H 'content-type: application/json' \
  -d "{\"handle\":\"mea${TS}\",\"password\":\"$PASS\",\"nickname\":\"MeA\",\"locale\":\"en\"}")
REG_B=$(curl -sf -X POST "$BASE/v1/auth/register" -H 'content-type: application/json' \
  -d "{\"handle\":\"meb${TS}\",\"password\":\"$PASS\",\"nickname\":\"MeB\",\"locale\":\"zh\"}")
TOKEN_A=$(echo "$REG_A" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
TOKEN_B=$(echo "$REG_B" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
UID_A=$(echo "$REG_A" | sed -n 's/.*"uid":"\([^"]*\)".*/\1/p')
test -n "$TOKEN_A" && test -n "$TOKEN_B" && test -n "$UID_A"

echo "== me smoke: GET /v1/me =="
ME=$(curl -sf -H "Authorization: Bearer $TOKEN_A" "$BASE/v1/me")
echo "$ME" | grep -q "\"uid\":\"$UID_A\""
echo "$ME" | grep -q '"privacy"'
echo "ME_PROFILE_OK"

echo "== me smoke: search by UID when discoverable =="
# Ensure discoverableByUid true
curl -sf -X PATCH -H "Authorization: Bearer $TOKEN_A" -H 'content-type: application/json' \
  -d '{"privacy":{"discoverableByUid":true,"discoverableByHandle":true}}' \
  "$BASE/v1/me" | grep -q '"ok":true'
HIT=$(curl -sf -H "Authorization: Bearer $TOKEN_B" "$BASE/v1/me/search?q=$UID_A")
echo "$HIT" | head -c 200; echo
echo "$HIT" | grep -q "\"uid\":\"$UID_A\""
echo "$HIT" | grep -q '"nickname"'
echo "ME_SEARCH_OK"

echo "== me smoke: privacy hides UID search =="
curl -sf -X PATCH -H "Authorization: Bearer $TOKEN_A" -H 'content-type: application/json' \
  -d '{"privacy":{"discoverableByUid":false}}' \
  "$BASE/v1/me" | grep -q '"ok":true'
MISS=$(curl -sf -H "Authorization: Bearer $TOKEN_B" "$BASE/v1/me/search?q=$UID_A")
echo "$MISS" | grep -q '"results":\[\]'
echo "ME_PRIVACY_HIDE_OK"

echo "== me smoke: theme + locale patch =="
curl -sf -X PATCH -H "Authorization: Bearer $TOKEN_A" -H 'content-type: application/json' \
  -d '{"theme":"night","locale":"ja"}' \
  "$BASE/v1/me" | grep -q '"ok":true'
ME2=$(curl -sf -H "Authorization: Bearer $TOKEN_A" "$BASE/v1/me")
echo "$ME2" | grep -q '"theme":"night"'
echo "$ME2" | grep -q '"locale":"ja"'
echo "ME_THEME_LOCALE_OK"

echo "ME_SMOKE_OK"
