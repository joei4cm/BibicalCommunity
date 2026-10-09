#!/usr/bin/env bash
# Handset-shaped browser E2E (iPhone viewport) against local web + API.
# Physical handset remains OPEN; this proves mobile-layout corpus catalog + Me
# product-key control + WebCrypto in a mobile UA, plus OpenE2EE product Signal
# client (browser/Workers-portable pure-TS) companion probe.
# Not a substitute for a real phone.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

WEB_BASE="${WEB_BASE:-http://127.0.0.1:5173}"
API_BASE="${API_BASE:-http://127.0.0.1:8787}"

# OpenE2EE product path is pure-TS / WebCrypto — run even when local UI is down.
pnpm --filter @logoshome/crypto build >/dev/null
node --input-type=module -e '
import {
  createProductSignalClient,
  OpenE2eeSignalClient,
  resolveProductSignalBackend,
} from "./packages/crypto/dist/index.js";

if (resolveProductSignalBackend("opene2ee") !== "opene2ee") {
  throw new Error("opene2ee product backend resolve failed");
}
const client = await createProductSignalClient("opene2ee");
if (!(client instanceof OpenE2eeSignalClient)) throw new Error("expected OpenE2eeSignalClient");
const a = await client.generateIdentity();
const b = await client.generateIdentity();
if (!String(a.publicBundle.identityKeyPub).includes("opene2ee")) {
  throw new Error("expected opene2ee identity marker");
}
if (!a.publicBundle.kyberPrekeyPub || !b.publicBundle.kyberPrekeyPub) {
  throw new Error("expected Kyber prekeys on OpenE2EE public bundles");
}
const as = await client.establishSession(a.privateState, b.publicBundle);
const bs = await client.establishSession(b.privateState, a.publicBundle);
const enc = await client.encrypt(as, "handset-opene2ee-product");
if ((await client.decrypt(bs, enc)) !== "handset-opene2ee-product") {
  throw new Error("OpenE2EE product roundtrip mismatch");
}
console.log("DEVICE_HANDSET_OPENE2EE_PRODUCT_OK backend=opene2ee kyberBundle=1 roundtrip=1");
'

if ! curl -sf "$API_BASE/health" >/dev/null; then
  echo "INFO: API unreachable at $API_BASE — handset-shaped UI probe skipped"
  echo "DEVICE_HANDSET_SHAPED_OPEN reason=no_api"
  echo "DEVICE_HANDSET_E2E_OPEN reason=physical_device_not_in_ci"
  exit 0
fi
if ! curl -sf "$WEB_BASE/" >/dev/null; then
  echo "INFO: web unreachable at $WEB_BASE — handset-shaped UI probe skipped"
  echo "DEVICE_HANDSET_SHAPED_OPEN reason=no_web"
  echo "DEVICE_HANDSET_E2E_OPEN reason=physical_device_not_in_ci"
  exit 0
fi

pnpm --filter @logoshome/web exec playwright install chromium >/tmp/pw-install.log 2>&1 || true

# Resolve playwright from apps/web so workspace dep is found.
WEB_BASE="$WEB_BASE" API_BASE="$API_BASE" pnpm --filter @logoshome/web exec node --input-type=module <<'NODE'
import { chromium, devices } from "playwright";

const WEB = process.env.WEB_BASE ?? "http://127.0.0.1:5173";
const API = process.env.API_BASE ?? "http://127.0.0.1:8787";
const iphone = devices["iPhone 13"];

const handle = "hs" + Date.now();
const pass = "SmokeTestPass123!";
const reg = await fetch(API + "/v1/auth/register", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ handle, password: pass, nickname: handle, locale: "en" }),
});
if (!reg.ok) throw new Error("register failed " + reg.status + " " + (await reg.text()));
const { token } = await reg.json();

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ ...iphone, baseURL: WEB });
await context.addInitScript((tok) => {
  localStorage.setItem("lh.token", tok);
}, token);

const page = await context.newPage();
page.setDefaultTimeout(25_000);

await page.goto(WEB + "/app", { waitUntil: "networkidle" });
await page.waitForTimeout(800);

const vp = page.viewportSize();
if (!vp || vp.width > 500) throw new Error("expected phone viewport, got " + JSON.stringify(vp));

const cryptoProbe = await page.evaluate(async () => {
  const out = { subtle: !!crypto?.subtle, secure: window.isSecureContext, aes: false, ecdh: false, x25519: false };
  if (!out.subtle || !out.secure) return out;
  try {
    await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    out.aes = true;
  } catch {
    /* ignore */
  }
  try {
    await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
    out.ecdh = true;
  } catch {
    /* ignore */
  }
  try {
    await crypto.subtle.generateKey({ name: "X25519" }, false, ["deriveBits"]);
    out.x25519 = true;
  } catch {
    /* Playwright Chromium may lack X25519; Node DEVICE_* gate still proves it. */
  }
  return out;
});
if (!cryptoProbe.subtle || !cryptoProbe.secure || !cryptoProbe.aes || !cryptoProbe.ecdh) {
  throw new Error("mobile UA WebCrypto incomplete: " + JSON.stringify(cryptoProbe));
}
console.log(
  "DEVICE_HANDSET_WEBCRYPTO_OK aes=1 ecdh=1 x25519=" + (cryptoProbe.x25519 ? "1" : "0"),
);

await page.goto(WEB + "/app/bible/cuvs/john/1", { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await page.getByTestId("bible-reader").waitFor({ state: "visible", timeout: 15_000 });
await page.getByTestId("reader-passage-title").waitFor({ state: "visible", timeout: 10_000 });
console.log("DEVICE_HANDSET_BIBLE_READER_OK");

// Catalog toggle lives inside collapsed <details class="bible-more">.
const more = page.locator("details.bible-more");
await more.first().waitFor({ state: "attached", timeout: 10_000 });
await more.first().locator("summary").click({ force: true });
const catalogToggle = page.getByTestId("reader-corpus-catalog-toggle");
await catalogToggle.first().waitFor({ state: "visible", timeout: 10_000 });
await catalogToggle.first().click({ force: true });
await page.getByTestId("reader-corpus-catalog").waitFor({ state: "visible", timeout: 10_000 });
console.log("DEVICE_HANDSET_CORPUS_CATALOG_OK");

await page.goto(WEB + "/app/me", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
const backend = page.getByTestId("me-signal-backend");
await backend.waitFor({ state: "visible", timeout: 10_000 });
const defaultBackend = await backend.inputValue();
if (defaultBackend !== "opene2ee") {
  throw new Error("expected Me default signal backend opene2ee, got " + defaultBackend);
}
await backend.selectOption("x25519");
await backend.selectOption("opene2ee");
const upload = page.getByTestId("me-upload-keys");
await upload.waitFor({ state: "visible", timeout: 10_000 });
console.log("DEVICE_HANDSET_PRODUCT_KEYS_UI_OK backend_default=opene2ee");

await browser.close();
console.log("DEVICE_HANDSET_SHAPED_OK viewport=" + vp.width + "x" + vp.height);
console.log("DEVICE_HANDSET_E2E_OPEN reason=physical_device_not_in_ci");
NODE
