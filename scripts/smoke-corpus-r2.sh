#!/usr/bin/env bash
# Prove licensed corpus R2 put → chapter get (source=r2) on local Workers.
set -euo pipefail
BASE="${1:-http://127.0.0.1:8787}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

curl -sf "$BASE/health" >/dev/null

HANDLE="corpusr2$(date +%s)"
REG=$(curl -sf -X POST "$BASE/v1/auth/register" -H 'content-type: application/json' \
  -d "{\"handle\":\"$HANDLE\",\"password\":\"CorpusR2Pass123!\",\"nickname\":\"CorpusR2\",\"locale\":\"zh\"}")
TOKEN=$(echo "$REG" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
test -n "$TOKEN"
AUTH="Authorization: Bearer $TOKEN"

# Unique marker so we know the chapter came from R2, not local scaffold fallback.
MARKER="R2_CORPUS_SMOKE_$(date +%s)"
BODY=$(node --input-type=module -e '
import { buildR2ChapterJson, r2ChapterObjectKey } from "./packages/bible/dist/index.js";
const marker = process.argv[1];
const payload = buildR2ChapterJson({
  book: "John",
  chapter: 1,
  verses: [
    { verse: 1, text: "太初有道，道与神同在，道就是神。" },
    { verse: 14, text: "道成了肉身，住在我们中间。" },
    { verse: 99, text: marker },
  ],
});
process.stdout.write(JSON.stringify({ key: r2ChapterObjectKey("cuvs", "John", 1), payload }));
' "$MARKER")

KEY=$(node -e 'const j=JSON.parse(process.argv[1]); process.stdout.write(j.key)' "$BODY")
PAYLOAD=$(node -e 'const j=JSON.parse(process.argv[1]); process.stdout.write(j.payload)' "$BODY")

curl -sf -X PUT "$BASE/v1/media/put/$KEY" -H "$AUTH" -H 'content-type: application/json' -d "$PAYLOAD" >/dev/null

CH=$(curl -sf "$BASE/v1/bible/chapter?translation=cuvs&ref=John.1")
echo "$CH" | grep -q '"source":"r2"'
echo "$CH" | grep -q "$MARKER"
echo "$CH" | grep -q '太初有道'

# Pack catalog still lists licensed stub for full corpus entitlement path.
CP=$(curl -sf "$BASE/v1/bible/corpus-packs?provider=r2")
echo "$CP" | grep -q 'cuvs-r2'

echo "CORPUS_R2_CHAPTER_OK key=$KEY marker=$MARKER"
