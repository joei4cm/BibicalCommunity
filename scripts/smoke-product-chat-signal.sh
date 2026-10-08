#!/usr/bin/env bash
# Product chat path: createProductSignalClient wired for app encrypt/decrypt.
# Tokens: PRODUCT_CHAT_SIGNAL_OK (+ PRODUCT_CHAT_API_OK when API_BASE reaches a live API)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
pnpm --filter @logoshome/crypto build >/dev/null

node --input-type=module -e '
import {
  createProductChatIdentity,
  createProductSignalClient,
  isProductX25519IdentityPub,
  productChatDecrypt,
  productChatEncrypt,
  productChatEstablish,
  productChatPeerRoundtrip,
  resolveProductSignalBackend,
  X25519SignalClient,
} from "./packages/crypto/dist/index.js";

const round = await productChatPeerRoundtrip("product-chat-smoke", "x25519");
if (!round.ok || round.backend !== "x25519") throw new Error("roundtrip failed: " + JSON.stringify(round));

const alice = await createProductChatIdentity("x25519");
const bob = await createProductChatIdentity("x25519");
if (!(alice.client instanceof X25519SignalClient)) throw new Error("expected X25519 product client");
if (!isProductX25519IdentityPub(alice.identity.publicBundle.identityKeyPub)) {
  throw new Error("alice identity is not product x25519");
}
const as = await productChatEstablish(alice.client, alice.identity.privateState, bob.identity.publicBundle);
const bs = await productChatEstablish(bob.client, bob.identity.privateState, alice.identity.publicBundle);
const enc = await productChatEncrypt(alice.client, as, "web-mobile-wire");
if ((await productChatDecrypt(bob.client, bs, enc)) !== "web-mobile-wire") {
  throw new Error("facade decrypt mismatch");
}

// Browser/Workers product default must stay x25519.
const g = globalThis;
const prev = g.WebSocketPair;
g.WebSocketPair = function WebSocketPair() {};
try {
  if (resolveProductSignalBackend() !== "x25519") {
    throw new Error("Workers product backend must be x25519");
  }
  const product = await createProductSignalClient();
  if (!(product instanceof X25519SignalClient)) throw new Error("Workers product client type");
} finally {
  if (prev === undefined) delete g.WebSocketPair;
  else g.WebSocketPair = prev;
}

console.log("PRODUCT_CHAT_SIGNAL_OK backend=x25519 facade=createProductChatIdentity");
'

API_BASE="${API_BASE:-${1:-}}"
if [[ -z "$API_BASE" ]]; then
  echo "PRODUCT_CHAT_API_OPEN reason=no_API_BASE (set API_BASE to exercise courier roundtrip)"
  exit 0
fi

API_BASE="$API_BASE" node --input-type=module -e '
import { createProductChatIdentity, productChatDecrypt, productChatEncrypt, productChatEstablish } from "./packages/crypto/dist/index.js";

const BASE = process.env.API_BASE;
const PASS = "SmokeTestPass123!";
const ts = Date.now();

async function register(handle) {
  const res = await fetch(`${BASE}/v1/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ handle, password: PASS, nickname: handle, locale: "en" }),
  });
  if (!res.ok) throw new Error(`register ${handle}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function api(token, path, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

const alice = await createProductChatIdentity("x25519");
const bob = await createProductChatIdentity("x25519");
const regA = await register(`pcha${ts}`);
const regB = await register(`pchb${ts}`);

await api(regB.token, "/v1/keys/bundle", {
  method: "PUT",
  body: JSON.stringify({
    identityKeyPub: bob.identity.publicBundle.identityKeyPub,
    signedPrekeyPub: bob.identity.publicBundle.signedPrekeyPub,
    signedPrekeySig: bob.identity.publicBundle.signedPrekeySig,
    signedPrekeyId: bob.identity.publicBundle.signedPrekeyId,
    registrationId: bob.identity.publicBundle.registrationId,
  }),
});
if (bob.identity.publicBundle.oneTimePrekeyPub != null && bob.identity.publicBundle.oneTimePrekeyId != null) {
  await api(regB.token, "/v1/keys/prekeys", {
    method: "PUT",
    body: JSON.stringify({
      prekeys: [{ id: bob.identity.publicBundle.oneTimePrekeyId, pub: bob.identity.publicBundle.oneTimePrekeyPub }],
    }),
  });
}

const fetched = await api(regA.token, `/v1/keys/${regB.userId}`);
const device = (fetched.devices || []).find((d) => d.identityKeyPub && d.signedPrekeyPub);
if (!device) throw new Error("missing bob device on fetch");

const remote = {
  identityKeyPub: device.identityKeyPub,
  signedPrekeyPub: device.signedPrekeyPub,
  signedPrekeySig: device.signedPrekeySig,
  signedPrekeyId: device.signedPrekeyId,
  oneTimePrekeyPub: device.oneTimePrekey?.pub,
  oneTimePrekeyId: device.oneTimePrekey?.id,
  registrationId: device.registrationId ?? 0,
};

const as = await productChatEstablish(alice.client, alice.identity.privateState, remote);
const bs = await productChatEstablish(bob.client, bob.identity.privateState, alice.identity.publicBundle);
const enc = await productChatEncrypt(alice.client, as, "product-api-courier");

const conv = await api(regA.token, "/v1/chat/conversations", {
  method: "POST",
  body: JSON.stringify({ kind: "dm", memberIds: [regB.userId] }),
});
await api(regA.token, `/v1/chat/conversations/${conv.id}/messages`, {
  method: "POST",
  body: JSON.stringify({
    ratchetHeader: "product:" + enc.ratchetHeader,
    ciphertext: enc.ciphertext,
    contentType: "msg",
  }),
});
const list = await api(regB.token, `/v1/chat/conversations/${conv.id}/messages`);
const msg = (list.messages || [])[0];
if (!msg) throw new Error("no courier message");
const header = String(msg.ratchetHeader).replace(/^product:/, "");
const plain = await productChatDecrypt(bob.client, bs, {
  ratchetHeader: header,
  ciphertext: msg.ciphertext,
  contentType: "msg",
});
if (plain !== "product-api-courier") throw new Error("courier decrypt mismatch: " + plain);
console.log("PRODUCT_CHAT_API_OK conversation=" + conv.id);
' 
