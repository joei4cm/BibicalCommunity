#!/usr/bin/env bash
# Static/client gates: i18n keys, PWA config, crypto unit tests, security audit.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== crypto unit tests =="
pnpm --filter @logoshome/crypto test
echo "CRYPTO_TESTS_OK"

echo "== security audit =="
bash scripts/security-audit.sh
echo "SECURITY_AUDIT_OK"

echo "== i18n key gate =="
node --input-type=module -e '
import { catalogs } from "./packages/shared/dist/index.js";
const need = [
  "nav.bible","nav.plans","nav.home","nav.me","landing.theme",
  "security.wipe","security.deviceKeys","chat.archive","chat.screenShare",
  "reader.external.endao","reader.external.weread","plans.create","home.forum",
];
let fail = 0;
for (const loc of ["zh-CN","en","ja"]) {
  const c = catalogs[loc];
  if (!c) { console.error("missing catalog", loc); fail++; continue; }
  for (const k of need) {
    if (!c[k]) { console.error("MISSING", loc, k); fail++; }
  }
}
if (fail) process.exit(1);
console.log("I18N_KEYS_OK");
'

echo "== PWA gate =="
test -f apps/web/public/icon.svg
rg -q 'VitePWA' apps/web/vite.config.ts
rg -q 'short_name: "圣言家"' apps/web/vite.config.ts
rg -q 'THEME_IDS' apps/web/src/features/MePage.tsx apps/web/src/features/LandingPage.tsx
echo "PWA_THEME_OK"

echo "== PWA production build artifacts =="
(cd apps/web && pnpm exec vite build >/tmp/logoshome-vite-build.log)
test -f apps/web/dist/manifest.webmanifest
test -f apps/web/dist/sw.js
test -f apps/web/dist/registerSW.js
rg -q '圣言家|LogosHome' apps/web/dist/manifest.webmanifest
echo "PWA_BUILD_OK"

echo "CLIENT_GATES_OK"
