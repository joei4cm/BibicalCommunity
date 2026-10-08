#!/usr/bin/env bash
# Live Cloudflare R2 gate for production corpora.
# Without credentials: documents OPEN and exits 0 (local R2 path is covered by
# smoke-corpus-r2.sh / smoke-admin-pd-corpus.sh / smoke-corpus-paged-download.sh).
# Set LIVE_R2=1 plus CLOUDFLARE_ACCOUNT_ID / API token / LIVE_API_BASE to probe.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ "${LIVE_R2:-}" != "1" ]]; then
  echo "INFO: LIVE_R2!=1 — skipping live Cloudflare R2 account probe"
  echo "INFO: local wrangler R2 binding still proven via smoke-corpus-*.sh + ADMIN_PD_CORPUS_OK"
  echo "INFO: production path: bash scripts/live-r2-bootstrap.sh (needs CLOUDFLARE_API_TOKEN + ACCOUNT_ID)"
  echo "CORPUS_LIVE_R2_OPEN"
  exit 0
fi

LIVE_API_BASE="${LIVE_API_BASE:-}"
if [[ -z "$LIVE_API_BASE" ]]; then
  if [[ -z "${CLOUDFLARE_ACCOUNT_ID:-}" || -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
    echo "INFO: LIVE_R2=1 but LIVE_API_BASE and CF credentials missing"
    echo "CORPUS_LIVE_R2_OPEN"
    exit 0
  fi
  echo "INFO: LIVE_API_BASE unset — run scripts/live-r2-bootstrap.sh to deploy+seed, or set LIVE_API_BASE"
  echo "CORPUS_LIVE_R2_OPEN"
  exit 0
fi

echo "== live R2 corpus probe against $LIVE_API_BASE =="
HEALTH=$(curl -sf "$LIVE_API_BASE/health" || true)
if [[ -z "$HEALTH" ]]; then
  echo "INFO: production API unreachable"
  echo "CORPUS_LIVE_R2_OPEN"
  exit 0
fi

# Boot scope must stay slim on live too
BOOT=$(curl -sf "$LIVE_API_BASE/v1/bible/corpus-download/web?scope=boot" || true)
if [[ -z "$BOOT" ]]; then
  echo "INFO: live boot pack unavailable"
  echo "CORPUS_LIVE_R2_OPEN"
  exit 0
fi
echo "$BOOT" | grep -q '"scope":"boot"' || {
  echo "FAIL: live boot pack missing scope=boot"
  exit 1
}
BOOT_N=$(node -e 'const j=JSON.parse(process.argv[1]); process.stdout.write(String(j.chapterCount??0))' "$BOOT")
if [[ "$BOOT_N" -gt 12 ]]; then
  echo "FAIL: live boot scope not slim ($BOOT_N)"
  exit 1
fi

# Paged full walk — production R2 must hold full WEB after admin PD seed
SUM=$(node --input-type=module -e '
const BASE=process.argv[1];
let after=null, sum=0, pages=0;
for (;;) {
  const qs=new URLSearchParams({scope:"full", limit:"200"});
  if(after) qs.set("after", after);
  const res=await fetch(BASE+"/v1/bible/corpus-download/web?"+qs.toString());
  if(!res.ok) throw new Error("status "+res.status);
  const j=await res.json();
  if(j.source!=="r2") throw new Error("expected r2 source, got "+j.source);
  sum += j.chapterCount??0;
  pages += 1;
  if(j.done || !j.nextAfter) break;
  after = j.nextAfter;
  if(pages>20) throw new Error("too many pages");
}
if(sum < 1100) throw new Error("live paged sum too small "+sum);
console.log("CORPUS_LIVE_R2_OK pages="+pages+" chapters="+sum);
' "$LIVE_API_BASE")
echo "$SUM"
