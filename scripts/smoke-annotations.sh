#!/usr/bin/env bash
# Annotations CRUD smoke: register → create highlight+bookmark+note → list → delete one.
set -euo pipefail
BASE="${1:-http://127.0.0.1:8787}"
PASS='SmokeTestPass123!'
HANDLE="annsmoke$(date +%s)"

echo "== annotations smoke: register =="
REG=$(curl -sf -X POST "$BASE/v1/auth/register" -H 'content-type: application/json' \
  -d "{\"handle\":\"$HANDLE\",\"password\":\"$PASS\",\"nickname\":\"AnnSmoke\",\"locale\":\"en\"}")
TOKEN=$(echo "$REG" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
test -n "$TOKEN"
AUTH="Authorization: Bearer $TOKEN"

# Opaque base64 stubs matching annotationSchema (client-encrypted payloads).
CT_HL='aGlnaGxpZ2h0LXNtb2tl'
IV_HL='aXY9aGw='
CT_BM='Ym9va21hcmstc21va2U='
IV_BM='aXY9Ym0='
CT_NOTE='bm90ZS1zbW9rZS1wYXlsb2Fk'
IV_NOTE='aXY9bm90ZQ=='

echo "== annotations smoke: create highlight =="
HL=$(curl -sf -X POST -H "$AUTH" -H 'content-type: application/json' \
  -d "{\"translationId\":\"web\",\"ref\":{\"book\":\"John\",\"chapter\":1,\"verseStart\":1,\"verseEnd\":1},\"kind\":\"highlight\",\"color\":\"amber\",\"ciphertext\":\"$CT_HL\",\"iv\":\"$IV_HL\"}" \
  "$BASE/v1/annotations")
echo "$HL" | head -c 120; echo
HL_ID=$(echo "$HL" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
echo "$HL" | grep -q '"id":"ann_'
test -n "$HL_ID"
echo "ANNOTATION_HIGHLIGHT_OK"

echo "== annotations smoke: create bookmark =="
BM=$(curl -sf -X POST -H "$AUTH" -H 'content-type: application/json' \
  -d "{\"translationId\":\"web\",\"ref\":{\"book\":\"John\",\"chapter\":1,\"verseStart\":3},\"kind\":\"bookmark\",\"ciphertext\":\"$CT_BM\",\"iv\":\"$IV_BM\"}" \
  "$BASE/v1/annotations")
echo "$BM" | head -c 120; echo
BM_ID=$(echo "$BM" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
echo "$BM" | grep -q '"id":"ann_'
test -n "$BM_ID"
echo "ANNOTATION_BOOKMARK_OK"

echo "== annotations smoke: create note =="
NOTE=$(curl -sf -X POST -H "$AUTH" -H 'content-type: application/json' \
  -d "{\"translationId\":\"web\",\"ref\":{\"book\":\"John\",\"chapter\":1,\"verseStart\":1,\"verseEnd\":1},\"kind\":\"note\",\"ciphertext\":\"$CT_NOTE\",\"iv\":\"$IV_NOTE\"}" \
  "$BASE/v1/annotations")
echo "$NOTE" | head -c 120; echo
NOTE_ID=$(echo "$NOTE" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
echo "$NOTE" | grep -q '"id":"ann_'
test -n "$NOTE_ID"
echo "ANNOTATION_NOTE_OK"

echo "== annotations smoke: list =="
LIST=$(curl -sf -H "$AUTH" "$BASE/v1/annotations?translation=web")
echo "$LIST" | head -c 240; echo
echo "$LIST" | grep -q "$HL_ID"
echo "$LIST" | grep -q "$BM_ID"
echo "$LIST" | grep -q "$NOTE_ID"
echo "$LIST" | grep -q '"kind":"highlight"'
echo "$LIST" | grep -q '"kind":"bookmark"'
echo "$LIST" | grep -q '"kind":"note"'
# Count kinds via node for a firm assertion
node -e '
const j = JSON.parse(process.argv[1]);
const anns = j.annotations || [];
if (anns.length < 3) throw new Error("expected >=3 annotations, got " + anns.length);
const kinds = new Set(anns.map((a) => a.kind));
for (const k of ["highlight", "bookmark", "note"]) {
  if (!kinds.has(k)) throw new Error("missing kind " + k);
}
console.log("ANNOTATION_LIST_OK count=" + anns.length);
' "$LIST"

echo "== annotations smoke: delete highlight =="
DEL=$(curl -sf -X DELETE -H "$AUTH" "$BASE/v1/annotations/$HL_ID")
echo "$DEL" | head -c 120; echo
echo "$DEL" | grep -q '"ok":true'
AFTER=$(curl -sf -H "$AUTH" "$BASE/v1/annotations?translation=web")
if echo "$AFTER" | grep -q "$HL_ID"; then
  echo "highlight still present after delete" >&2
  exit 1
fi
echo "$AFTER" | grep -q "$BM_ID"
echo "$AFTER" | grep -q "$NOTE_ID"
echo "ANNOTATION_DELETE_OK"

echo "ANNOTATIONS_SMOKE_OK"
