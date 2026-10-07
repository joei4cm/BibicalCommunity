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
echo "== chapter CUVS John.1 (zh) =="
CUVS=$(curl -sf "$BASE/v1/bible/chapter?translation=cuvs&ref=John.1")
echo "$CUVS" | head -c 160; echo
echo "$CUVS" | grep -q '太初有道'
echo "== chapter CUVT John.1 (zh) =="
curl -sf "$BASE/v1/bible/chapter?translation=cuvt&ref=John.1" | grep -q '太初有道'
echo "== chapter kougo John.1 (ja) =="
curl -sf "$BASE/v1/bible/chapter?translation=kougo&ref=John.1" | grep -q '初めに言があった'
echo "== chapter RCUV John.1 (zh) =="
curl -sf "$BASE/v1/bible/chapter?translation=rcuv&ref=John.1" | grep -q '太初有道'
echo "== chapter shinkaiyaku John.1 (ja) =="
# Local scaffold or R2 sample seed both include 初めに…
curl -sf "$BASE/v1/bible/chapter?translation=shinkaiyaku&ref=John.1" | grep -qE '初めに(ことば|言)が'
echo "== chapter shinKyoudou John.1 (ja) =="
curl -sf "$BASE/v1/bible/chapter?translation=shinKyoudou&ref=John.1" | grep -q '初めに言があった'
echo "== chapter CCB John.1 (zh) =="
# Local scaffold (太初有道) or R2 sample seed (宇宙被造以前…)
curl -sf "$BASE/v1/bible/chapter?translation=ccb&ref=John.1" | grep -qE '太初有道|宇宙被造以前|道已经存在|道就是'
echo "== chapter LZZ John.1 (zh) =="
curl -sf "$BASE/v1/bible/chapter?translation=lzz&ref=John.1" | grep -qE '起初有道|太初有道|道与'
echo "== partner endao chapter sso flag =="
ENDAO_CH=$(curl -sf "$BASE/v1/bible/chapter?translation=endao&ref=John.1")
echo "$ENDAO_CH" | head -c 200; echo
echo "$ENDAO_CH" | grep -q '"sso":true'
echo "$ENDAO_CH" | grep -q 'sso=1'
echo "ENDAO_SSO_CHAPTER_OK"
echo "== chapter NIV external =="
curl -sf "$BASE/v1/bible/chapter?translation=niv&ref=John.1" | head -c 200; echo
echo "== partner mock authorize =="
curl -sf -o /dev/null -w "%{http_code}\n" "$BASE/v1/partners/mock-authorize?partner=endao&ref=John.1&redirect_uri=/v1/partners/endao/callback"
echo "== me =="
curl -sf -H "$AUTH" "$BASE/v1/me" | head -c 160; echo
echo "== plans create (non-CSV) =="
PLAN=$(curl -sf -X POST -H "$AUTH" -H 'content-type: application/json' \
  -d '{"title":"晨祷计划","description":"smoke","visibility":"private","days":[{"day":1,"ref":"John.1","title":"Begin"},{"day":2,"ref":"John.2","title":"Wedding"}]}' \
  "$BASE/v1/plans")
echo "$PLAN" | head -c 120; echo
echo "$PLAN" | grep -q '"id":"plan_'
echo "PLAN_CREATE_OK"
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
echo "== partner SSO mock closed loop =="
SSO_STATUS=$(curl -sf "$BASE/v1/partners/status")
echo "$SSO_STATUS" | grep -q '"endao":{"ssoEnabled":true'
echo "SSO_STATUS_OK"
SSO_START=$(curl -sf "$BASE/v1/partners/endao/start?ref=John.1")
echo "$SSO_START" | head -c 240; echo
echo "$SSO_START" | grep -q 'mock-authorize'
echo "$SSO_START" | grep -q '"mockIdp":true'
echo "SSO_START_OK"
SSO_LOOP=$(curl -sfL "$BASE/v1/partners/endao/start?ref=John.1&redirect=1")
echo "$SSO_LOOP" | head -c 240; echo
echo "$SSO_LOOP" | grep -q '"ok":true'
echo "$SSO_LOOP" | grep -q '"mock":true'
echo "SSO_LOOP_OK"
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
echo "== call websocket joined =="
CALL_ID=$(echo "$CALL" | sed -n 's/.*"callId":"\([^"]*\)".*/\1/p')
test -n "$CALL_ID"
WS_HOST="${BASE#http://}"
WS_HOST="${WS_HOST#https://}"
WS_URL="ws://${WS_HOST}/v1/calls/${CALL_ID}/ws?token=${TOKEN}&conversationId=${CID}"
node --input-type=module -e '
const url = process.argv[1];
let ok = false;
const ws = new WebSocket(url);
const timer = setTimeout(() => { console.error("CALL_WS_TIMEOUT"); process.exit(1); }, 8000);
ws.addEventListener("message", (ev) => {
  let msg;
  try { msg = JSON.parse(String(ev.data)); } catch { return; }
  if (msg && msg.type === "joined") {
    ok = true;
    clearTimeout(timer);
    console.log("CALL_WS_OK");
    ws.close();
    process.exit(0);
  }
});
ws.addEventListener("error", () => {
  if (ok) return;
  clearTimeout(timer);
  console.error("CALL_WS_ERROR");
  process.exit(1);
});
ws.addEventListener("close", () => {
  if (ok) return;
  clearTimeout(timer);
  console.error("CALL_WS_CLOSED");
  process.exit(1);
});
' "$WS_URL"
echo "== call websocket offer fan-out =="
WS_URL2="ws://${WS_HOST}/v1/calls/${CALL_ID}/ws?token=${TOKEN2}&conversationId=${CID}"
node --input-type=module -e '
const urlA = process.argv[1];
const urlB = process.argv[2];
function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const t = setTimeout(() => reject(new Error("timeout")), 8000);
    ws.addEventListener("open", () => {});
    ws.addEventListener("message", (ev) => {
      let msg; try { msg = JSON.parse(String(ev.data)); } catch { return; }
      if (msg.type === "joined") { clearTimeout(t); resolve({ ws, msg }); }
    });
    ws.addEventListener("error", () => { clearTimeout(t); reject(new Error("ws error")); });
  });
}
const a = await connect(urlA);
const b = await connect(urlB);
const got = new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error("no offer")), 8000);
  b.ws.addEventListener("message", (ev) => {
    let msg; try { msg = JSON.parse(String(ev.data)); } catch { return; }
    if (msg.type === "offer") { clearTimeout(t); resolve(msg); }
  });
});
a.ws.send(JSON.stringify({ type: "offer", sdp: "v=0-smoke" }));
const offer = await got;
if (!offer.sdp) throw new Error("missing sdp");
console.log("CALL_WS_FANOUT_OK");
a.ws.close(); b.ws.close();
process.exit(0);
' "$WS_URL" "$WS_URL2"

echo "== peer key bundle list =="
curl -sf -H "Authorization: Bearer $TOKEN2" "$BASE/v1/keys/$PEER" | head -c 160; echo

echo "== church home paths =="
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export TOKEN TOKEN2 PEER CID BASE
bash "$SCRIPT_DIR/smoke-home.sh" "$BASE"

echo "SMOKE_OK"
