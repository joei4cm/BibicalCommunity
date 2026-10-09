#!/usr/bin/env bash
# Document Workers/browser libsignal gap: Node native PQXDH works; Workers path stays X25519/WebCrypto.
# Also probes OpenE2EE pure-TS PQXDH under Workers-shaped runtime (not official libsignal).
# Tokens: LIBSIGNAL_NATIVE_NODE_OK / LIBSIGNAL_WORKERS_FALLBACK_OK /
#         LIBSIGNAL_OPENE2EE_PQXDH_OK / LIBSIGNAL_WORKERS_OPEN
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
pnpm --filter @logoshome/crypto build >/dev/null

node --input-type=module -e '
import {
  createProductSignalClient,
  createSignalClientAsync,
  isWorkersOrBrowserRuntime,
  probeLibsignalPackage,
  resolveProductSignalBackend,
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

// Product factory must never fail-closed on portable path.
const product = await createProductSignalClient("x25519");
if (!(product instanceof X25519SignalClient)) throw new Error("product x25519 type");
{
  const a = await product.generateIdentity();
  const b = await product.generateIdentity();
  const as = await product.establishSession(a.privateState, b.publicBundle);
  const bs = await product.establishSession(b.privateState, a.publicBundle);
  const enc = await product.encrypt(as, "product-workers");
  if ((await product.decrypt(bs, enc)) !== "product-workers") throw new Error("product roundtrip");
}

// Simulate Workers/browser product default (no official native/WASM addon upstream).
{
  const { OpenE2eeSignalClient } = await import("./packages/crypto/dist/index.js");
  const g = globalThis;
  const prevPair = g.WebSocketPair;
  g.WebSocketPair = function WebSocketPair() {};
  try {
    if (!isWorkersOrBrowserRuntime()) throw new Error("expected Workers detection via WebSocketPair");
    if (resolveProductSignalBackend() !== "opene2ee") {
      throw new Error(
        "product backend on Workers must be opene2ee, got " + resolveProductSignalBackend(),
      );
    }
    const def = await createProductSignalClient();
    if (!(def instanceof OpenE2eeSignalClient)) {
      throw new Error("Workers product default client must be OpenE2eeSignalClient");
    }
  } finally {
    if (prevPair === undefined) delete g.WebSocketPair;
    else g.WebSocketPair = prevPair;
  }
}

console.log("LIBSIGNAL_NATIVE_NODE_OK package=" + probe.packageName);
console.log(
  "LIBSIGNAL_WORKERS_FALLBACK_OK backends=x25519(roundtrip),webcrypto(roundtrip),product(opene2ee-default)",
);

// Workers-portable PQXDH (OpenE2EE pure-TS; MIT/Apache). Not official libsignal; not wire-compatible.
{
  const { probeOpenE2eePqxdhWorkers } = await import("./packages/crypto/dist/index.js");
  const oe = await probeOpenE2eePqxdhWorkers({ forceWorkersShape: true });
  if (!oe.ok) throw new Error("OpenE2EE PQXDH Workers probe failed: " + JSON.stringify(oe));
  if (!oe.peersMatched || !oe.messageRoundtrip) {
    throw new Error("OpenE2EE PQXDH peer/msg incomplete: " + JSON.stringify(oe));
  }
  console.log(
    "LIBSIGNAL_OPENE2EE_PQXDH_OK package=" +
      oe.packageName +
      " usedPQXDH=" +
      oe.usedPQXDH +
      " secretBytes=" +
      oe.sharedSecretBytes +
      " workersShaped=" +
      oe.workersShaped +
      " peersMatched=" +
      oe.peersMatched,
  );
  console.log(
    "LIBSIGNAL_OPENE2EE_MSG_OK package=" +
      oe.packageName +
      " messageRoundtrip=" +
      oe.messageRoundtrip +
      " workersShaped=" +
      oe.workersShaped,
  );
}

// Product OpenE2EE SignalClient under Workers-shaped runtime (default; not official libsignal).
{
  const { createProductSignalClient, OpenE2eeSignalClient, isWorkersOrBrowserRuntime } =
    await import("./packages/crypto/dist/index.js");
  const g = globalThis;
  const prevPair = g.WebSocketPair;
  g.WebSocketPair = function WebSocketPair() {};
  try {
    if (!isWorkersOrBrowserRuntime()) throw new Error("expected Workers shape for OpenE2EE product");
    const client = await createProductSignalClient();
    if (!(client instanceof OpenE2eeSignalClient)) {
      throw new Error("expected OpenE2eeSignalClient, got " + client.constructor.name);
    }
    const a = await client.generateIdentity();
    const b = await client.generateIdentity();
    if (!a.publicBundle.kyberPrekeyPub || !b.publicBundle.kyberPrekeyPub) {
      throw new Error("expected Kyber prekeys on OpenE2EE public bundles");
    }
    const as = await client.establishSession(a.privateState, b.publicBundle);
    const bs = await client.establishSession(b.privateState, a.publicBundle);
    const enc = await client.encrypt(as, "opene2ee-product-workers");
    if ((await client.decrypt(bs, enc)) !== "opene2ee-product-workers") {
      throw new Error("OpenE2EE product roundtrip mismatch");
    }
    console.log(
      "LIBSIGNAL_OPENE2EE_PRODUCT_OK backend=opene2ee workersShaped=true default=1 kyberBundle=1 roundtrip=1",
    );
  } finally {
    if (prevPair === undefined) delete g.WebSocketPair;
    else g.WebSocketPair = prevPair;
  }
}

// Explicit OPEN: official @signalapp/libsignal-client has no WASM/Workers/browser build.
console.log(
  "LIBSIGNAL_WORKERS_OPEN reason=no_official_wasm_or_native_addon_on_workers_or_browser product_default=opene2ee x25519=available",
);
'
