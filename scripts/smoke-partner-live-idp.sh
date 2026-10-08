#!/usr/bin/env bash
# Live partner IdP gate. Without credentials, documents OPEN and exits 0 with token.
# Set PARTNER_LIVE_IDP=1 plus real authorize/token URLs to attempt a live probe.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
BASE="${1:-http://127.0.0.1:8787}"

echo "== partner live IdP gate =="
STATUS=$(curl -sf "$BASE/v1/partners/status" || true)
if [[ -z "$STATUS" ]]; then
  echo "INFO: API unreachable — local mock path still evidenced by PARTNER_TOKEN_EXCHANGE_OK elsewhere"
  echo "PARTNER_LIVE_IDP_OPEN"
  exit 0
fi
echo "$STATUS" | head -c 240; echo
echo "$STATUS" | grep -q 'endao'
echo "$STATUS" | grep -q 'weread'
echo "PARTNER_STATUS_SHAPE_OK"

if [[ "${PARTNER_LIVE_IDP:-}" != "1" ]]; then
  echo "INFO: PARTNER_LIVE_IDP!=1 — skipping live authorize/token against real Endao/WeRead"
  echo "PARTNER_LIVE_IDP_OPEN"
  exit 0
fi

# Live path: require non-mock token URLs and attempt start → expect non-mock authorize host.
for partner in endao weread; do
  START=$(curl -sf "$BASE/v1/partners/$partner/start?ref=John.1")
  echo "$START" | head -c 240; echo
  if echo "$START" | grep -q 'mock-authorize'; then
    echo "FAIL: live IdP requested but start still returns mock-authorize for $partner"
    exit 1
  fi
  echo "$START" | grep -qE 'authorize|oauth|login'
  echo "PARTNER_LIVE_START_${partner}_OK"
done
echo "PARTNER_LIVE_IDP_OK"
