#!/usr/bin/env bash
# Platform-admin PD corpus seed → R2 (getbible, not TypeScript packs).
# Seeds John (book 43) + Gen (book 1) for WEB; proves gate + R2 write + download.
set -euo pipefail
BASE="${1:-${BASE:-http://127.0.0.1:8787}}"
PASS="${SMOKE_PASS:-SmokeTestPass123!}"
BOOTSTRAP_SECRET="${PLATFORM_ADMIN_BOOTSTRAP_SECRET:-dev-platform-admin-bootstrap}"

curl -sf "$BASE/health" >/dev/null

echo "== admin PD corpus: register + bootstrap =="
HANDLE="pdadmin$(date +%s)"
REG=$(curl -sf -X POST "$BASE/v1/auth/register" -H 'content-type: application/json' \
  -d "{\"handle\":\"$HANDLE\",\"password\":\"$PASS\",\"nickname\":\"PdAdmin\",\"locale\":\"en\"}")
TOKEN=$(echo "$REG" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
test -n "$TOKEN"
AUTH="Authorization: Bearer $TOKEN"

# Non-admin forbidden
CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "$AUTH" -H 'content-type: application/json' \
  -d '{"tid":"web","bookNr":43}' "$BASE/v1/admin/corpus/pd-seed")
test "$CODE" = "403"
echo "ADMIN_PD_SEED_DENY_OK"

BOOT=$(curl -sf -X POST -H "$AUTH" -H 'content-type: application/json' \
  -d "{\"secret\":\"$BOOTSTRAP_SECRET\"}" \
  "$BASE/v1/admin/platform/bootstrap")
echo "$BOOT" | grep -q '"platformRole":"platform_admin"'

META=$(curl -sf -H "$AUTH" "$BASE/v1/admin/corpus/pd-seed")
echo "$META" | grep -q '"web"'
echo "$META" | grep -q '"John"'
echo "ADMIN_PD_SEED_META_OK"

# Reject licensed / unknown tid
CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "$AUTH" -H 'content-type: application/json' \
  -d '{"tid":"cuvs","bookNr":43}' "$BASE/v1/admin/corpus/pd-seed")
test "$CODE" = "400"
echo "ADMIN_PD_SEED_LICENSED_DENY_OK"

echo "== seed WEB Gen + John (getbible → R2) =="
BEFORE=$(curl -sf -H "$AUTH" "$BASE/v1/admin/corpus/pd-status/web")
BEFORE_N=$(echo "$BEFORE" | sed -n 's/.*"objectCount":\([0-9]*\).*/\1/p')
test -n "$BEFORE_N"

GEN=$(curl -sf -X POST -H "$AUTH" -H 'content-type: application/json' \
  -d '{"tid":"web","bookNr":1}' "$BASE/v1/admin/corpus/pd-seed")
echo "$GEN" | grep -q '"book":"Gen"'
echo "$GEN" | grep -q '"ok":true'
GEN_N=$(echo "$GEN" | sed -n 's/.*"chaptersPut":\([0-9]*\).*/\1/p')
test "${GEN_N:-0}" -ge 40

JOHN=$(curl -sf -X POST -H "$AUTH" -H 'content-type: application/json' \
  -d '{"tid":"web","bookNr":43}' "$BASE/v1/admin/corpus/pd-seed")
echo "$JOHN" | grep -q '"book":"John"'
JOHN_N=$(echo "$JOHN" | sed -n 's/.*"chaptersPut":\([0-9]*\).*/\1/p')
test "${JOHN_N:-0}" -ge 20
echo "ADMIN_PD_SEED_BOOKS_OK gen=$GEN_N john=$JOHN_N"

AFTER=$(curl -sf -H "$AUTH" "$BASE/v1/admin/corpus/pd-status/web")
AFTER_N=$(echo "$AFTER" | sed -n 's/.*"objectCount":\([0-9]*\).*/\1/p')
test "$AFTER_N" -gt "$BEFORE_N"
echo "$AFTER" | grep -q '"sampleKeys"'
echo "ADMIN_PD_STATUS_OK objects=$AFTER_N"

# Download pack must come from R2 with dense John.1
PACK_FILE=$(mktemp)
trap 'rm -f "$PACK_FILE"' EXIT
curl -sf "$BASE/v1/bible/corpus-download/web" -o "$PACK_FILE"
grep -q '"source":"r2"' "$PACK_FILE"
node --input-type=module -e '
import { readFileSync } from "node:fs";
const j = JSON.parse(readFileSync(process.argv[1], "utf8"));
const john1 = (j.chapters ?? []).find((c) => c.book === "John" && c.chapter === 1);
if (!john1 || john1.verses.length < 40) {
  throw new Error("John.1 not full after admin PD seed, verses=" + (john1?.verses?.length ?? 0));
}
const gen1 = (j.chapters ?? []).find((c) => c.book === "Gen" && c.chapter === 1);
if (!gen1 || gen1.verses.length < 20) {
  throw new Error("Gen.1 missing after admin PD seed");
}
console.log("ADMIN_PD_DOWNLOAD_OK chapters=" + (j.chapterCount ?? j.chapters.length) + " john1=" + john1.verses.length);
' "$PACK_FILE"

echo "ADMIN_PD_CORPUS_OK"
