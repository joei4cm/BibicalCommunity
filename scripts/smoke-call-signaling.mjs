#!/usr/bin/env node
/**
 * Node smoke: two auth users + conversation + call, dual WS join,
 * exchange offer/answer/ice + screen-offer/screen-answer/screen, assert DO fan-out.
 *
 * Does NOT invoke getDisplayMedia (browser-permission gated). Signaling only.
 *
 * Usage: node scripts/smoke-call-signaling.mjs [http://127.0.0.1:8787]
 * Echoes SCREEN_SIGNAL_OK / CALL_SCREEN_SIGNAL_OK on success.
 */
import { randomBytes } from "node:crypto";

const BASE = process.argv[2] ?? "http://127.0.0.1:8787";
const PASS = "SmokeTestPass123!";

function wsBase(httpBase) {
  const u = new URL(httpBase);
  u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
  return u.origin;
}

async function json(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

function connectWs(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const timer = setTimeout(() => reject(new Error(`ws join timeout: ${url}`)), 10000);
    ws.addEventListener("error", () => {
      clearTimeout(timer);
      reject(new Error("ws error"));
    });
    ws.addEventListener("message", (ev) => {
      let msg;
      try {
        msg = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      if (msg.type === "joined") {
        clearTimeout(timer);
        resolve({ ws, joined: msg });
      }
    });
  });
}

