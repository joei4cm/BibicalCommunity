#!/usr/bin/env bash
# Prove WebCrypto X25519/Ed25519 Curve25519 path (not full libsignal).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
pnpm --filter @logoshome/crypto build >/dev/null
node --input-type=module -e '
import {
  createSignalClient,
  probeCurve25519WebCrypto,
  resolveSignalBackend,
  X25519SignalClient,
} from "./packages/crypto/dist/index.js";

if (!(await probeCurve25519WebCrypto())) throw new Error("probe failed");
console.log("CURVE25519_PROBE_OK");

if (resolveSignalBackend("x25519") !== "x25519") throw new Error("resolve x25519");
const client = createSignalClient("x25519");
if (!(client instanceof X25519SignalClient)) throw new Error("factory");

const alice = await client.generateIdentity();
const bob = await client.generateIdentity();
if (!alice.publicBundle.identityKeyPub.includes("x25519")) throw new Error("bundle curve");

const aS = await client.establishSession(alice.privateState, bob.publicBundle);
const bS = await client.establishSession(bob.privateState, alice.publicBundle);
const enc = await client.encrypt(aS, "圣言家 curve25519");
const pt = await client.decrypt(bS, enc);
if (pt !== "圣言家 curve25519") throw new Error("roundtrip");
console.log("CURVE25519_X25519_OK");
console.log("KEYS_CURVE25519_OK");
'
