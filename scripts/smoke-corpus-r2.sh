#!/usr/bin/env bash
# Prove licensed corpus R2 put → chapter get (source=r2) across zh/ja translations.
set -euo pipefail
BASE="${1:-http://127.0.0.1:8787}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

curl -sf "$BASE/health" >/dev/null
pnpm --filter @logoshome/bible build >/dev/null

HANDLE="corpusr2$(date +%s)"
REG=$(curl -sf -X POST "$BASE/v1/auth/register" -H 'content-type: application/json' \
  -d "{\"handle\":\"$HANDLE\",\"password\":\"CorpusR2Pass123!\",\"nickname\":\"CorpusR2\",\"locale\":\"zh\"}")
TOKEN=$(echo "$REG" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
test -n "$TOKEN"
AUTH="Authorization: Bearer $TOKEN"

put_and_verify() {
  local tid="$1"
  local book="$2"
  local chapter="$3"
  local v1="$4"
  local marker="R2_${tid}_$(date +%s)_$RANDOM"

  local body
  body=$(MARKER="$marker" BOOK="$book" CHAPTER="$chapter" TID="$tid" V1="$v1" node --input-type=module -e '
import { buildR2ChapterJson, r2ChapterObjectKey } from "./packages/bible/dist/index.js";
const tid = process.env.TID;
const book = process.env.BOOK;
const chapter = Number(process.env.CHAPTER);
const marker = process.env.MARKER;
const v1 = process.env.V1;
const payload = buildR2ChapterJson({
  book,
  chapter,
  verses: [
    { verse: 1, text: v1 },
    { verse: 99, text: marker },
  ],
});
process.stdout.write(JSON.stringify({ key: r2ChapterObjectKey(tid, book, chapter), payload, marker }));
')

  local key payload
  key=$(node -e 'const j=JSON.parse(process.argv[1]); process.stdout.write(j.key)' "$body")
  payload=$(node -e 'const j=JSON.parse(process.argv[1]); process.stdout.write(j.payload)' "$body")

  curl -sf -X PUT "$BASE/v1/media/put/$key" -H "$AUTH" -H 'content-type: application/json' -d "$payload" >/dev/null

  local ch
  ch=$(curl -sf "$BASE/v1/bible/chapter?translation=${tid}&ref=${book}.${chapter}")
  echo "$ch" | grep -q '"source":"r2"'
  echo "$ch" | grep -q "$marker"
  echo "$ch" | grep -qF "$v1"
  echo "CORPUS_R2_OK tid=$tid ref=${book}.${chapter} key=$key"
}

# zh + ja licensed R2 providers (John.1 baseline + key peer tids)
put_and_verify cuvs John 1 "太初有道，道与神同在，道就是神。"
put_and_verify cuvt John 1 "太初有道，道與神同在，道就是神。"
put_and_verify kougo John 1 "初めに言があった。言は神と共にあった。言は神であった。"
put_and_verify rcuv John 1 "太初有道，道与神同在，道就是神。"
put_and_verify ccb John 1 "太初有道，道与上帝同在，道就是上帝。"
put_and_verify lzz John 1 "太初有道，道与神同在，道就是神。"
put_and_verify shinkaiyaku John 1 "初めに言があった。言は神と共にあった。言は神であった。"
put_and_verify shinKyoudou John 1 "初めに言があった。言は神と共にあった。言は神であった。"

# Additional chapter put→get for denser dual-pane / teaching-set refs
put_and_verify cuvs John 14 "你们心里不要忧愁；你们信神，也当信我。"
put_and_verify cuvt John 14 "你們心裏不要憂愁；你們信神，也當信我。"
put_and_verify rcuv Matt 5 "虚心的人有福了！因为天国是他们的。"
put_and_verify ccb Rom 8 "所以，如今那些在基督耶稣里的人就不再被定罪了。"
put_and_verify kougo Rom 8 "こういうわけで、今や、キリスト・イエスにある者は罪に定められることがない。"
put_and_verify lzz Heb 11 "信就是所望之事的实底，是未见之事的确据。"
put_and_verify shinkaiyaku Isa 53 "だれが私たちの聞いたことを信じたか。主の腕は、だれに現れたか。"
put_and_verify shinKyoudou 1John 4 "愛する者たちよ。わたしたちは互に愛し合おうではないか。"

# Pack catalog still lists licensed stubs for full-corpus entitlement path.
CP=$(curl -sf "$BASE/v1/bible/corpus-packs?provider=r2")
echo "$CP" | grep -q 'cuvs-r2'
echo "$CP" | grep -q 'kougo-r2'
echo "$CP" | grep -q 'cuvt-r2'
echo "$CP" | grep -q 'rcuv-r2'
echo "$CP" | grep -q 'ccb-r2'
echo "$CP" | grep -q 'lzz-r2'

echo "CORPUS_R2_CHAPTER_OK translations=cuvs,cuvt,kougo,rcuv,ccb,lzz,shinkaiyaku,shinKyoudou"
