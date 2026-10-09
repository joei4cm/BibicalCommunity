#!/usr/bin/env node
/**
 * Auth-then-P2P session + chat ciphertext roundtrip:
 * Bob uploads keys → Alice fetches via API → mutual WebCrypto sessions →
 * encrypt/decrypt + opaque courier via POST /messages.
 *
 * Product path uses mutual establishSession (no classic ephemeral X3DH blob).
 * Token names keep KEYS_X3DH_* for evidence-matrix continuity.
 */
import { WebCryptoSignalClient } from "../packages/crypto/dist/index.js";

const BASE = process.argv[2] ?? "http://127.0.0.1:8787";
const PASS = "SmokeTestPass123!";
const ts = Date.now();

async function register(handle) {
  const res = await fetch(`${BASE}/v1/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      handle,
      password: PASS,
      nickname: handle,
      locale: "en",
    }),
  });
  if (!res.ok) throw new Error(`register ${handle}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function api(token, path, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`${init.method ?? "GET"} ${path}: ${res.status} ${t}`);
  }
  return res.json();
}

const client = new WebCryptoSignalClient();
const alice = await client.generateIdentity();
const bob = await client.generateIdentity();
const bobPub = bob.publicBundle;

const regA = await register(`x3dha${ts}`);
const regB = await register(`x3dhb${ts}`);

await api(regB.token, "/v1/keys/bundle", {
  method: "PUT",
  body: JSON.stringify({
    identityKeyPub: bobPub.identityKeyPub,
    signedPrekeyPub: bobPub.signedPrekeyPub,
    signedPrekeySig: bobPub.signedPrekeySig,
    signedPrekeyId: bobPub.signedPrekeyId,
    registrationId: bobPub.registrationId,
  }),
});
if (bobPub.oneTimePrekeyPub == null || bobPub.oneTimePrekeyId == null) {
  throw new Error("bob identity missing one-time prekey");
}
await api(regB.token, "/v1/keys/prekeys", {
  method: "PUT",
  body: JSON.stringify({
    prekeys: [{ id: bobPub.oneTimePrekeyId, pub: bobPub.oneTimePrekeyPub }],
  }),
});
console.log("X3DH_BUNDLE_UPLOAD_OK");

const fetched = await api(regA.token, `/v1/keys/${regB.userId}`);
const device = (fetched.devices || []).find((d) => d.identityKeyPub && d.signedPrekeyPub);
if (!device?.oneTimePrekey?.pub) throw new Error("expected OPK on Alice fetch of Bob");

const remote = {
  identityKeyPub: device.identityKeyPub,
  signedPrekeyPub: device.signedPrekeyPub,
  signedPrekeySig: device.signedPrekeySig,
  signedPrekeyId: device.signedPrekeyId,
  registrationId: device.registrationId,
  oneTimePrekeyPub: device.oneTimePrekey.pub,
  oneTimePrekeyId: device.oneTimePrekey.id,
};

// Mutual establishSession (current WebCrypto / product path).
const aliceSession = await client.establishSession(alice.privateState, remote);
const bobSession = await client.establishSession(bob.privateState, alice.publicBundle);

const localPlain = `local-x3dh-${ts}`;
const localEnc = await client.encrypt(aliceSession, localPlain, Date.now() + 3600_000);
const localDec = await client.decrypt(bobSession, localEnc);
if (localDec !== localPlain) throw new Error(`local decrypt mismatch: ${localDec}`);
console.log("X3DH_SHARED_SECRET_OK");

const courierPlain = `courier-x3dh-${ts}`;
const courierEnc = await client.encrypt(aliceSession, courierPlain, Date.now() + 3600_000);

const convo = await api(regA.token, "/v1/chat/conversations", {
  method: "POST",
  body: JSON.stringify({ kind: "dm", memberIds: [regB.userId] }),
});
await api(regA.token, `/v1/chat/conversations/${convo.id}/messages`, {
  method: "POST",
  body: JSON.stringify({
    ratchetHeader: courierEnc.ratchetHeader,
    ciphertext: courierEnc.ciphertext,
    contentType: "msg",
    expiresAt: courierEnc.expiresAt,
  }),
});

const listed = await api(regB.token, `/v1/chat/conversations/${convo.id}/messages`);
const msg = (listed.messages || []).find((m) => m.ciphertext === courierEnc.ciphertext);
if (!msg) throw new Error("courier ciphertext not found on server");
if (String(msg.ciphertext).includes(courierPlain)) {
  throw new Error("plaintext leaked to server");
}

const courierDec = await client.decrypt(bobSession, {
  ratchetHeader: msg.ratchetHeader,
  ciphertext: msg.ciphertext,
  contentType: "msg",
  expiresAt: msg.expiresAt ?? undefined,
});
if (courierDec !== courierPlain) throw new Error(`courier decrypt mismatch: ${courierDec}`);
console.log("X3DH_CHAT_COURIER_OK");
console.log("X3DH_CHAT_OK");
