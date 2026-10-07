#!/usr/bin/env bash
# Local API smoke against wrangler dev (default http://127.0.0.1:8787)
set -euo pipefail
BASE="${1:-http://127.0.0.1:8787}"
echo "== health =="
curl -sf "$BASE/health" | head -c 200; echo
HANDLE="smoke$(date +%s)"
PASS='SmokeTestPass123!'
echo "== register (locale=zh short tag) =="
REG=$(curl -sf -X POST "$BASE/v1/auth/register" -H 'content-type: application/json' \
  -d "{\"handle\":\"$HANDLE\",\"password\":\"$PASS\",\"nickname\":\"Smoke\",\"locale\":\"zh\"}")
TOKEN=$(echo "$REG" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
LOCALE=$(echo "$REG" | sed -n 's/.*"locale":"\([^"]*\)".*/\1/p')
echo "token=${TOKEN:0:12}… locale=$LOCALE"
test "$LOCALE" = "zh-CN"
AUTH="Authorization: Bearer $TOKEN"
echo "== bible translations =="
curl -sf "$BASE/v1/bible/translations" | head -c 120; echo
echo "== chapter WEB John.1 =="
curl -sf "$BASE/v1/bible/chapter?translation=web&ref=John.1" | head -c 160; echo
echo "== chapter WEB John.2 =="
J2=$(curl -sf "$BASE/v1/bible/chapter?translation=web&ref=John.2")
echo "$J2" | head -c 160; echo
echo "$J2" | grep -q 'wedding in Cana'
echo "== chapter ASV John.3 =="
A3=$(curl -sf "$BASE/v1/bible/chapter?translation=asv&ref=John.3")
echo "$A3" | head -c 160; echo
echo "$A3" | grep -q 'God so loved the world'
echo "== chapter NIV external =="
curl -sf "$BASE/v1/bible/chapter?translation=niv&ref=John.1" | head -c 200; echo
echo "== partner mock authorize =="
curl -sf -o /dev/null -w "%{http_code}\n" "$BASE/v1/partners/mock-authorize?partner=endao&ref=John.1&redirect_uri=/v1/partners/endao/callback"
echo "== me =="
curl -sf -H "$AUTH" "$BASE/v1/me" | head -c 160; echo
echo "== encrypted annotation note =="
curl -sf -X POST -H "$AUTH" -H 'content-type: application/json' \
  -d '{"translationId":"web","ref":{"book":"John","chapter":1,"verseStart":1},"kind":"note","ciphertext":"c2FtcGxl","iv":"aXY="}' \
  "$BASE/v1/annotations" | head -c 160; echo
curl -sf -H "$AUTH" "$BASE/v1/annotations?translation=web" | head -c 160; echo
echo "== turn credentials =="
curl -sf -X POST -H "$AUTH" -H 'content-type: application/json' -d '{}' \
  "$BASE/v1/calls/turn-credentials" | head -c 200; echo
echo "== partners status =="
curl -sf "$BASE/v1/partners/status" | head -c 200; echo
echo "== disappearing message tombstone =="
H2="smokepeer$(date +%s)"
REG2=$(curl -sf -X POST "$BASE/v1/auth/register" -H 'content-type: application/json' \
  -d "{\"handle\":\"$H2\",\"password\":\"$PASS\",\"nickname\":\"Peer\",\"locale\":\"en\"}")
PEER=$(echo "$REG2" | sed -n 's/.*"userId":"\([^"]*\)".*/\1/p')
TOKEN2=$(echo "$REG2" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
CONVO=$(curl -sf -X POST "$BASE/v1/chat/conversations" -H "$AUTH" -H 'content-type: application/json' \
  -d "{\"kind\":\"dm\",\"memberIds\":[\"$PEER\"],\"disappearingTtlSec\":1}")
CID=$(echo "$CONVO" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
LIST=$(curl -sf "$BASE/v1/chat/conversations" -H "$AUTH")
echo "$LIST" | grep -q "peerUserIds"
echo "PEER_IDS_OK"
curl -sf -X POST "$BASE/v1/chat/conversations/$CID/messages" -H "$AUTH" -H 'content-type: application/json' \
  -d '{"ratchetHeader":"dGVzdA==","ciphertext":"Y3Q=","contentType":"msg"}' >/dev/null
sleep 2
AFTER=$(curl -sf "$BASE/v1/chat/conversations/$CID/messages" -H "$AUTH")
echo "$AFTER" | grep -q '"messages":\[\]'
echo "TTL_TOMBSTONE_OK"
echo "== call create + turn =="
CALL=$(curl -sf -X POST -H "$AUTH" -H 'content-type: application/json' \
  -d "{\"conversationId\":\"$CID\"}" "$BASE/v1/chat/calls")
echo "$CALL" | head -c 200; echo
echo "$CALL" | grep -q "signalingPath"
echo "CALL_SIGNAL_OK"
echo "== peer key bundle list =="
curl -sf -H "Authorization: Bearer $TOKEN2" "$BASE/v1/keys/$PEER" | head -c 160; echo
echo "SMOKE_OK"
