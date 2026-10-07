#!/usr/bin/env bash
# Partner OAuth URL evidence without wrangler mid-run env toggles.
# Proves: (a) SSO off → deep link; (c) SSO on + client_id → real authorize URL.
# (b) mock closed loop remains in scripts/smoke-api.sh (SSO_* / WEREAD_SSO_*).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/packages/bible"
echo "== partner oauth URL unit tests =="
npm test -- src/partners.test.ts
echo "PARTNER_OAUTH_URL_OK"
