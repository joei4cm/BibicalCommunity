#!/usr/bin/env bash
# Local API smoke against wrangler dev (default http://127.0.0.1:8787)
set -euo pipefail
# Truncate without SIGPIPE under pipefail (echo|head -c fails on large JSON).
snip() { printf '%s\n' "${1:0:${2:-200}}"; }
BASE="${1:-http://127.0.0.1:8787}"
echo "== health =="
curl -sf "$BASE/health" | head -c 200 || true; echo
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
curl -sf "$BASE/v1/bible/translations" | head -c 120 || true; echo
echo "== bible corpus-packs =="
CPACKS=$(curl -sf "$BASE/v1/bible/corpus-packs")
snip "$CPACKS" 200
echo "$CPACKS" | grep -q '"packs":\['
echo "$CPACKS" | grep -q 'web-r2'
echo "$CPACKS" | grep -q 'cuvs-r2'
# probe.noTsPacks documents that corpora are not shipped as TypeScript packs
echo "$CPACKS" | grep -q '"noTsPacks":true'
echo "BIBLE_CORPUS_PACKS_OK"
echo "== bible corpus-catalog (boot=和合本+NASB whole-Bible) =="
CAT=$(curl -sf "$BASE/v1/bible/corpus-catalog")
snip "$CAT" 200
echo "$CAT" | grep -q '"bootDefaults"'
echo "$CAT" | grep -q '"cuvs"'
echo "$CAT" | grep -q '"nasb"'
echo "$CAT" | grep -q '"web"'
echo "$CAT" | grep -q '"shinKyoudou"'
echo "$CAT" | grep -q '"installMode":"external"'
echo "$CAT" | grep -q '"packKind":"whole-bible"'
echo "BIBLE_CORPUS_CATALOG_OK"
echo "== seed R2 from JSON fixtures (no TS packs) =="
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
(cd "$ROOT" && pnpm --filter @logoshome/bible build >/dev/null)
node "$ROOT/scripts/seed-r2-from-json-fixtures.mjs" "$BASE" "$TOKEN"
echo "== chapter boot teaching-set fixtures from R2 =="
for tid in web cuvs shinKyoudou; do
  for ref in John.1 John.3 John.14 Ps.23 Rom.8 Matt.5 Gen.1; do
    body=$(curl -sf "$BASE/v1/bible/chapter?translation=$tid&ref=$ref")
    echo "$body" | grep -q '"source":"r2"'
    echo "BOOT_TEACHING_R2_OK tid=$tid ref=$ref"
  done
done
curl -sf "$BASE/v1/bible/chapter?translation=cuvs&ref=John.1" | grep -qE '太初有道|fixture|样例'
curl -sf "$BASE/v1/bible/chapter?translation=cuvs&ref=Rom.8" | grep -qE '不定罪|fixture|样例'
curl -sf "$BASE/v1/bible/chapter?translation=shinKyoudou&ref=John.14" | grep -qE '道であり|真理|fixture|見本'
curl -sf "$BASE/v1/bible/chapter?translation=shinKyoudou&ref=Gen.1" | grep -qE '創造|fixture|見本'
echo "BOOT_DEFAULT_R2_OK"
echo "BOOT_TEACHING_PARITY_OK"
echo "== chapter downloadable PD fixtures =="
curl -sf "$BASE/v1/bible/chapter?translation=kjv&ref=John.1" | grep -qiE 'beginning|Word|fixture'
curl -sf "$BASE/v1/bible/chapter?translation=asv&ref=John.3" | grep -qiE 'God so loved|fixture'
curl -sf "$BASE/v1/bible/chapter?translation=kougo&ref=John.1" | grep -qE '初めに|fixture|見本'
echo "DOWNLOADABLE_R2_OK"
echo "== missing chapter returns 404 (no TS fallback) =="
MISS_CODE=$(curl -s -o /tmp/lh-miss.json -w "%{http_code}" "$BASE/v1/bible/chapter?translation=web&ref=John.99")
test "$MISS_CODE" = "404"
grep -q 'chapter_not_in_r2' /tmp/lh-miss.json
echo "NO_TS_FALLBACK_OK"
echo "== chapter ESV external =="
curl -sf "$BASE/v1/bible/chapter?translation=esv&ref=John.1" | grep -q '"external":true'
echo "ESV_EXTERNAL_OK"
echo "== partner endao chapter sso flag =="
ENDAO_CH=$(curl -sf "$BASE/v1/bible/chapter?translation=endao&ref=John.1")
snip "$ENDAO_CH" 200
echo "$ENDAO_CH" | grep -q '"sso":true'
echo "$ENDAO_CH" | grep -q 'sso=1'
echo "ENDAO_SSO_CHAPTER_OK"
echo "== chapter NIV external =="
curl -sf "$BASE/v1/bible/chapter?translation=niv&ref=John.1" | head -c 200 || true; echo
echo "== partner mock authorize =="
curl -sf -o /dev/null -w "%{http_code}\n" "$BASE/v1/partners/mock-authorize?partner=endao&ref=John.1&redirect_uri=/v1/partners/endao/callback"
echo "== me =="
curl -sf -H "$AUTH" "$BASE/v1/me" | head -c 160 || true; echo
echo "== plans create (non-CSV) =="
PLAN=$(curl -sf -X POST -H "$AUTH" -H 'content-type: application/json' \
  -d '{"title":"晨祷计划","description":"smoke","visibility":"private","days":[{"day":1,"ref":"John.1","title":"Begin"},{"day":2,"ref":"John.2","title":"Wedding"}]}' \
  "$BASE/v1/plans")
