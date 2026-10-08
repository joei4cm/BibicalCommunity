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
  "nav.bible","nav.plans","nav.home","nav.admin","nav.me","landing.theme",
  "security.wipe","security.deviceKeys","chat.archive","chat.screenShare",
  "reader.external.endao","reader.external.weread","plans.create","home.forum",
  "home.joinChurch","home.joinSlug","home.membersPending","plans.advanceDay",
  "plans.devotionPlan","plans.todayReading","me.pendingVerify",
  "admin.title","admin.sectionUsers","admin.sectionHomes","admin.sectionGroups","admin.sectionWipe",
  "reader.corpusLocal","reader.corpusPartial","reader.corpusLicensedStub",
];
let fail = 0;
for (const loc of ["zh-CN","en","ja"]) {
  const c = catalogs[loc];
  if (!c) { console.error("missing catalog", loc); fail++; continue; }
  for (const k of need) {
    if (!c[k]) { console.error("MISSING", loc, k); fail++; }
  }
}
const zh = Object.keys(catalogs["zh-CN"] || {}).sort();
const en = Object.keys(catalogs.en || {}).sort();
const ja = Object.keys(catalogs.ja || {}).sort();
const all = new Set([...zh, ...en, ...ja]);
for (const k of all) {
  for (const [loc, keys] of [["zh-CN", zh], ["en", en], ["ja", ja]]) {
    if (!keys.includes(k)) { console.error("PARITY_MISSING", loc, k); fail++; }
  }
}
if (fail) process.exit(1);
console.log("I18N_KEYS_OK count=" + zh.length);
console.log("I18N_PARITY_OK");
'

echo "== reader skins + theme-pack pipeline + screen-share gate =="
rg -q 'READER_SKIN_IDS' apps/web/src/lib/reader-skins.ts
rg -q 'applyThemePack|ThemePackManifest' apps/web/src/lib/reader-skins.ts
rg -q 'data-reader-skin' apps/web/src/styles/global.css
rg -q 'reader.skin' packages/shared/src/i18n/catalogs.ts
bash scripts/smoke-theme-packs.sh
rg -q 'probeDisplayMedia|canStartScreenShare' apps/web/src/lib/screen-share.ts
rg -q 'canStartScreenShare' apps/web/src/features/ChatPanel.tsx
echo "READER_SKINS_OK"
echo "SCREEN_SHARE_GATE_OK"

echo "== curve25519 x25519 path =="
bash scripts/smoke-curve25519.sh
echo "== libsignal workers/browser gap gate =="
bash scripts/smoke-libsignal-workers.sh
echo "== product chat signal path (web+mobile createProductSignalClient) =="
bash scripts/smoke-product-chat-signal.sh

echo "== corpus scaffold inventory + corpus/devotion packs =="
bash scripts/smoke-corpus-inventory.sh
bash scripts/smoke-corpus-packs.sh
bash scripts/smoke-devotion-packs.sh
echo "== translation resolve path (every registry id) =="
bash scripts/smoke-translation-resolve.sh
rg -q 'READER_SKIN_IDS' apps/mobile/src/reader-skins.ts
echo "MOBILE_READER_SKINS_OK"

echo "== device webcrypto gate =="
bash scripts/smoke-device-crypto.sh

echo "== partner live IdP gate (documents OPEN without credentials) =="
bash scripts/smoke-partner-live-idp.sh | tee /tmp/lh-partner-live.log
rg -q 'PARTNER_LIVE_IDP_OPEN|PARTNER_LIVE_IDP_OK' /tmp/lh-partner-live.log

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
