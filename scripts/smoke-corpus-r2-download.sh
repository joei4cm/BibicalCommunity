#!/usr/bin/env bash
# Prove fixtures/corpus → R2 put → corpus-download prefix pack for boot + teaching peers.
# No TypeScript densify. Local wrangler R2 binding is the 2D path under test here.
set -euo pipefail
BASE="${1:-http://127.0.0.1:8787}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

curl -sf "$BASE/health" >/dev/null
pnpm --filter @logoshome/bible build >/dev/null

HANDLE="r2dl$(date +%s)"
REG=$(curl -sf -X POST "$BASE/v1/auth/register" -H 'content-type: application/json' \
  -d "{\"handle\":\"$HANDLE\",\"password\":\"R2DownloadPass123!\",\"nickname\":\"R2DL\",\"locale\":\"zh-CN\"}")
TOKEN=$(echo "$REG" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
test -n "$TOKEN"

node scripts/seed-r2-from-json-fixtures.mjs "$BASE" "$TOKEN" >/tmp/corpus-r2-seed.log
tail -n 3 /tmp/corpus-r2-seed.log

TEACHING_TIDS=(cuvs web shinKyoudou kjv asv cuvt kougo rcuv ccb lzz shinkaiyaku)
for tid in "${TEACHING_TIDS[@]}"; do
  PACK=$(curl -sf "$BASE/v1/bible/corpus-download/$tid")
  echo "$PACK" | grep -q "\"translationId\":\"$tid\""
  echo "$PACK" | grep -q '"source":"r2"'
  echo "$PACK" | grep -q '"r2Prefix"'
  COUNT=$(node -e 'const j=JSON.parse(process.argv[1]); process.stdout.write(String(j.chapterCount??j.chapters?.length??0))' "$PACK")
  if [[ "$COUNT" -lt 7 ]]; then
    echo "expected >=7 R2 chapters for $tid, got $COUNT" >&2
    exit 1
  fi
  echo "CORPUS_R2_DOWNLOAD_OK tid=$tid chapters=$COUNT"
done

# External must stay blocked
CODE=$(curl -s -o /tmp/corpus-esv-r2.json -w "%{http_code}" "$BASE/v1/bible/corpus-download/esv")
test "$CODE" = "400"
grep -q external_translation /tmp/corpus-esv-r2.json
echo "CORPUS_R2_EXTERNAL_BLOCK_OK tid=esv"

echo "CORPUS_R2_TEACHING_DOWNLOAD_OK tids=${#TEACHING_TIDS[@]}"