snip "$PLAN" 120
echo "$PLAN" | grep -q '"id":"plan_'
echo "PLAN_CREATE_OK"
PLAN_ID=$(echo "$PLAN" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
echo "== plans CSV import + subscribe + progress =="
CSV_BODY=$'day,ref,title,note\n1,John.1,Word,Begin\n2,Gen.1,Create,Dawn\n3,Ps.23,Shepherd,Rest'
CSV_IMP=$(curl -sf -X POST -H "$AUTH" \
  -F "title=CSV灵修计划" \
  -F "csv=$CSV_BODY" \
  "$BASE/v1/plans/import-csv")
snip "$CSV_IMP" 160
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
snip "$SUB" 160
echo "$SUB" | grep -q '"id":"psub_'
PROG=$(curl -sf -X POST -H "Authorization: Bearer $TOKEN_SUB" -H 'content-type: application/json' \
  -d '{"day":1}' "$BASE/v1/plans/$PUB_ID/progress")
echo "$PROG" | grep -q '"ok":true'
echo "$PROG" | grep -q '"progressDay":1'
echo "PLAN_CSV_SUBSCRIBE_OK"
echo "== plans devotion step persist =="
DEVOTION=$(curl -sf -X POST -H "Authorization: Bearer $TOKEN_SUB" -H 'content-type: application/json' \
  -d '{"step":"read","materialId":"morning-examen"}' "$BASE/v1/plans/$PUB_ID/devotion")
snip "$DEVOTION" 200
echo "$DEVOTION" | grep -q '"ok":true'
echo "$DEVOTION" | grep -q '"devotionStep":"read"'
echo "$DEVOTION" | grep -q '"devotionMaterialId":"morning-examen"'
SUBS_AFTER=$(curl -sf -H "Authorization: Bearer $TOKEN_SUB" "$BASE/v1/plans/subscriptions")
echo "$SUBS_AFTER" | grep -q '"devotionStep":"read"'
echo "$SUBS_AFTER" | grep -q '"devotionMaterialId":"morning-examen"'
# Advance to reflect and confirm persistence
DEVOTION2=$(curl -sf -X POST -H "Authorization: Bearer $TOKEN_SUB" -H 'content-type: application/json' \
  -d '{"step":"reflect"}' "$BASE/v1/plans/$PUB_ID/devotion")
echo "$DEVOTION2" | grep -q '"devotionStep":"reflect"'
# materialId omitted → previous material retained
echo "$DEVOTION2" | grep -q '"devotionMaterialId":"morning-examen"'
SUBS_REFLECT=$(curl -sf -H "Authorization: Bearer $TOKEN_SUB" "$BASE/v1/plans/subscriptions")
echo "$SUBS_REFLECT" | grep -q '"devotionStep":"reflect"'
echo "PLAN_DEVOTION_STEP_OK"
test -n "$PLAN_ID"
echo "== turn credentials =="
curl -sf -X POST -H "$AUTH" -H 'content-type: application/json' -d '{}' \
  "$BASE/v1/calls/turn-credentials" | head -c 200 || true; echo
echo "== partners status =="
curl -sf "$BASE/v1/partners/status" | head -c 200 || true; echo
echo "== partner SSO mock closed loop =="
SSO_STATUS=$(curl -sf "$BASE/v1/partners/status")
echo "$SSO_STATUS" | grep -q '"endao":{"ssoEnabled":true'
echo "$SSO_STATUS" | grep -q '"weread":{"ssoEnabled":true'
echo "SSO_STATUS_OK"
SSO_START=$(curl -sf "$BASE/v1/partners/endao/start?ref=John.1")
snip "$SSO_START" 240
echo "$SSO_START" | grep -q 'mock-authorize'
echo "$SSO_START" | grep -q '"mockIdp":true'
echo "SSO_START_OK"
WEREAD_START=$(curl -sf "$BASE/v1/partners/weread/start?ref=John.1")
snip "$WEREAD_START" 240
echo "$WEREAD_START" | grep -q 'mock-authorize'
echo "$WEREAD_START" | grep -q '"mockIdp":true'
echo "$WEREAD_START" | grep -q '"partner":"weread"'
echo "WEREAD_SSO_START_OK"
SSO_LOOP=$(curl -sfL "$BASE/v1/partners/endao/start?ref=John.1&redirect=1")
snip "$SSO_LOOP" 240
echo "$SSO_LOOP" | grep -q '"ok":true'
echo "$SSO_LOOP" | grep -q '"mock":true'
echo "SSO_LOOP_OK"
WEREAD_LOOP=$(curl -sfL "$BASE/v1/partners/weread/start?ref=John.1&redirect=1")
snip "$WEREAD_LOOP" 240
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
snip "$CALL" 200
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
curl -sf -H "Authorization: Bearer $TOKEN2" "$BASE/v1/keys/$PEER" | head -c 160 || true; echo

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

echo "== admin console (users / homes / groups / remote wipe) =="
bash "$SCRIPT_DIR/smoke-admin.sh" "$BASE"

echo "SMOKE_OK"
