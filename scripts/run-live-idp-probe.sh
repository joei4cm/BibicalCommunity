#!/usr/bin/env bash
# Start live-shaped partner IdP API (mock off) and run PARTNER_LIVE_IDP=1 smoke.
# Leaves the process in tmux session `api-live-idp` when already running.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PORT="${LIVE_IDP_PORT:-8788}"
BASE="http://127.0.0.1:${PORT}"
SESSION="api-live-idp"
TMUX_CFG="/exec-daemon/tmux.portal.conf"

if ! curl -sf "$BASE/health" >/dev/null 2>&1; then
  echo "== starting wrangler.live-idp.toml on :$PORT =="
  if [[ -f "$TMUX_CFG" ]]; then
    tmux -f "$TMUX_CFG" has-session -t "=$SESSION" 2>/dev/null || \
      tmux -f "$TMUX_CFG" new-session -d -s "$SESSION" -c "$ROOT/apps/api" -- "${SHELL:-bash}" -l
    sleep 1
    tmux -f "$TMUX_CFG" send-keys -t "$SESSION:0.0" \
      "cd $ROOT/apps/api && pnpm exec wrangler dev -c wrangler.live-idp.toml --ip 127.0.0.1 --port $PORT" C-m
  else
    (cd "$ROOT/apps/api" && pnpm exec wrangler dev -c wrangler.live-idp.toml --ip 127.0.0.1 --port "$PORT") >/tmp/live-idp-wrangler.log 2>&1 &
  fi
  for i in $(seq 1 45); do
    if curl -sf "$BASE/health" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
fi

if ! curl -sf "$BASE/health" >/dev/null; then
  echo "FAIL: live-idp API did not become healthy at $BASE"
  exit 1
fi
echo "LIVE_IDP_API_OK base=$BASE"

PARTNER_LIVE_IDP=1 bash "$ROOT/scripts/smoke-partner-live-idp.sh" "$BASE"