function waitForType(ws, type, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${type}`)), timeoutMs);
    const onMsg = (ev) => {
      let msg;
      try {
        msg = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      if (msg.type === type) {
        clearTimeout(timer);
        ws.removeEventListener("message", onMsg);
        resolve(msg);
      }
    };
    ws.addEventListener("message", onMsg);
  });
}

const suffix = randomBytes(4).toString("hex");
const handleA = `calla_${suffix}`;
const handleB = `callb_${suffix}`;

console.log("== register two users ==");
const regA = await json("POST", "/v1/auth/register", {
  body: { handle: handleA, password: PASS, nickname: "CallA", locale: "en" },
});
const regB = await json("POST", "/v1/auth/register", {
  body: { handle: handleB, password: PASS, nickname: "CallB", locale: "en" },
});
const tokenA = regA.token;
const tokenB = regB.token;
const userA = regA.userId;
const userB = regB.userId;
if (!tokenA || !tokenB || !userA || !userB) throw new Error("missing auth tokens/userId");

console.log("== create conversation ==");
const convo = await json("POST", "/v1/chat/conversations", {
  token: tokenA,
  body: { kind: "dm", memberIds: [userB] },
});
const conversationId = convo.id;
if (!conversationId) throw new Error("missing conversation id");

console.log("== create call ==");
const call = await json("POST", "/v1/chat/calls", {
  token: tokenA,
  body: { conversationId },
});
const callId = call.callId;
const signalingPath = call.signalingPath;
if (!callId || !signalingPath) throw new Error("missing callId/signalingPath");
console.log(`callId=${callId} path=${signalingPath}`);

const origin = wsBase(BASE);
const urlA = `${origin}${signalingPath}?token=${encodeURIComponent(tokenA)}&conversationId=${encodeURIComponent(conversationId)}`;
const urlB = `${origin}${signalingPath}?token=${encodeURIComponent(tokenB)}&conversationId=${encodeURIComponent(conversationId)}`;

console.log("== two WS clients join ==");
const a = await connectWs(urlA);
const b = await connectWs(urlB);
console.log(`peers A=${a.joined.peers} B=${b.joined.peers}`);
if (b.joined.peers < 2) throw new Error(`expected ≥2 peers after join, got ${b.joined.peers}`);

console.log("== offer / answer / ice fan-out ==");
const expectOffer = waitForType(b.ws, "offer");
a.ws.send(JSON.stringify({ type: "offer", sdp: "v=0\r\no=- smoke-offer" }));
const offerMsg = await expectOffer;
if (!offerMsg.sdp) throw new Error("offer missing sdp");
if (offerMsg.from && offerMsg.from !== userA) {
  throw new Error(`offer from mismatch: ${offerMsg.from} !== ${userA}`);
}
console.log("OFFER_FANOUT_OK");

const expectAnswer = waitForType(a.ws, "answer");
b.ws.send(JSON.stringify({ type: "answer", sdp: "v=0\r\no=- smoke-answer" }));
const answerMsg = await expectAnswer;
if (!answerMsg.sdp) throw new Error("answer missing sdp");
console.log("ANSWER_FANOUT_OK");

const expectIce = waitForType(b.ws, "ice");
a.ws.send(
  JSON.stringify({
    type: "ice",
    candidate: { candidate: "candidate:1 1 UDP 2122252543 127.0.0.1 54400 typ host", sdpMid: "0" },
  }),
);
const iceMsg = await expectIce;
if (!iceMsg.candidate) throw new Error("ice missing candidate");
console.log("ICE_FANOUT_OK");
console.log("CALL_WS_FANOUT_OK");

console.log("== reject non-signaling type ==");
const expectErr = waitForType(a.ws, "error");
a.ws.send(JSON.stringify({ type: "media", payload: "smuggle" }));
const errMsg = await expectErr;
if (errMsg.error !== "invalid_type") throw new Error(`expected invalid_type, got ${errMsg.error}`);
console.log("CALL_SIGNAL_ALLOWLIST_OK");

console.log("== screen-offer / screen-answer / screen fan-out (no getDisplayMedia) ==");
const expectScreenOffer = waitForType(b.ws, "screen-offer");
a.ws.send(
  JSON.stringify({
    type: "screen-offer",
    sdp: "v=0\r\no=- screen-offer\r\na=sendonly",
  }),
);
const screenOffer = await expectScreenOffer;
if (!screenOffer.sdp || !String(screenOffer.sdp).includes("screen-offer")) {
  throw new Error("screen-offer fan-out failed");
}
if (screenOffer.from && screenOffer.from !== userA) {
  throw new Error(`screen-offer from mismatch: ${screenOffer.from}`);
}
console.log("SCREEN_OFFER_FANOUT_OK");

const expectScreenAnswer = waitForType(a.ws, "screen-answer");
b.ws.send(JSON.stringify({ type: "screen-answer", sdp: "v=0\r\no=- screen-answer" }));
const screenAnswer = await expectScreenAnswer;
if (!screenAnswer.sdp || !String(screenAnswer.sdp).includes("screen-answer")) {
  throw new Error("screen-answer fan-out failed");
}
console.log("SCREEN_ANSWER_FANOUT_OK");

const expectScreen = waitForType(b.ws, "screen");
a.ws.send(JSON.stringify({ type: "screen" }));
await expectScreen;
console.log("SCREEN_NOTIFY_FANOUT_OK");

const expectHangup = waitForType(b.ws, "hangup");
a.ws.send(JSON.stringify({ type: "hangup" }));
await expectHangup;
console.log("HANGUP_FANOUT_OK");

a.ws.close();
b.ws.close();

console.log("== late joiner gets buffered offer + peer-joined ==");
const call2 = await json("POST", "/v1/chat/calls", {
  token: tokenA,
  body: { conversationId },
});
const path2 = call2.signalingPath;
const urlA2 = `${origin}${path2}?token=${encodeURIComponent(tokenA)}&conversationId=${encodeURIComponent(conversationId)}`;
const urlB2 = `${origin}${path2}?token=${encodeURIComponent(tokenB)}&conversationId=${encodeURIComponent(conversationId)}`;
const a2 = await connectWs(urlA2);
const expectPeerJoined = waitForType(a2.ws, "peer-joined");
a2.ws.send(JSON.stringify({ type: "ring" }));
a2.ws.send(JSON.stringify({ type: "offer", sdp: "v=0\r\no=- buffered-offer" }));
await new Promise((r) => setTimeout(r, 50));

const b2 = await new Promise((resolve, reject) => {
  const ws = new WebSocket(urlB2);
  const timer = setTimeout(() => reject(new Error(`ws join timeout: ${urlB2}`)), 10000);
  let joined = null;
  let offer = null;
  const maybeDone = () => {
    if (joined && offer) {
      clearTimeout(timer);
      resolve({ ws, joined, offer });
    }
  };
  ws.addEventListener("error", () => {
    clearTimeout(timer);
    reject(new Error("ws error"));
  });
  ws.addEventListener("message", (ev) => {
    let msg;
    try {
      msg = JSON.parse(String(ev.data));
    } catch {
      return;
    }
    if (msg.type === "joined") joined = msg;
    if (msg.type === "offer" && String(msg.sdp || "").includes("buffered-offer")) offer = msg;
    maybeDone();
  });
});

const peerJoined = await expectPeerJoined;
if (!peerJoined.peers || peerJoined.peers < 2) {
  throw new Error(`peer-joined peers expected ≥2, got ${peerJoined.peers}`);
}
console.log("PEER_JOINED_OK");
if (!b2.offer?.sdp) throw new Error("buffered offer not replayed to late joiner");
console.log("BUFFERED_OFFER_OK");
if (b2.joined.peers < 2) throw new Error(`late joiner peers expected ≥2, got ${b2.joined.peers}`);

a2.ws.close();
b2.ws.close();
console.log("SCREEN_SIGNAL_OK");
console.log("CALL_SCREEN_SIGNAL_OK");
process.exit(0);
