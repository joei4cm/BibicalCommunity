#!/usr/bin/env bash
# Prove full PD corpus-download can be paged (limit/after) without one huge JSON.
set -euo pipefail
BASE="${1:-http://127.0.0.1:8787}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

curl -sf "$BASE/health" >/dev/null

PAGE1=$(mktemp)
PAGE2=$(mktemp)
trap 'rm -f "$PAGE1" "$PAGE2"' EXIT

curl -sf "$BASE/v1/bible/corpus-download/web?scope=full&limit=50" -o "$PAGE1"
grep -q '"scope":"full"' "$PAGE1"
N1=$(node --input-type=module -e 'import {readFileSync} from "node:fs"; const j=JSON.parse(readFileSync(process.argv[1],"utf8")); if(j.chapterCount!==50) throw new Error("page1 expected 50 got "+j.chapterCount); if(j.done) throw new Error("page1 should not be done"); if(!j.nextAfter) throw new Error("missing nextAfter"); if((j.totalChapterKeys??0)<100) throw new Error("totalChapterKeys too small"); process.stdout.write(String(j.nextAfter));' "$PAGE1")
echo "CORPUS_PAGED_PAGE1_OK after=$N1"

curl -sf "$BASE/v1/bible/corpus-download/web?scope=full&limit=50&after=$(python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=""))' "$N1")" -o "$PAGE2"
N2=$(node --input-type=module -e 'import {readFileSync} from "node:fs"; const j=JSON.parse(readFileSync(process.argv[1],"utf8")); if(j.chapterCount<1) throw new Error("page2 empty"); process.stdout.write(String(j.chapterCount));' "$PAGE2")
echo "CORPUS_PAGED_PAGE2_OK chapters=$N2"

# Walk all pages with limit=200 and sum
TOTAL=$(node --input-type=module -e '
const BASE=process.argv[1];
let after=null, sum=0, pages=0, totalKeys=null;
for (;;) {
  const qs=new URLSearchParams({scope:"full", limit:"200"});
  if(after) qs.set("after", after);
  const res=await fetch(BASE+"/v1/bible/corpus-download/web?"+qs.toString());
  if(!res.ok) throw new Error("status "+res.status);
  const j=await res.json();
  sum += j.chapterCount??0;
  totalKeys = j.totalChapterKeys ?? totalKeys;
  pages += 1;
  if(j.done || !j.nextAfter) break;
  after = j.nextAfter;
  if(pages>20) throw new Error("too many pages");
}
if(sum < 1100) throw new Error("paged sum too small "+sum);
if(totalKeys!=null && sum!==totalKeys) throw new Error("sum "+sum+" != totalKeys "+totalKeys);
console.log("CORPUS_PAGED_FULL_WALK_OK pages="+pages+" chapters="+sum);
' "$BASE")

echo "$TOTAL"
echo "CORPUS_PAGED_DOWNLOAD_OK"
