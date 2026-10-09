#!/usr/bin/env bash
# Prove full public-domain WEB can be seeded to R2 (not git) and downloaded
# into a pack via corpus-download. Does not commit verse dumps.
set -euo pipefail
BASE="${1:-http://127.0.0.1:8787}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

curl -sf "$BASE/health" >/dev/null
pnpm --filter @logoshome/bible build >/dev/null

HANDLE="pdfull$(date +%s)"
REG=$(curl -sf -X POST "$BASE/v1/auth/register" -H 'content-type: application/json' \
  -d "{\"handle\":\"$HANDLE\",\"password\":\"PdFullPass123!\",\"nickname\":\"PdFull\",\"locale\":\"en\"}")
TOKEN=$(echo "$REG" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
test -n "$TOKEN"

# Seed full WEB only (KJV/ASV same path; keep smoke time bounded)
node scripts/seed-r2-pd-full.mjs "$BASE" "$TOKEN" web

PACK_FILE=$(mktemp)
trap 'rm -f "$PACK_FILE"' EXIT
curl -sf "$BASE/v1/bible/corpus-download/web" -o "$PACK_FILE"
grep -q '"source":"r2"' "$PACK_FILE"
# Protestant canon ≈ 1189 chapters; allow small variance. Spot-check John.1 density.
node --input-type=module -e '
import { readFileSync } from "node:fs";
const j = JSON.parse(readFileSync(process.argv[1], "utf8"));
const count = j.chapterCount ?? j.chapters?.length ?? 0;
if (count < 1100) throw new Error("expected full WEB pack >=1100 chapters from R2, got " + count);
const john1 = j.chapters.find((c) => c.book === "John" && c.chapter === 1);
if (!john1 || john1.verses.length < 40) throw new Error("John.1 not full in pack");
console.log("CORPUS_PD_FULL_DOWNLOAD_OK tid=web chapters=" + count + " john1verses=" + john1.verses.length);
' "$PACK_FILE"

echo "CORPUS_PD_FULL_R2_OK"
