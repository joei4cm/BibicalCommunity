#!/usr/bin/env bash
# Aggregate remaining /goal OPEN gates with current evidence (does not invent PASS).
# Tokens printed: GOAL_OPEN_GATES_OK + each CORPUS_LIVE_R2_OPEN / PARTNER_LIVE_IDP_OPEN /
# DEVICE_HANDSET_E2E_OPEN / LIBSIGNAL_WORKERS_OPEN line from child smokes.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== goal OPEN gates (evidence only) =="

bash scripts/live-r2-bootstrap.sh | tee /tmp/goal-open-r2.log | tail -5
grep -q 'CORPUS_LIVE_R2_OPEN\|CORPUS_LIVE_R2_OK' /tmp/goal-open-r2.log

bash scripts/smoke-partner-live-idp.sh | tee /tmp/goal-open-idp.log | tail -8
grep -q 'PARTNER_LIVE_IDP_OPEN\|PARTNER_LIVE_IDP_OK' /tmp/goal-open-idp.log

bash scripts/smoke-device-crypto.sh | tee /tmp/goal-open-device.log | tail -12
grep -q 'DEVICE_HANDSET_E2E_OPEN\|DEVICE_HANDSET_E2E_OK' /tmp/goal-open-device.log

bash scripts/smoke-libsignal-workers.sh | tee /tmp/goal-open-libsignal.log | tail -8
grep -q 'LIBSIGNAL_WORKERS_OPEN\|LIBSIGNAL_WORKERS_OK' /tmp/goal-open-libsignal.log

OPEN=0
grep -q 'CORPUS_LIVE_R2_OPEN' /tmp/goal-open-r2.log && OPEN=$((OPEN + 1)) || true
grep -q 'PARTNER_LIVE_IDP_OPEN' /tmp/goal-open-idp.log && OPEN=$((OPEN + 1)) || true
grep -q 'DEVICE_HANDSET_E2E_OPEN' /tmp/goal-open-device.log && OPEN=$((OPEN + 1)) || true
grep -q 'LIBSIGNAL_WORKERS_OPEN' /tmp/goal-open-libsignal.log && OPEN=$((OPEN + 1)) || true

echo "GOAL_OPEN_GATES_OK remaining=$OPEN need=CF_R2_token,partner_live_IdP,physical_handset,official_workers_libsignal_wasm"
