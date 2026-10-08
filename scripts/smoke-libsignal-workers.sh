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

// Primary Workers-portable path: Curve25519 X25519 full peer roundtrip.
{
  const alice = await x.generateIdentity();
  const bob = await x.generateIdentity();
  const aliceSession = await x.establishSession(alice.privateState, bob.publicBundle);
  const bobSession = await x.establishSession(bob.privateState, alice.publicBundle);
  const enc = await x.encrypt(aliceSession, "x25519-workers-fallback-payload");
  const plain = await x.decrypt(bobSession, enc);
  if (plain !== "x25519-workers-fallback-payload") throw new Error("x25519 roundtrip mismatch");
  const reply = await x.encrypt(bobSession, "x25519-ack");
  if ((await x.decrypt(aliceSession, reply)) !== "x25519-ack") throw new Error("x25519 ack mismatch");
}

// WebCrypto P-256 path: full peer encrypt/decrypt (Workers-portable mutual ECDH session).
{
  const a = await w.generateIdentity();
  const b = await w.generateIdentity();
  const as = await w.establishSession(a.privateState, b.publicBundle);
  const bs = await w.establishSession(b.privateState, a.publicBundle);
  const enc = await w.encrypt(as, "webcrypto-workers-fallback-payload");
  const plain = await w.decrypt(bs, enc);
  if (plain !== "webcrypto-workers-fallback-payload") {
    throw new Error("webcrypto roundtrip mismatch");
  }
}

console.log("LIBSIGNAL_NATIVE_NODE_OK package=" + probe.packageName);
console.log("LIBSIGNAL_WORKERS_FALLBACK_OK backends=x25519(roundtrip),webcrypto(roundtrip)");
// Explicit OPEN: Cloudflare Workers / browser still cannot load @signalapp/libsignal-client native addon.
console.log("LIBSIGNAL_WORKERS_OPEN reason=no_native_addon_on_workers_or_browser fallback=x25519+webcrypto");
'
