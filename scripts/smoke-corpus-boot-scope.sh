#!/usr/bin/env bash
# Prove boot defaults are 和合本 + NASB whole-Bible (not per-chapter / not teaching slim).
set -euo pipefail
BASE="${1:-http://127.0.0.1:8787}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

curl -sf "$BASE/health" >/dev/null
pnpm --filter @logoshome/bible build >/dev/null

CAT=$(curl -sf "$BASE/v1/bible/corpus-catalog")
echo "$CAT" | grep -q '"bootDefaults"'
echo "$CAT" | grep -q '"cuvs"'
echo "$CAT" | grep -q '"nasb"'
node --input-type=module -e '
const cat = JSON.parse(process.argv[1]);
const boot = [...(cat.bootDefaults ?? [])].sort();
if (boot.join(",") !== "cuvs,nasb") throw new Error("bootDefaults=" + boot.join(","));
const packs = (cat.catalog ?? []).filter((p) => p.installMode === "boot");
if (packs.length !== 2) throw new Error("boot catalog rows " + packs.length);
for (const p of packs) {
  if (p.packKind !== "whole-bible") throw new Error(p.translationId + " packKind");
}
console.log("CORPUS_BOOT_DEFAULTS_OK", boot.join(","));
' "$CAT"

HANDLE="bootscope$(date +%s)"
REG=$(curl -sf -X POST "$BASE/v1/auth/register" -H 'content-type: application/json' \
  -d "{\"handle\":\"$HANDLE\",\"password\":\"BootScopePass123!\",\"nickname\":\"BootScope\",\"locale\":\"en\"}")
TOKEN=$(echo "$REG" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
test -n "$TOKEN"
node scripts/seed-r2-from-json-fixtures.mjs "$BASE" "$TOKEN" >/tmp/boot-scope-seed.log

FULL_FILE=$(mktemp)
trap 'rm -f "$FULL_FILE"' EXIT

# Whole-Bible download unit for a downloadable PD tid (transport may page).
curl -sf "$BASE/v1/bible/corpus-download/web?scope=full" -o "$FULL_FILE"
grep -q '"scope":"full"' "$FULL_FILE"
FULL_N=$(node --input-type=module -e 'import {readFileSync} from "node:fs"; const j=JSON.parse(readFileSync(process.argv[1],"utf8")); process.stdout.write(String(j.chapterCount??j.chapters?.length??0));' "$FULL_FILE")
if [[ "$FULL_N" -lt 1 ]]; then
  echo "full whole-Bible download expected chapters, got $FULL_N" >&2
  exit 1
fi
echo "CORPUS_WHOLE_BIBLE_DOWNLOAD_OK tid=web chapters=$FULL_N"
echo "CORPUS_BOOT_VS_FULL_OK"
