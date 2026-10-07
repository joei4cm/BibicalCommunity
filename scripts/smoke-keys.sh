#!/usr/bin/env bash
# Auth-then-P2P key distribution smoke: register A/B, upload A's bundle+OPKs, B fetches.
set -euo pipefail
BASE="${1:-http://127.0.0.1:8787}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PASS='SmokeTestPass123!'
TS="$(date +%s)"
HA="keysa${TS}"
HB="keysb${TS}"

echo "== keys smoke: register A + B =="
REG_A=$(curl -sf -X POST "$BASE/v1/auth/register" -H 'content-type: application/json' \
  -d "{\"handle\":\"$HA\",\"password\":\"$PASS\",\"nickname\":\"KeysA\",\"locale\":\"en\"}")
REG_B=$(curl -sf -X POST "$BASE/v1/auth/register" -H 'content-type: application/json' \
  -d "{\"handle\":\"$HB\",\"password\":\"$PASS\",\"nickname\":\"KeysB\",\"locale\":\"en\"}")
TOKEN_A=$(echo "$REG_A" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
USER_A=$(echo "$REG_A" | sed -n 's/.*"userId":"\([^"]*\)".*/\1/p')
TOKEN_B=$(echo "$REG_B" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
test -n "$TOKEN_A" && test -n "$USER_A" && test -n "$TOKEN_B"
echo "userA=${USER_A:0:16}…"

echo "== keys smoke: generate P-256 identity + prekeys =="
# Resolve workspace package from monorepo root (pnpm node_modules layout).
KEYS_JSON=$(cd "$ROOT" && node "$SCRIPT_DIR/smoke-keys-gen.mjs")
BUNDLE=$(echo "$KEYS_JSON" | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{const j=JSON.parse(s);process.stdout.write(JSON.stringify(j.bundle))})')
PREKEYS=$(echo "$KEYS_JSON" | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{const j=JSON.parse(s);process.stdout.write(JSON.stringify(j.prekeys))})')

echo "== keys smoke: A PUT /v1/keys/bundle =="
PUT_B=$(curl -sf -X PUT "$BASE/v1/keys/bundle" \
  -H "Authorization: Bearer $TOKEN_A" -H 'content-type: application/json' \
  -d "$BUNDLE")
echo "$PUT_B" | grep -q '"ok":true'
echo "BUNDLE_UPLOAD_OK"

echo "== keys smoke: A PUT /v1/keys/prekeys =="
PUT_P=$(curl -sf -X PUT "$BASE/v1/keys/prekeys" \
  -H "Authorization: Bearer $TOKEN_A" -H 'content-type: application/json' \
  -d "$PREKEYS")
echo "$PUT_P" | grep -q '"ok":true'
echo "$PUT_P" | grep -q '"inserted":'
echo "PREKEYS_UPLOAD_OK"

echo "== keys smoke: B GET /v1/keys/:userAId =="
FETCH=$(curl -sf -H "Authorization: Bearer $TOKEN_B" "$BASE/v1/keys/$USER_A")
echo "$FETCH" | head -c 240; echo
echo "$FETCH" | grep -q '"identityKeyPub"'
echo "$FETCH" | grep -q '"signedPrekeyPub"'
echo "$FETCH" | grep -q '"signedPrekeySig"'
# Assert identityKeyPub is non-null / non-empty in first device with keys
node -e '
const j = JSON.parse(process.argv[1]);
const d = (j.devices || []).find((x) => x.identityKeyPub && x.signedPrekeyPub);
if (!d) throw new Error("no device with identity/signed prekey");
if (!d.identityKeyPub || !d.signedPrekeyPub || !d.signedPrekeySig) throw new Error("missing fields");
const id = JSON.parse(d.identityKeyPub);
if (!id.ecdh || !id.signing) throw new Error("identityKeyPub missing ecdh/signing");
if (d.signedPrekeyId == null) throw new Error("missing signedPrekeyId");
// GET consumes one OPK when present
if (!d.oneTimePrekey || d.oneTimePrekey.id == null || !d.oneTimePrekey.pub) {
  throw new Error("expected oneTimePrekey consumed on fetch");
}
console.log("PREKEY_CONSUMED_OK id=" + d.oneTimePrekey.id);
' "$FETCH"

echo "KEYS_P2P_OK"

echo "== keys smoke: X3DH + chat courier roundtrip =="
node "$SCRIPT_DIR/smoke-keys-x3dh.mjs" "$BASE"
echo "KEYS_X3DH_CHAT_OK"

echo "== keys smoke: libsignal seam fail-closed =="
node "$SCRIPT_DIR/smoke-libsignal-seam.mjs"
echo "KEYS_LIBSIGNAL_SEAM_OK"
