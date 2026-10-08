#!/usr/bin/env bash
# Document Workers/browser libsignal gap: Node native PQXDH works; Workers path stays X25519.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
pnpm --filter @logoshome/crypto build >/dev/null

node --input-type=module -e '
import {
  createSignalClientAsync,
  probeLibsignalPackage,
  resolveSignalBackend,
  NativeLibsignalSignalClient,
  X25519SignalClient,
  WebCryptoSignalClient,
} from "./packages/crypto/dist/index.js";

const probe = await probeLibsignalPackage();
if (!probe.available || !probe.nativeRoundtrip) {
  throw new Error("Node libsignal probe must pass: " + JSON.stringify(probe));
}

const native = await createSignalClientAsync("libsignal");
if (!(native instanceof NativeLibsignalSignalClient)) {
  throw new Error("expected NativeLibsignalSignalClient on Node, got " + native.constructor.name);
}

// Workers/browser have no native addon; portable backends remain selectable.
if (resolveSignalBackend("x25519") !== "x25519") throw new Error("x25519 resolve failed");
if (resolveSignalBackend("webcrypto") !== "webcrypto") throw new Error("webcrypto resolve failed");
const x = await createSignalClientAsync("x25519");
const w = await createSignalClientAsync("webcrypto");
if (!(x instanceof X25519SignalClient)) throw new Error("x25519 client type");
if (!(w instanceof WebCryptoSignalClient)) throw new Error("webcrypto client type");

// Explicit OPEN: Cloudflare Workers / browser still cannot load @signalapp/libsignal-client.
console.log("LIBSIGNAL_NATIVE_NODE_OK package=" + probe.packageName);
console.log("LIBSIGNAL_WORKERS_OPEN reason=no_native_addon_on_workers_or_browser fallback=x25519+webcrypto");
'
