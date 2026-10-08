#!/usr/bin/env bash
# Document Workers/browser libsignal gap: Node native PQXDH works; Workers path stays X25519/WebCrypto.
# Tokens: LIBSIGNAL_NATIVE_NODE_OK / LIBSIGNAL_WORKERS_FALLBACK_OK / LIBSIGNAL_WORKERS_OPEN
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

// Workers/browser have no native addon; portable backends remain selectable + roundtrip.
if (resolveSignalBackend("x25519") !== "x25519") throw new Error("x25519 resolve failed");
if (resolveSignalBackend("webcrypto") !== "webcrypto") throw new Error("webcrypto resolve failed");
const x = await createSignalClientAsync("x25519");
const w = await createSignalClientAsync("webcrypto");
if (!(x instanceof X25519SignalClient)) throw new Error("x25519 client type");
if (!(w instanceof WebCryptoSignalClient)) throw new Error("webcrypto client type");

async function roundtrip(client, label) {
  const a = await client.generateIdentity();
  const b = await client.generateIdentity();
  const session = await client.establishSession(a.privateState, b.publicBundle);
  const enc = await client.encrypt(session, label + "-payload");
  const plain = await client.decrypt(session, enc);
  if (plain !== label + "-payload") throw new Error(label + " roundtrip mismatch");
}

await roundtrip(x, "x25519-workers-fallback");
await roundtrip(w, "webcrypto-workers-fallback");

console.log("LIBSIGNAL_NATIVE_NODE_OK package=" + probe.packageName);
console.log("LIBSIGNAL_WORKERS_FALLBACK_OK backends=x25519,webcrypto");
// Explicit OPEN: Cloudflare Workers / browser still cannot load @signalapp/libsignal-client native addon.
console.log("LIBSIGNAL_WORKERS_OPEN reason=no_native_addon_on_workers_or_browser fallback=x25519+webcrypto");
'
