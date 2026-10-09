#!/usr/bin/env node
/**
 * End-to-end probe: DM E2EE, group create/send, call signaling + TURN.
 * Asserts server never sees plaintext on the product crypto path.
 *
 * Usage: node scripts/smoke-dm-group-call-crypto.mjs [http://127.0.0.1:8787]
 */
import { createProductChatIdentity, productChatEstablish, productChatEncrypt, productChatDecrypt } from "../packages/crypto/dist/index.js";

const BASE = process.argv[2] ?? "http://127.0.0.1:8787";
const PASS = "SmokeTestPass123!";
const ts = Date.now();

function ok(token, detail = "") {
  console.log(detail ? `${token} ${detail}` : token);
}

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

async function uploadProductKeys(token, identity) {
  const b = identity.publicBundle;
  await api(token, "/v1/keys/bundle", {
    method: "PUT",
    body: JSON.stringify({
      identityKeyPub: b.identityKeyPub,
      signedPrekeyPub: b.signedPrekeyPub,
      signedPrekeySig: b.signedPrekeySig,
      signedPrekeyId: b.signedPrekeyId,
      registrationId: b.registrationId,
    }),
  });
  if (b.oneTimePrekeyPub != null && b.oneTimePrekeyId != null) {
    await api(token, "/v1/keys/prekeys", {
      method: "PUT",
      body: JSON.stringify({
        prekeys: [{ id: b.oneTimePrekeyId, pub: b.oneTimePrekeyPub }],
      }),
    });
  }
}

async function fetchRemoteBundle(token, userId) {
  const fetched = await api(token, `/v1/keys/${userId}`);
  const device = (fetched.devices || []).find((d) => d.identityKeyPub && d.signedPrekeyPub);
  if (!device) throw new Error(`no device keys for ${userId}`);
  return {
    identityKeyPub: device.identityKeyPub,
    signedPrekeyPub: device.signedPrekeyPub,
    signedPrekeySig: device.signedPrekeySig,
    signedPrekeyId: device.signedPrekeyId,
    registrationId: device.registrationId,
    oneTimePrekeyPub: device.oneTimePrekey?.pub,
    oneTimePrekeyId: device.oneTimePrekey?.id,
  };
}

// ── 1) DM product E2EE ──────────────────────────────────────────────────────
console.log("== DM product E2EE ==");
const alice = await createProductChatIdentity("x25519");
const bob = await createProductChatIdentity("x25519");
const regA = await register(`dma${ts}`);
const regB = await register(`dmb${ts}`);
await uploadProductKeys(regA.token, alice.identity);
await uploadProductKeys(regB.token, bob.identity);

const remoteB = await fetchRemoteBundle(regA.token, regB.userId);
const remoteA = await fetchRemoteBundle(regB.token, regA.userId);
const sessA = await productChatEstablish(alice.client, alice.identity.privateState, remoteB);
const sessB = await productChatEstablish(bob.client, bob.identity.privateState, remoteA);

const dmPlain = `dm-secret-${ts}-不要泄露给服务器`;
const dmEnc = await productChatEncrypt(alice.client, sessA, dmPlain, Date.now() + 3600_000);
if (JSON.stringify(dmEnc).includes(dmPlain)) throw new Error("plaintext leaked into encrypt envelope");

const dmConvo = await api(regA.token, "/v1/chat/conversations", {
  method: "POST",
  body: JSON.stringify({ kind: "dm", memberIds: [regB.userId] }),
});
await api(regA.token, `/v1/chat/conversations/${dmConvo.id}/messages`, {
  method: "POST",
  body: JSON.stringify({
    ratchetHeader: dmEnc.ratchetHeader,
    ciphertext: dmEnc.ciphertext,
    contentType: "msg",
    expiresAt: dmEnc.expiresAt,
  }),
});

const listed = await api(regB.token, `/v1/chat/conversations/${dmConvo.id}/messages`);
const stored = (listed.messages || []).find((m) => m.ciphertext === dmEnc.ciphertext);
if (!stored) throw new Error("DM ciphertext missing on server list");
const wire = JSON.stringify(listed);
if (wire.includes(dmPlain) || wire.includes("不要泄露")) {
  throw new Error("DM plaintext visible on server response");
}
ok("DM_SERVER_OPAQUE_OK", `convo=${dmConvo.id}`);

