#!/usr/bin/env bash
# Encrypted storage smoke: session-aes + note envelope + field-crypto + annotation opaque store.
set -euo pipefail
BASE="${1:-http://127.0.0.1:8787}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PASS='SmokeTestPass123!'
HANDLE="storagesmoke$(date +%s)"

echo "== storage smoke: session-aes + note envelope roundtrip =="
(cd "$ROOT" && node --input-type=module -e '
import {
  deriveSessionKey,
  encryptSessionPayload,
  decryptSessionPayload,
  generateNoteKey,
  encryptJson,
  decryptJson,
} from "./packages/crypto/dist/index.js";

const key = await deriveSessionKey("smoke-session-material-v1");
const enc = await encryptSessionPayload(key, "hello encrypted storage", "msg");
const pt = await decryptSessionPayload(key, enc.ratchetHeader, enc.ciphertext, "msg");
if (pt !== "hello encrypted storage") throw new Error("session-aes mismatch");
console.log("SESSION_AES_OK");

const noteKey = await generateNoteKey();
const sealed = await encryptJson(noteKey, { text: "private note body" }, "note");
const opened = await decryptJson(noteKey, sealed.ciphertext, sealed.iv, "note");
if (opened.text !== "private note body") throw new Error("note envelope mismatch");
console.log("NOTE_ENVELOPE_OK");
')

echo "== storage smoke: field-crypto unit tests =="
pnpm --filter @logoshome/api exec node --import tsx --test src/services/field-crypto.test.ts
echo "FIELD_CRYPTO_OK"

echo "== storage smoke: profile field seal via API =="
REG=$(curl -sf -X POST "$BASE/v1/auth/register" -H 'content-type: application/json' \
  -d "{\"handle\":\"$HANDLE\",\"password\":\"$PASS\",\"nickname\":\"StorageNick\",\"locale\":\"en\"}")
TOKEN=$(echo "$REG" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
test -n "$TOKEN"
AUTH="Authorization: Bearer $TOKEN"

curl -sf -X PATCH -H "$AUTH" -H 'content-type: application/json' \
  -d '{"nickname":"SealedNick","legalName":"Legal Sealed","signature":"sig-sealed"}' \
  "$BASE/v1/me" | grep -q '"ok":true'
ME=$(curl -sf -H "$AUTH" "$BASE/v1/me")
echo "$ME" | grep -q '"nickname":"SealedNick"'
echo "$ME" | grep -q '"legalName":"Legal Sealed"'
echo "$ME" | grep -q '"signature":"sig-sealed"'
# Ensure ciphertext is not echoed as sealed blob in public profile API (plaintext open)
if echo "$ME" | grep -q 'v1\.[A-Za-z0-9+/=]*\.[A-Za-z0-9+/=]*'; then
  echo "sealed ciphertext leaked in /v1/me" >&2
  exit 1
fi
echo "FIELD_SEAL_API_OK"

echo "== storage smoke: annotation opaque ciphertext store =="
CT='c21va2Utc3RvcmFnZS1ub3Rl'
IV='aXY9c3RvcmFnZQ=='
NOTE=$(curl -sf -X POST -H "$AUTH" -H 'content-type: application/json' \
  -d "{\"translationId\":\"web\",\"ref\":{\"book\":\"John\",\"chapter\":1,\"verseStart\":1},\"kind\":\"note\",\"ciphertext\":\"$CT\",\"iv\":\"$IV\"}" \
  "$BASE/v1/annotations")
NOTE_ID=$(echo "$NOTE" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
test -n "$NOTE_ID"
LIST=$(curl -sf -H "$AUTH" "$BASE/v1/annotations?translation=web")
echo "$LIST" | grep -q "$NOTE_ID"
echo "$LIST" | grep -q "$CT"
echo "$LIST" | grep -q "$IV"
echo "ANNOTATION_OPAQUE_STORE_OK"

echo "STORAGE_SMOKE_OK"
