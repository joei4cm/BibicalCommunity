#!/usr/bin/env bash
# Church Home path smoke: create church, board post, verify member, group, chat archive.
# Can be called from smoke-api.sh (reuses TOKEN/PEER/CID) or standalone against a live API.
set -euo pipefail
BASE="${1:-${BASE:-http://127.0.0.1:8787}}"
PASS="${SMOKE_PASS:-SmokeTestPass123!}"

if [[ -z "${TOKEN:-}" ]]; then
  HANDLE="homesmoke$(date +%s)"
  REG=$(curl -sf -X POST "$BASE/v1/auth/register" -H 'content-type: application/json' \
    -d "{\"handle\":\"$HANDLE\",\"password\":\"$PASS\",\"nickname\":\"HomeSmoke\",\"locale\":\"en\"}")
  TOKEN=$(echo "$REG" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
  test -n "$TOKEN"
fi
AUTH="Authorization: Bearer $TOKEN"

if [[ -z "${PEER:-}" ]]; then
  H2="homepeer$(date +%s)"
  REG2=$(curl -sf -X POST "$BASE/v1/auth/register" -H 'content-type: application/json' \
    -d "{\"handle\":\"$H2\",\"password\":\"$PASS\",\"nickname\":\"HomePeer\",\"locale\":\"en\"}")
  PEER=$(echo "$REG2" | sed -n 's/.*"userId":"\([^"]*\)".*/\1/p')
  TOKEN2=$(echo "$REG2" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
  test -n "$PEER"
  test -n "$TOKEN2"
fi
AUTH2="Authorization: Bearer ${TOKEN2:?TOKEN2 required when PEER is set without TOKEN2}"

echo "== home create church =="
SLUG="smoke-church-$(date +%s)"
CHURCH=$(curl -sf -X POST -H "$AUTH" -H 'content-type: application/json' \
  -d "{\"name\":\"Smoke Church\",\"slug\":\"$SLUG\",\"securityMode\":\"standard\"}" \
  "$BASE/v1/home/churches")
echo "$CHURCH" | head -c 200; echo
CHURCH_ID=$(echo "$CHURCH" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
test -n "$CHURCH_ID"
echo "$CHURCH" | grep -q '"role":"admin"'
echo "HOME_CHURCH_OK"

echo "== home create board post (notice + general) =="
POST=$(curl -sf -X POST -H "$AUTH" -H 'content-type: application/json' \
  -d "{\"churchId\":\"$CHURCH_ID\",\"board\":\"notice\",\"title\":\"Smoke notice\",\"body\":\"Hello church\"}" \
  "$BASE/v1/home/posts")
echo "$POST" | head -c 120; echo
echo "$POST" | grep -q '"id":"post_'
POST_ID=$(echo "$POST" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
LIST=$(curl -sf -H "$AUTH" "$BASE/v1/home/${CHURCH_ID}/posts?board=notice")
echo "$LIST" | grep -q "$POST_ID"
GPOST=$(curl -sf -X POST -H "$AUTH" -H 'content-type: application/json' \
  -d "{\"churchId\":\"$CHURCH_ID\",\"board\":\"general\",\"title\":\"Smoke general\",\"body\":\"General board\"}" \
  "$BASE/v1/home/posts")
echo "$GPOST" | grep -q '"id":"post_'
GLIST=$(curl -sf -H "$AUTH" "$BASE/v1/home/${CHURCH_ID}/posts?board=general")
echo "$GLIST" | grep -q "$(echo "$GPOST" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')"
echo "HOME_POST_OK"

echo "== home peer join + verify member =="
JOIN=$(curl -sf -X POST -H "$AUTH2" -H 'content-type: application/json' -d '{}' \
  "$BASE/v1/home/churches/${CHURCH_ID}/join")
echo "$JOIN" | head -c 160; echo
echo "$JOIN" | grep -q '"role":"member"'
VERIFY=$(curl -sf -X POST -H "$AUTH" -H 'content-type: application/json' \
  -d "{\"churchId\":\"$CHURCH_ID\",\"userId\":\"$PEER\"}" \
  "$BASE/v1/home/members/verify")
echo "$VERIFY" | head -c 160; echo
echo "$VERIFY" | grep -q '"verified":true'
CHLIST=$(curl -sf -H "$AUTH2" "$BASE/v1/home/churches")
echo "$CHLIST" | grep -q "$CHURCH_ID"
echo "$CHLIST" | grep -q '"verified":true'
echo "HOME_VERIFY_OK"

echo "== home patch security → hostile =="
SEC=$(curl -sf -X PATCH -H "$AUTH" -H 'content-type: application/json' \
  -d '{"securityMode":"hostile"}' \
  "$BASE/v1/home/churches/${CHURCH_ID}/security")
echo "$SEC" | head -c 160; echo
echo "$SEC" | grep -q '"securityMode":"hostile"'
ME_AFTER=$(curl -sf -H "$AUTH2" "$BASE/v1/me")
echo "$ME_AFTER" | grep -q '"discoverableByHandle":false'
echo "HOME_SECURITY_PATCH_OK"

echo "== home create group =="
GROUP=$(curl -sf -X POST -H "$AUTH" -H 'content-type: application/json' \
  -d "{\"churchId\":\"$CHURCH_ID\",\"name\":\"Smoke Group\"}" \
  "$BASE/v1/home/groups")
echo "$GROUP" | head -c 160; echo
echo "$GROUP" | grep -q '"id":"grp_'
echo "HOME_GROUP_OK"

echo "== chat conversation archive =="
if [[ -z "${CID:-}" ]]; then
  CONVO=$(curl -sf -X POST "$BASE/v1/chat/conversations" -H "$AUTH" -H 'content-type: application/json' \
    -d "{\"kind\":\"dm\",\"memberIds\":[\"$PEER\"]}")
  CID=$(echo "$CONVO" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
  test -n "$CID"
fi
ARCH=$(curl -sf -X PATCH -H "$AUTH" -H 'content-type: application/json' \
  -d '{"archived":true}' \
  "$BASE/v1/chat/conversations/${CID}")
echo "$ARCH" | head -c 200; echo
echo "$ARCH" | grep -q '"archived":true'
echo "HOME_ARCHIVE_OK"

echo "== hostile church privacy floors =="
HSLUG="hostile-$(date +%s)"
HCH=$(curl -sf -X POST -H "$AUTH" -H 'content-type: application/json' \
  -d "{\"name\":\"Hostile Church\",\"slug\":\"$HSLUG\",\"securityMode\":\"hostile\"}" \
  "$BASE/v1/home/churches")
HCH_ID=$(echo "$HCH" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
test -n "$HCH_ID"
curl -sf -X POST -H "$AUTH2" -H 'content-type: application/json' -d '{}' \
  "$BASE/v1/home/churches/${HCH_ID}/join" >/dev/null
ME2=$(curl -sf -H "$AUTH2" "$BASE/v1/me")
echo "$ME2" | grep -q '"discoverableByHandle":false'
echo "$ME2" | grep -q '"allowMessageRequests":"admin-approved"'
echo "HOME_HOSTILE_OK"

echo "== self wipe + wipeToken ack =="
ME=$(curl -sf -H "$AUTH" "$BASE/v1/me")
SELF=$(echo "$ME" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
WIPE=$(curl -sf -X POST -H "$AUTH" -H 'content-type: application/json' \
  -d "{\"userId\":\"$SELF\",\"reasonCode\":\"self\"}" \
  "$BASE/v1/admin/wipe")
echo "$WIPE" | head -c 200; echo
WID=$(echo "$WIPE" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
WTOK=$(echo "$WIPE" | sed -n 's/.*"wipeToken":"\([^"]*\)".*/\1/p')
test -n "$WID" && test -n "$WTOK"
ACK=$(curl -sf -X POST -H 'content-type: application/json' \
  -d "{\"wipeToken\":\"$WTOK\"}" \
  "$BASE/v1/admin/wipe/${WID}/ack")
echo "$ACK" | grep -q '"ok":true'
echo "HOME_WIPE_OK"

echo "HOME_SMOKE_OK"
