#!/usr/bin/env bash
# Live Cloudflare R2 gate for production corpora.
# Without credentials: documents OPEN and exits 0 (local R2 path is covered by
# smoke-corpus-r2-download.sh / smoke-corpus-r2.sh).
# Set LIVE_R2=1 plus CLOUDFLARE_ACCOUNT_ID / R2 credentials to attempt a live probe.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ "${LIVE_R2:-}" != "1" ]]; then
  echo "INFO: LIVE_R2!=1 — skipping live Cloudflare R2 account probe"
  echo "INFO: local wrangler R2 binding still proven via smoke-corpus-r2*.sh"
  echo "CORPUS_LIVE_R2_OPEN"
  exit 0
fi

if [[ -z "${CLOUDFLARE_ACCOUNT_ID:-}" || -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "INFO: LIVE_R2=1 but CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN missing"
  echo "CORPUS_LIVE_R2_OPEN"
  exit 0
fi

echo "INFO: LIVE_R2=1 — live account probe not fully automated yet (use wrangler + seed-r2-from-json-fixtures)"
echo "CORPUS_LIVE_R2_OPEN"
exit 0
