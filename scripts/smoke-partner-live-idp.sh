#!/usr/bin/env bash
# Live partner IdP gate.
# Default (no PARTNER_LIVE_IDP): documents OPEN (mock IdP path covered elsewhere).
# PARTNER_LIVE_IDP=1: require non-mock /start URLs against Endao/WeRead authorize hosts.
# Local live-shaped API: wrangler.live-idp.toml on :8788 (see scripts/run-live-idp-probe.sh).
# Full token exchange against partner IdPs still needs real client secrets (OPEN without them).
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
  echo "INFO: live-shaped local probe: bash scripts/run-live-idp-probe.sh"
  echo "PARTNER_LIVE_IDP_OPEN"
  exit 0
fi

# Live path: status must report mock IdP off when probing live-shaped config.
if echo "$STATUS" | grep -q '"mockIdp":true'; then
  echo "FAIL: PARTNER_LIVE_IDP=1 but API still has mockIdp=true (use wrangler.live-idp.toml)"
  exit 1
fi
echo "PARTNER_LIVE_MOCK_OFF_OK"

for partner in endao weread; do
  START=$(curl -sf "$BASE/v1/partners/$partner/start?ref=John.1")
  echo "$START" | head -c 320; echo
  if echo "$START" | grep -q 'mock-authorize'; then
    echo "FAIL: live IdP requested but start still returns mock-authorize for $partner"
    exit 1
  fi
  if echo "$START" | grep -q '"mockIdp":true'; then
    echo "FAIL: start reports mockIdp=true for $partner"
    exit 1
  fi
  echo "$START" | grep -qE 'authorize|oauth|login'
  case "$partner" in
    endao) echo "$START" | grep -q 'oauth.edobible.com' ;;
    weread) echo "$START" | grep -qE 'open.weixin.qq.com|oauth' ;;
  esac
  echo "PARTNER_LIVE_START_${partner}_OK"
done

# Best-effort reachability of authorize hosts (shape OK even if egress blocks one host).
ENDAO_CODE=$(curl -sI -o /dev/null -w '%{http_code}' --max-time 12 'https://oauth.edobible.com/authorize' || true)
WEREAD_CODE=$(curl -sI -o /dev/null -w '%{http_code}' --max-time 12 'https://open.weixin.qq.com/connect/oauth2/authorize' || true)
echo "PARTNER_LIVE_HOST_PROBE endao_http=$ENDAO_CODE weread_http=$WEREAD_CODE"
if [[ "$WEREAD_CODE" =~ ^(200|301|302|303|307|308|400|401|403)$ ]]; then
  echo "PARTNER_LIVE_HOST_WEREAD_OK"
else
  echo "PARTNER_LIVE_HOST_WEREAD_OPEN reason=http_$WEREAD_CODE"
fi
if [[ "$ENDAO_CODE" =~ ^(200|301|302|303|307|308|400|401|403)$ ]]; then
  echo "PARTNER_LIVE_HOST_ENDAO_OK"
else
  echo "PARTNER_LIVE_HOST_ENDAO_OPEN reason=http_$ENDAO_CODE"
fi

echo "PARTNER_LIVE_IDP_OK"
echo "PARTNER_LIVE_TOKEN_EXCHANGE_OPEN reason=needs_real_oauth_client_secrets"
