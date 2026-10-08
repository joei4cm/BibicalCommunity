#!/usr/bin/env bash
# Automated WebCrypto device-path gate (Node/Expo-shaped).
# Physical handset E2E remains OPEN; this proves hasWebCrypto + note/session/x25519 paths.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

pnpm --filter @logoshome/crypto build >/dev/null
pnpm --filter @logoshome/mobile exec node --import tsx --test src/crypto-polyfill.test.ts >/tmp/lh-device-crypto-mobile.log
rg -q 'pass' /tmp/lh-device-crypto-mobile.log || rg -q 'ok ' /tmp/lh-device-crypto-mobile.log
echo "MOBILE_WEBCRYPTO_POLYFILL_OK"

node --input-type=module -e '
import {
  createSignalClient,
  generateAndExportNoteKey,
  importNoteKey,
  encryptSessionPayload,
  decryptSessionPayload,
  deriveSessionKey,
  probeCurve25519WebCrypto,
} from "./packages/crypto/dist/index.js";
import { encryptJson, decryptJson } from "./packages/crypto/dist/envelope.js";

if (!(await probeCurve25519WebCrypto())) throw new Error("no x25519");
if (!globalThis.crypto?.subtle) throw new Error("no subtle");

const { key, jwk } = await generateAndExportNoteKey();
const again = await importNoteKey(jwk);
const sealed = await encryptJson(key, { note: "圣言家 device gate", v: 1 }, "note");
const opened = await decryptJson(again, sealed.ciphertext, sealed.iv, "note");
if (opened.note !== "圣言家 device gate") throw new Error("note roundtrip");

const sk = await deriveSessionKey("device-gate-shared");
const sess = await encryptSessionPayload(sk, "p2p-hello", "chat");
const pt = await decryptSessionPayload(sk, sess.ratchetHeader, sess.ciphertext, "chat");
if (pt !== "p2p-hello") throw new Error("session roundtrip");

const client = createSignalClient("x25519");
const a = await client.generateIdentity();
const b = await client.generateIdentity();
const aS = await client.establishSession(a.privateState, b.publicBundle);
const bS = await client.establishSession(b.privateState, a.publicBundle);
const enc = await client.encrypt(aS, "device-x25519");
if ((await client.decrypt(bS, enc)) !== "device-x25519") throw new Error("x25519");

console.log("DEVICE_NOTE_CRYPTO_OK");
console.log("DEVICE_SESSION_CRYPTO_OK");
console.log("DEVICE_X25519_OK");
console.log("DEVICE_WEBCRYPTO_GATE_OK");
'
