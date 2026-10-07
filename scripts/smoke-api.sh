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
echo "== chapter mainstream John.2 scaffolds =="
curl -sf "$BASE/v1/bible/chapter?translation=cuvs&ref=John.2" | grep -qE '迦拿|娶亲'
curl -sf "$BASE/v1/bible/chapter?translation=cuvt&ref=John.2" | grep -qE '迦拿|娶親'
curl -sf "$BASE/v1/bible/chapter?translation=rcuv&ref=John.2" | grep -qE '迦拿|娶亲'
curl -sf "$BASE/v1/bible/chapter?translation=ccb&ref=John.2" | grep -qE '迦拿|婚宴'
curl -sf "$BASE/v1/bible/chapter?translation=lzz&ref=John.2" | grep -qE '迦拿|婚筵'
curl -sf "$BASE/v1/bible/chapter?translation=kjv&ref=John.2" | grep -qi 'Cana'
curl -sf "$BASE/v1/bible/chapter?translation=asv&ref=John.2" | grep -qi 'Cana'
curl -sf "$BASE/v1/bible/chapter?translation=kougo&ref=John.2" | grep -q 'カナ'
curl -sf "$BASE/v1/bible/chapter?translation=shinkaiyaku&ref=John.2" | grep -q 'カナ'
curl -sf "$BASE/v1/bible/chapter?translation=shinKyoudou&ref=John.2" | grep -q 'カナ'
curl -sf "$BASE/v1/bible/chapter?translation=kougoyaku-pd&ref=John.2" | grep -qE 'カナ|婚筵'
echo "JOHN2_MULTILANG_OK"
echo "== chapter ASV John.3 =="
A3=$(curl -sf "$BASE/v1/bible/chapter?translation=asv&ref=John.3")
echo "$A3" | head -c 160; echo
echo "$A3" | grep -q 'God so loved the world'
echo "== chapter mainstream John.3 scaffolds (zh/ja) =="
curl -sf "$BASE/v1/bible/chapter?translation=cuvs&ref=John.3" | grep -qE '神爱世人|独生子'
curl -sf "$BASE/v1/bible/chapter?translation=cuvt&ref=John.3" | grep -qE '神愛世人|獨生子'
curl -sf "$BASE/v1/bible/chapter?translation=rcuv&ref=John.3" | grep -qE '神爱世人|独生子'
curl -sf "$BASE/v1/bible/chapter?translation=ccb&ref=John.3" | grep -qE '上帝深爱世人|独生子'
curl -sf "$BASE/v1/bible/chapter?translation=lzz&ref=John.3" | grep -qE '上帝这样地爱了世人|独生子'
curl -sf "$BASE/v1/bible/chapter?translation=kougo&ref=John.3" | grep -qE 'ニコデモ|ひとり子'
curl -sf "$BASE/v1/bible/chapter?translation=shinkaiyaku&ref=John.3" | grep -qE 'ニコデモ|ひとり子'
curl -sf "$BASE/v1/bible/chapter?translation=shinKyoudou&ref=John.3" | grep -qE 'ニコデモ|独り子'
curl -sf "$BASE/v1/bible/chapter?translation=kougoyaku-pd&ref=John.3" | grep -qE 'ニコデモ|獨り子'
echo "JOHN3_ZHJA_OK"
echo "== multi-book scaffolds Gen.1 / Matt.5 / Ps.23 =="
curl -sf "$BASE/v1/bible/chapter?translation=web&ref=Gen.1" | grep -qiE 'beginning|created'
curl -sf "$BASE/v1/bible/chapter?translation=kjv&ref=Gen.1" | grep -qiE 'beginning|created'
curl -sf "$BASE/v1/bible/chapter?translation=asv&ref=Gen.1" | grep -qiE 'beginning|created'
curl -sf "$BASE/v1/bible/chapter?translation=web&ref=Matt.5" | grep -qiE 'poor in spirit|Blessed'
curl -sf "$BASE/v1/bible/chapter?translation=kjv&ref=Matt.5" | grep -qiE 'poor in spirit|meek'
curl -sf "$BASE/v1/bible/chapter?translation=asv&ref=Matt.5" | grep -qiE 'poor in spirit|meek'
curl -sf "$BASE/v1/bible/chapter?translation=web&ref=Ps.23" | grep -qiE 'shepherd'
curl -sf "$BASE/v1/bible/chapter?translation=kjv&ref=Ps.23" | grep -qiE 'shepherd'
curl -sf "$BASE/v1/bible/chapter?translation=asv&ref=Ps.23" | grep -qiE 'shepherd'
curl -sf "$BASE/v1/bible/chapter?translation=cuvs&ref=Gen.1" | grep -qE '样例|起初|创造'
curl -sf "$BASE/v1/bible/chapter?translation=kougo&ref=Gen.1" | grep -qE '見本|創造|はじめに'
curl -sf "$BASE/v1/bible/chapter?translation=cuvs&ref=Ps.23" | grep -qE '样例|牧者'
curl -sf "$BASE/v1/bible/chapter?translation=kougo&ref=Ps.23" | grep -qE '見本|牧者'
echo "MULTI_BOOK_SCAFFOLD_OK"
echo "== multi-book NT scaffolds Rom.8 / Heb.11 =="
curl -sf "$BASE/v1/bible/chapter?translation=web&ref=Rom.8" | grep -qiE 'no condemnation|work together for good'
curl -sf "$BASE/v1/bible/chapter?translation=kjv&ref=Rom.8" | grep -qiE 'no condemnation|If God be for us'
curl -sf "$BASE/v1/bible/chapter?translation=asv&ref=Rom.8" | grep -qiE 'no condemnation|work together for good'
curl -sf "$BASE/v1/bible/chapter?translation=web&ref=Heb.11" | grep -qiE 'faith is assurance|hoped for'
curl -sf "$BASE/v1/bible/chapter?translation=kjv&ref=Heb.11" | grep -qiE 'substance of things hoped for|impossible to please'
curl -sf "$BASE/v1/bible/chapter?translation=asv&ref=Heb.11" | grep -qiE 'assurance of things hoped for|conviction'
curl -sf "$BASE/v1/bible/chapter?translation=cuvs&ref=Rom.8" | grep -qE '样例|不定罪'
curl -sf "$BASE/v1/bible/chapter?translation=kougo&ref=Rom.8" | grep -qE '見本|罪に定められることがない'
curl -sf "$BASE/v1/bible/chapter?translation=cuvs&ref=Heb.11" | grep -qE '样例|信就是|实底'
curl -sf "$BASE/v1/bible/chapter?translation=kougo&ref=Heb.11" | grep -qE '見本|信仰とは'
echo "MULTI_BOOK_NT_OK"
echo "== multi-book OT/NT scaffolds Isa.53 / Acts.2 =="
curl -sf "$BASE/v1/bible/chapter?translation=web&ref=Isa.53" | grep -qiE 'believed our message|pierced for our transgressions|wounds we are healed'
curl -sf "$BASE/v1/bible/chapter?translation=kjv&ref=Isa.53" | grep -qiE 'believed our report|wounded for our transgressions|stripes we are healed'
curl -sf "$BASE/v1/bible/chapter?translation=asv&ref=Isa.53" | grep -qiE 'believed our message|wounded for our transgressions|sheep have gone astray'
curl -sf "$BASE/v1/bible/chapter?translation=web&ref=Acts.2" | grep -qiE 'Pentecost|Holy Spirit'
curl -sf "$BASE/v1/bible/chapter?translation=kjv&ref=Acts.2" | grep -qiE 'Pentecost|Holy Ghost|Repent'
curl -sf "$BASE/v1/bible/chapter?translation=asv&ref=Acts.2" | grep -qiE 'Pentecost|Holy Spirit|mighty wind'
curl -sf "$BASE/v1/bible/chapter?translation=cuvs&ref=Isa.53" | grep -qE '样例|我们所传的|鞭伤'
curl -sf "$BASE/v1/bible/chapter?translation=kougo&ref=Isa.53" | grep -qE '見本|信じ得たか|主の腕'
curl -sf "$BASE/v1/bible/chapter?translation=cuvs&ref=Acts.2" | grep -qE '样例|五旬节'
curl -sf "$BASE/v1/bible/chapter?translation=kougo&ref=Acts.2" | grep -qE '見本|五旬節'
echo "MULTI_BOOK_OTNT_OK"
echo "== multi-book wisdom scaffolds Ps.1 / Prov.3 =="
curl -sf "$BASE/v1/bible/chapter?translation=web&ref=Ps.1" | grep -qiE 'Blessed is the man|counsel of the wicked'
curl -sf "$BASE/v1/bible/chapter?translation=kjv&ref=Ps.1" | grep -qiE 'Blessed is the man|counsel of the ungodly'
curl -sf "$BASE/v1/bible/chapter?translation=asv&ref=Ps.1" | grep -qiE 'Blessed is the man|counsel of the wicked'
curl -sf "$BASE/v1/bible/chapter?translation=web&ref=Prov.3" | grep -qiE 'Trust in Yahweh|own understanding'
curl -sf "$BASE/v1/bible/chapter?translation=kjv&ref=Prov.3" | grep -qiE 'Trust in the LORD|own understanding'
curl -sf "$BASE/v1/bible/chapter?translation=asv&ref=Prov.3" | grep -qiE 'Trust in Jehovah|own understanding'
curl -sf "$BASE/v1/bible/chapter?translation=cuvs&ref=Ps.1" | grep -qE '样例|恶人的计谋|有福'
curl -sf "$BASE/v1/bible/chapter?translation=kougo&ref=Ps.1" | grep -qE '見本|悪しき者|さいわい'
curl -sf "$BASE/v1/bible/chapter?translation=cuvs&ref=Prov.3" | grep -qE '样例|仰赖耶和华|自己的聪明'
curl -sf "$BASE/v1/bible/chapter?translation=kougo&ref=Prov.3" | grep -qE '見本|主に信頼|自分の知識'
echo "MULTI_BOOK_WISDOM_OK"
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
PLAN_ID=$(echo "$PLAN" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
echo "== plans CSV import + subscribe + progress =="
CSV_BODY=$'day,ref,title,note\n1,John.1,Word,Begin\n2,Gen.1,Create,Dawn\n3,Ps.23,Shepherd,Rest'
CSV_IMP=$(curl -sf -X POST -H "$AUTH" \
  -F "title=CSV灵修计划" \
  -F "csv=$CSV_BODY" \
  "$BASE/v1/plans/import-csv")
echo "$CSV_IMP" | head -c 160; echo
echo "$CSV_IMP" | grep -q '"id":"plan_'
CSV_ID=$(echo "$CSV_IMP" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
test -n "$CSV_ID"
# Make plan public then subscribe as second user
curl -sf -X POST -H "$AUTH" -H 'content-type: application/json' \
  -d '{"title":"公开晨更","description":"public smoke","visibility":"public","days":[{"day":1,"ref":"John.1","title":"Start"}]}' \
  "$BASE/v1/plans" >/dev/null
H_SUB="plansub$(date +%s)"
REG_SUB=$(curl -sf -X POST "$BASE/v1/auth/register" -H 'content-type: application/json' \
  -d "{\"handle\":\"$H_SUB\",\"password\":\"$PASS\",\"nickname\":\"Sub\",\"locale\":\"zh\"}")
TOKEN_SUB=$(echo "$REG_SUB" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
PUB=$(curl -sf -H "Authorization: Bearer $TOKEN_SUB" "$BASE/v1/plans/public")
echo "$PUB" | grep -q '"visibility":"public"'
PUB_ID=$(echo "$PUB" | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{const j=JSON.parse(s);const p=(j.plans||[]).find(x=>x.title&&x.title.includes("公开"));if(!p)throw new Error("no public plan");process.stdout.write(p.id)})')
SUB=$(curl -sf -X POST -H "Authorization: Bearer $TOKEN_SUB" -H 'content-type: application/json' -d '{}' \
  "$BASE/v1/plans/$PUB_ID/subscribe")
echo "$SUB" | head -c 160; echo
echo "$SUB" | grep -q '"id":"psub_'
PROG=$(curl -sf -X POST -H "Authorization: Bearer $TOKEN_SUB" -H 'content-type: application/json' \
  -d '{"day":1}' "$BASE/v1/plans/$PUB_ID/progress")
echo "$PROG" | grep -q '"ok":true'
echo "$PROG" | grep -q '"progressDay":1'
echo "PLAN_CSV_SUBSCRIBE_OK"
test -n "$PLAN_ID"
echo "== turn credentials =="
curl -sf -X POST -H "$AUTH" -H 'content-type: application/json' -d '{}' \
  "$BASE/v1/calls/turn-credentials" | head -c 200; echo
echo "== partners status =="
curl -sf "$BASE/v1/partners/status" | head -c 200; echo
echo "== partner SSO mock closed loop =="
SSO_STATUS=$(curl -sf "$BASE/v1/partners/status")
echo "$SSO_STATUS" | grep -q '"endao":{"ssoEnabled":true'
echo "$SSO_STATUS" | grep -q '"weread":{"ssoEnabled":true'
echo "SSO_STATUS_OK"
SSO_START=$(curl -sf "$BASE/v1/partners/endao/start?ref=John.1")
echo "$SSO_START" | head -c 240; echo
echo "$SSO_START" | grep -q 'mock-authorize'
echo "$SSO_START" | grep -q '"mockIdp":true'
echo "SSO_START_OK"
WEREAD_START=$(curl -sf "$BASE/v1/partners/weread/start?ref=John.1")
echo "$WEREAD_START" | head -c 240; echo
echo "$WEREAD_START" | grep -q 'mock-authorize'
echo "$WEREAD_START" | grep -q '"mockIdp":true'
echo "$WEREAD_START" | grep -q '"partner":"weread"'
echo "WEREAD_SSO_START_OK"
SSO_LOOP=$(curl -sfL "$BASE/v1/partners/endao/start?ref=John.1&redirect=1")
echo "$SSO_LOOP" | head -c 240; echo
echo "$SSO_LOOP" | grep -q '"ok":true'
echo "$SSO_LOOP" | grep -q '"mock":true'
echo "SSO_LOOP_OK"
WEREAD_LOOP=$(curl -sfL "$BASE/v1/partners/weread/start?ref=John.1&redirect=1")
echo "$WEREAD_LOOP" | head -c 240; echo
echo "$WEREAD_LOOP" | grep -q '"ok":true'
echo "$WEREAD_LOOP" | grep -q '"mock":true'
echo "$WEREAD_LOOP" | grep -q '"partner":"weread"'
echo "WEREAD_SSO_LOOP_OK"
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
echo "== conversation archive toggle =="
curl -sf -X PATCH -H "$AUTH" -H 'content-type: application/json' \
  -d '{"archived":true}' "$BASE/v1/chat/conversations/$CID" | grep -q '"archived":true'
ARCH_LIST=$(curl -sf "$BASE/v1/chat/conversations" -H "$AUTH")
echo "$ARCH_LIST" | node -e '
const j=JSON.parse(require("fs").readFileSync(0,"utf8"));
const id=process.argv[1];
const c=(j.conversations||[]).find((x)=>x.id===id);
if(!c||!c.membership||c.membership.archived!==true) throw new Error("expected archived");
console.log("ARCHIVE_OK");
' "$CID"
curl -sf -X PATCH -H "$AUTH" -H 'content-type: application/json' \
  -d '{"archived":false}' "$BASE/v1/chat/conversations/$CID" | grep -q '"archived":false'
echo "UNARCHIVE_OK"
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

echo "== peer key bundle list (empty until upload) =="
curl -sf -H "Authorization: Bearer $TOKEN2" "$BASE/v1/keys/$PEER" | head -c 160; echo

echo "== auth-then-P2P key distribution =="
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "$SCRIPT_DIR/smoke-keys.sh" "$BASE"

echo "== church home paths =="
export TOKEN TOKEN2 PEER CID BASE
# Call/screen signaling runs below; skip duplicate when home is nested here.
SMOKE_SKIP_CALL_SIGNALING=1 bash "$SCRIPT_DIR/smoke-home.sh" "$BASE"

echo "== study materials + home externalMediaUrl =="
bash "$SCRIPT_DIR/smoke-study-embed.sh" "$BASE"

echo "== call + screen signaling fan-out =="
node "$SCRIPT_DIR/smoke-call-signaling.mjs" "$BASE"

echo "== annotations CRUD (highlight + bookmark + note) =="
bash "$SCRIPT_DIR/smoke-annotations.sh" "$BASE"

echo "== me profile / privacy / search =="
bash "$SCRIPT_DIR/smoke-me.sh" "$BASE"

echo "SMOKE_OK"