const dmDec = await productChatDecrypt(bob.client, sessB, {
  ratchetHeader: stored.ratchetHeader,
  ciphertext: stored.ciphertext,
  contentType: "msg",
  expiresAt: stored.expiresAt ?? undefined,
});
if (dmDec !== dmPlain) throw new Error(`DM decrypt mismatch: ${dmDec}`);
ok("DM_E2EE_ROUNDTRIP_OK", `backend=${alice.identity.backend}`);

// Negative: Charlie with unrelated identity must not decrypt Alice→Bob ciphertext
const charlie = await createProductChatIdentity("x25519");
const sessCwrong = await productChatEstablish(
  charlie.client,
  charlie.identity.privateState,
  remoteA,
);
let charlieFailed = false;
try {
  await productChatDecrypt(charlie.client, sessCwrong, {
    ratchetHeader: stored.ratchetHeader,
    ciphertext: stored.ciphertext,
    contentType: "msg",
  });
} catch {
  charlieFailed = true;
}
if (!charlieFailed) throw new Error("outsider decrypted DM ciphertext — encryption ineffective");
ok("DM_OUTSIDER_FAILS_OK");

// ── 2) Group conversation create + membership + crypto shape ────────────────
console.log("== group chat ==");
const regC = await register(`dmc${ts}`);
const group = await api(regA.token, "/v1/chat/conversations", {
  method: "POST",
  body: JSON.stringify({
    kind: "group",
    title: `Group ${ts}`,
    memberIds: [regB.userId, regC.userId],
  }),
});
if (!group.id?.startsWith("convo_")) throw new Error("group create failed");
const groupListA = await api(regA.token, "/v1/chat/conversations");
const groupRow = (groupListA.conversations || []).find((c) => c.id === group.id);
if (!groupRow || groupRow.kind !== "group") throw new Error("group not listed for creator");
const members = new Set(groupRow.memberIds || []);
if (![regA.userId, regB.userId, regC.userId].every((id) => members.has(id))) {
  throw new Error(`group membership incomplete: ${JSON.stringify(groupRow.memberIds)}`);
}
ok("GROUP_CREATE_OK", `id=${group.id} members=${members.size}`);

// Group fan-out: one envelope per peer (matches apps/web group-fanout.ts).
await uploadProductKeys(regC.token, charlie.identity);
const remoteB2 = await fetchRemoteBundle(regA.token, regB.userId);
const remoteC = await fetchRemoteBundle(regA.token, regC.userId);
const gSessAB = await productChatEstablish(alice.client, alice.identity.privateState, remoteB2);
const gSessAC = await productChatEstablish(alice.client, alice.identity.privateState, remoteC);
const gSessB = await productChatEstablish(bob.client, bob.identity.privateState, remoteA);
const gSessC = await productChatEstablish(charlie.client, charlie.identity.privateState, remoteA);
const gPlain = `group-secret-${ts}`;
const encB = await productChatEncrypt(alice.client, gSessAB, gPlain);
const encC = await productChatEncrypt(alice.client, gSessAC, gPlain);
const fanout = {
  v: 1,
  from: regA.userId,
  envelopes: {
    [regB.userId]: { ratchetHeader: `product:${encB.ratchetHeader}`, ciphertext: encB.ciphertext },
    [regC.userId]: { ratchetHeader: `product:${encC.ratchetHeader}`, ciphertext: encC.ciphertext },
  },
};
await api(regA.token, `/v1/chat/conversations/${group.id}/messages`, {
  method: "POST",
  body: JSON.stringify({
    ratchetHeader: "group-fanout:v1",
    ciphertext: JSON.stringify(fanout),
    contentType: "msg",
  }),
});
const gListedB = await api(regB.token, `/v1/chat/conversations/${group.id}/messages`);
const gMsg = (gListedB.messages || []).find((m) => m.ratchetHeader === "group-fanout:v1");
if (!gMsg) throw new Error("group fanout ciphertext missing for member B");
if (JSON.stringify(gListedB).includes(gPlain)) throw new Error("group plaintext on server");

const blobB = JSON.parse(gMsg.ciphertext);
const mineB = blobB.envelopes[regB.userId];
const gDecB = await productChatDecrypt(bob.client, gSessB, {
  ratchetHeader: String(mineB.ratchetHeader).replace(/^product:/, ""),
  ciphertext: mineB.ciphertext,
  contentType: "msg",
});
if (gDecB !== gPlain) throw new Error("group member B failed to decrypt fanout envelope");
ok("GROUP_FANOUT_B_OK");

