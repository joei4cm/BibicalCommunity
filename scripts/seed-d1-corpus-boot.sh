#!/usr/bin/env bash
# Seed boot corpora (cuvs+nasb) into D1 for preview Workers without R2.
# Tokens: LIVE_WORKERS_D1_CORPUS_OK | LIVE_WORKERS_D1_CORPUS_OPEN
# Does NOT close CORPUS_LIVE_R2_OK.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
BASE="${1:-${LIVE_API_BASE:-http://127.0.0.1:8787}}"
BOOTSTRAP_SECRET="${PLATFORM_ADMIN_BOOTSTRAP_SECRET:-dev-platform-admin-bootstrap}"

echo "== D1 corpus boot seed against $BASE =="
if ! curl -sf "$BASE/health" >/dev/null; then
  echo "LIVE_WORKERS_D1_CORPUS_OPEN reason=api_unreachable base=$BASE"
  echo "CORPUS_LIVE_R2_OPEN"
  exit 0
fi

HANDLE="d1boot$(date +%s)"
REG=$(curl -sf -X POST "$BASE/v1/auth/register" -H 'content-type: application/json' \
  -d "{\"handle\":\"$HANDLE\",\"password\":\"D1BootPass123!\",\"nickname\":\"D1Boot\",\"locale\":\"en\"}" || true)
if [[ -z "$REG" ]] || echo "$REG" | rg -q 'Just a moment|challenge-platform'; then
  echo "LIVE_WORKERS_D1_CORPUS_OPEN reason=register_blocked_or_failed"
  echo "CORPUS_LIVE_R2_OPEN"
  exit 0
fi
TOKEN=$(echo "$REG" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("token",""))')
test -n "$TOKEN"
AUTH="Authorization: Bearer $TOKEN"

curl -sf -X POST -H "$AUTH" -H 'content-type: application/json' \
  -d "{\"secret\":\"$BOOTSTRAP_SECRET\"}" \
  "$BASE/v1/admin/platform/bootstrap" >/dev/null

SEED=$(curl -sf -X POST -H "$AUTH" -H 'content-type: application/json' \
  "$BASE/v1/admin/corpus/d1-seed-boot" || true)
echo "$SEED" | head -c 400; echo
if ! echo "$SEED" | rg -q '"ok"\s*:\s*true'; then
  echo "LIVE_WORKERS_D1_CORPUS_OPEN reason=seed_failed"
  echo "CORPUS_LIVE_R2_OPEN"
  exit 0
fi

STATUS=$(curl -sf -H "$AUTH" "$BASE/v1/admin/corpus/d1-status" || true)
CUVS_N=$(echo "$STATUS" | python3 -c 'import sys,json
try:
  d=json.load(sys.stdin); print(int((d.get("counts") or {}).get("cuvs") or 0))
except Exception: print(0)')
NASB_N=$(echo "$STATUS" | python3 -c 'import sys,json
try:
  d=json.load(sys.stdin); print(int((d.get("counts") or {}).get("nasb") or 0))
except Exception: print(0)')
echo "d1-status cuvs=$CUVS_N nasb=$NASB_N mediaBound=$(echo "$STATUS" | python3 -c 'import sys,json
try: print(json.load(sys.stdin).get("mediaBound"))
except Exception: print("?")')"

DL=$(curl -sf "$BASE/v1/bible/corpus-download/cuvs?scope=boot&limit=5" || true)
SRC=$(echo "$DL" | python3 -c 'import sys,json
try: print(json.load(sys.stdin).get("source",""))
except Exception: print("")')
COUNT=$(echo "$DL" | python3 -c 'import sys,json
try: print(json.load(sys.stdin).get("chapterCount",0))
except Exception: print(0)')
echo "corpus-download source=$SRC chapterCount=$COUNT"

if [[ "$CUVS_N" -gt 0 && "$NASB_N" -gt 0 ]]; then
  if [[ "$SRC" == "d1" ]]; then
    echo "LIVE_WORKERS_D1_CORPUS_OK source=d1 chapters=$COUNT cuvs=$CUVS_N nasb=$NASB_N"
  else
    # Local/dev often has R2 MEDIA that wins over D1 — seed still proves D1 path.
    echo "LIVE_WORKERS_D1_CORPUS_OK seeded=1 download_source=$SRC (R2 preferred when MEDIA bound) cuvs=$CUVS_N nasb=$NASB_N"
  fi
else
  echo "LIVE_WORKERS_D1_CORPUS_OPEN reason=seed_counts_low cuvs=$CUVS_N nasb=$NASB_N"
fi
echo "CORPUS_LIVE_R2_OPEN reason=d1_fallback_only need=production_R2"
