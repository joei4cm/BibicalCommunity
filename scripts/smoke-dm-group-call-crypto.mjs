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

// UI encrypts only against peerUserIds[0] — simulate that for groups (pairwise, not sender-keys).
await uploadProductKeys(regC.token, charlie.identity);
const remoteForGroup = await fetchRemoteBundle(regA.token, regB.userId); // first peer = B
const gSessA = await productChatEstablish(alice.client, alice.identity.privateState, remoteForGroup);
const gSessB = await productChatEstablish(bob.client, bob.identity.privateState, remoteA);
const gPlain = `group-secret-${ts}`;
const gEnc = await productChatEncrypt(alice.client, gSessA, gPlain);
await api(regA.token, `/v1/chat/conversations/${group.id}/messages`, {
  method: "POST",
  body: JSON.stringify({
    ratchetHeader: gEnc.ratchetHeader,
    ciphertext: gEnc.ciphertext,
    contentType: "msg",
  }),
});
const gListedB = await api(regB.token, `/v1/chat/conversations/${group.id}/messages`);
const gMsg = (gListedB.messages || []).find((m) => m.ciphertext === gEnc.ciphertext);
if (!gMsg) throw new Error("group ciphertext missing for member B");
if (JSON.stringify(gListedB).includes(gPlain)) throw new Error("group plaintext on server");
const gDecB = await productChatDecrypt(bob.client, gSessB, {
  ratchetHeader: gMsg.ratchetHeader,
  ciphertext: gMsg.ciphertext,
  contentType: "msg",
});
if (gDecB !== gPlain) throw new Error("group member B failed to decrypt pairwise ciphertext");
ok("GROUP_PAIRWISE_B_OK");

// Member C (not the peer Alice encrypted to) cannot decrypt — documents current limitation.
const remoteC = await fetchRemoteBundle(regA.token, regC.userId);
const gSessC = await productChatEstablish(charlie.client, charlie.identity.privateState, remoteA);
let cFail = false;
try {
  await productChatDecrypt(charlie.client, gSessC, {
    ratchetHeader: gMsg.ratchetHeader,
    ciphertext: gMsg.ciphertext,
    contentType: "msg",
  });
} catch {
  cFail = true;
}
if (!cFail) {
  throw new Error("unexpected: C decrypted A→B pairwise group ciphertext");
}
ok(
  "GROUP_E2EE_PAIRWISE_ONLY_OK",
  "limitation=ChatPanel peerFor uses peerUserIds[0]; not true multi-recipient group E2EE",
);

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
if (!turn.credential || !Array.isArray(turn.uris) || turn.uris.length === 0) {
  throw new Error("turn credentials incomplete");
}
const hasStunOnly = turn.uris.every((u) => String(u).startsWith("stun:"));
ok("CALL_TURN_MINT_OK", hasStunOnly ? "uris=stun-only (no turn: relay yet)" : `uris=${turn.uris.join(",")}`);

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