const gListedC = await api(regC.token, `/v1/chat/conversations/${group.id}/messages`);
const gMsgC = (gListedC.messages || []).find((m) => m.ratchetHeader === "group-fanout:v1");
const blobC = JSON.parse(gMsgC.ciphertext);
const mineC = blobC.envelopes[regC.userId];
const gDecC = await productChatDecrypt(charlie.client, gSessC, {
  ratchetHeader: String(mineC.ratchetHeader).replace(/^product:/, ""),
  ciphertext: mineC.ciphertext,
  contentType: "msg",
});
if (gDecC !== gPlain) throw new Error("group member C failed to decrypt fanout envelope");
ok("GROUP_FANOUT_C_OK");

// Outsider without an envelope must fail.
let outsiderFail = false;
try {
  await productChatDecrypt(charlie.client, gSessC, {
    ratchetHeader: String(mineB.ratchetHeader).replace(/^product:/, ""),
    ciphertext: mineB.ciphertext,
    contentType: "msg",
  });
} catch {
  outsiderFail = true;
}
if (!outsiderFail) throw new Error("C decrypted B's envelope — fanout isolation broken");
ok("GROUP_FANOUT_ISOLATION_OK");

// ── 3) Call signaling + TURN ────────────────────────────────────────────────
console.log("== calls ==");
const call = await api(regA.token, "/v1/chat/calls", {
  method: "POST",
  body: JSON.stringify({ conversationId: dmConvo.id }),
});
const signalingPath = call.signalingPath ?? call.wsPath;
if (!call.callId || !signalingPath) throw new Error(`call create failed: ${JSON.stringify(call)}`);
ok("CALL_CREATE_OK", `callId=${call.callId}`);

const turn = await api(regA.token, "/v1/calls/turn-credentials", { method: "POST", body: "{}" });
if (!Array.isArray(turn.uris) || turn.uris.length === 0) {
  throw new Error("turn credentials incomplete");
}
if (!Array.isArray(turn.iceServers) || turn.iceServers.length === 0) {
  throw new Error("turn iceServers missing — client needs split STUN/TURN");
}
// STUN entries must not carry credentials.
for (const s of turn.iceServers) {
  const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
  const onlyStun = urls.every((u) => String(u).startsWith("stun:") || String(u).startsWith("stuns:"));
  if (onlyStun && (s.username || s.credential)) {
    throw new Error("STUN iceServer must not include TURN credentials");
  }
}
ok(
  "CALL_TURN_MINT_OK",
  turn.hasRelay
    ? `hasRelay=true provider=${turn.provider ?? "?"} uris=${turn.uris.join(",")}`
    : `hasRelay=false provider=${turn.provider ?? "stun-only"} (set TURN_CF_* or turn: URIs for relay)`,
);

// WebSocket fan-out (same as smoke-call-signaling core)
const WS_BASE = BASE.replace(/^http/, "ws");
const wsUrl = (token) =>
  `${WS_BASE}${signalingPath}?token=${encodeURIComponent(token)}&conversationId=${encodeURIComponent(dmConvo.id)}`;

function openWs(token) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl(token));
    const timer = setTimeout(() => reject(new Error("ws timeout")), 8000);
    ws.addEventListener("open", () => {
      clearTimeout(timer);
      resolve(ws);
    });
    ws.addEventListener("error", () => {
      clearTimeout(timer);
      reject(new Error("ws error"));
    });
  });
}

function onceType(ws, type, ms = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting ${type}`)), ms);
    const onMsg = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data));
        if (msg.type === type) {
          clearTimeout(timer);
          ws.removeEventListener("message", onMsg);
          resolve(msg);
        }
      } catch {
        /* ignore */
      }
    };
    ws.addEventListener("message", onMsg);
  });
}

const wsA = await openWs(regA.token);
const wsB = await openWs(regB.token);
await onceType(wsB, "peers").catch(() => null);
const offerWait = onceType(wsB, "offer");
wsA.send(JSON.stringify({ type: "offer", sdp: "v=0-offer-probe" }));
const offer = await offerWait;
if (offer.sdp !== "v=0-offer-probe") throw new Error("offer fanout broken");
wsA.close();
wsB.close();
ok("CALL_SIGNAL_FANOUT_OK");

console.log("DM_GROUP_CALL_CRYPTO_OK");
