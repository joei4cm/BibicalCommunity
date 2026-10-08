#!/usr/bin/env bash
# Prove boot seed stays slim while full PD pack remains available on demand.
set -euo pipefail
BASE="${1:-http://127.0.0.1:8787}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

curl -sf "$BASE/health" >/dev/null
pnpm --filter @logoshome/bible build >/dev/null

# Ensure at least teaching WEB is on R2 (full may already be present from prior smokes)
HANDLE="bootscope$(date +%s)"
REG=$(curl -sf -X POST "$BASE/v1/auth/register" -H 'content-type: application/json' \
  -d "{\"handle\":\"$HANDLE\",\"password\":\"BootScopePass123!\",\"nickname\":\"BootScope\",\"locale\":\"en\"}")
TOKEN=$(echo "$REG" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
test -n "$TOKEN"
node scripts/seed-r2-from-json-fixtures.mjs "$BASE" "$TOKEN" >/tmp/boot-scope-seed.log

BOOT=$(curl -sf "$BASE/v1/bible/corpus-download/web?scope=boot")
echo "$BOOT" | grep -q '"scope":"boot"'
echo "$BOOT" | grep -q '"bootTeachingOnly":true'
BOOT_N=$(node -e 'const j=JSON.parse(process.argv[1]); process.stdout.write(String(j.chapterCount??0))' "$BOOT")
if [[ "$BOOT_N" -gt 12 ]]; then
  echo "boot scope must stay slim, got $BOOT_N chapters" >&2
  exit 1
fi
if [[ "$BOOT_N" -lt 3 ]]; then
  echo "boot scope expected teaching chapters, got $BOOT_N" >&2
  exit 1
fi
echo "CORPUS_BOOT_SCOPE_OK tid=web chapters=$BOOT_N"

FULL_FILE=$(mktemp)
trap 'rm -f "$FULL_FILE"' EXIT
curl -sf "$BASE/v1/bible/corpus-download/web?scope=full" -o "$FULL_FILE"
grep -q '"scope":"full"' "$FULL_FILE"
FULL_N=$(node --input-type=module -e 'import {readFileSync} from "node:fs"; const j=JSON.parse(readFileSync(process.argv[1],"utf8")); process.stdout.write(String(j.chapterCount??0));' "$FULL_FILE")
if [[ "$FULL_N" -le "$BOOT_N" ]]; then
  echo "full scope should exceed boot ($BOOT_N), got $FULL_N" >&2
  exit 1
fi
echo "CORPUS_FULL_SCOPE_OK tid=web chapters=$FULL_N"
echo "CORPUS_BOOT_VS_FULL_OK"
