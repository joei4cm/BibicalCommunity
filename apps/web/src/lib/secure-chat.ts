/**
 * Conversation Double Ratchet with X3DH bootstrap when peer prekeys exist.
 * Falls back to a conversation-scoped seed only when keys are missing (degraded).
 * Ratchet / device private material lives in IndexedDB (`lh-secure`), not localStorage.
 */
import {
  generateEphemeralKeyPair,
  initRatchetSession,
  ratchetDecrypt,
  ratchetEncrypt,
  x3dhInitiate,
  x3dhRespond,
  type IdentityKeyPair,
  type OneTimePrekey,
  type RatchetMessage,
  type RatchetSessionState,
  type SignedPrekey,
} from "@logoshome/crypto";
import { api } from "./api";
import { migrateSecureFromLocalStorage, secureGet, secureRemove, secureSet } from "./secure-kv";

const STATE_PREFIX = "lh.ratchet.";
const DEVICE_PRIV_KEY = "lh.device.priv";
const X3DH_PREFIX = "lh.x3dh.";
const X3DH_PREAMBLE_PREFIX = "lh.x3dh.preamble.";

type LocalDevicePriv = {
  identity: IdentityKeyPair;
  signedPrekey: SignedPrekey;
  oneTimePrekeys: OneTimePrekey[];
  registrationId: number;
};

type PeerDeviceBundle = {
  deviceId: string;
  identityKeyPub: string | null;
  signedPrekeyPub: string | null;
  signedPrekeySig: string | null;
  signedPrekeyId: number | null;
  registrationId: number | null;
  oneTimePrekey: { id: number; pub: string } | null;
};

type X3dhPreamble = {
  v: 1;
  ik: JsonWebKey;
  ek: JsonWebKey;
  spkId: number;
  opkId?: number;
};

let migrated = false;
async function ensureMigrated(): Promise<void> {
  if (migrated || typeof localStorage === "undefined") {
    migrated = true;
    return;
  }
  const keys = Object.keys(localStorage).filter(
    (k) =>
      k === DEVICE_PRIV_KEY ||
      k.startsWith(STATE_PREFIX) ||
      k.startsWith(X3DH_PREFIX) ||
      k.startsWith(X3DH_PREAMBLE_PREFIX),
  );
  await migrateSecureFromLocalStorage(keys);
  migrated = true;
}

async function loadState(conversationId: string): Promise<RatchetSessionState | null> {
  await ensureMigrated();
  const raw = await secureGet(STATE_PREFIX + conversationId);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RatchetSessionState;
  } catch {
    return null;
  }
}

async function saveState(conversationId: string, state: RatchetSessionState): Promise<void> {
  await ensureMigrated();
  await secureSet(STATE_PREFIX + conversationId, JSON.stringify(state));
}

async function loadLocalPriv(): Promise<LocalDevicePriv | null> {
  await ensureMigrated();
  const raw = await secureGet(DEVICE_PRIV_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LocalDevicePriv;
  } catch {
    return null;
  }
}

function parseIdentityPub(raw: string): { ecdh: JsonWebKey; signing: JsonWebKey } {
  const parsed = JSON.parse(raw) as { ecdh?: JsonWebKey; signing?: JsonWebKey } | JsonWebKey;
  if (parsed && typeof parsed === "object" && "ecdh" in parsed && parsed.ecdh && parsed.signing) {
    return { ecdh: parsed.ecdh, signing: parsed.signing };
  }
  return { ecdh: parsed as JsonWebKey, signing: parsed as JsonWebKey };
}

async function fetchPeerBundle(peerUserId: string): Promise<PeerDeviceBundle | null> {
  try {
    const res = await api<{ devices: PeerDeviceBundle[] }>(`/v1/keys/${encodeURIComponent(peerUserId)}`);
    return (
      res.devices.find((d) => d.identityKeyPub && d.signedPrekeyPub && d.signedPrekeySig) ?? null
    );
  } catch {
    return null;
  }
}

async function bootstrapFromX3dh(
  conversationId: string,
  peerUserId: string,
): Promise<{ state: RatchetSessionState; preamble: X3dhPreamble } | null> {
  const local = await loadLocalPriv();
  if (!local) return null;
  const peer = await fetchPeerBundle(peerUserId);
  if (!peer?.identityKeyPub || !peer.signedPrekeyPub || !peer.signedPrekeySig || peer.signedPrekeyId == null) {
    return null;
  }
  const remoteId = parseIdentityPub(peer.identityKeyPub);
  const ephemeral = await generateEphemeralKeyPair();
  const shared = await x3dhInitiate(
    { identity: local.identity, ephemeral },
    {
      identityKey: remoteId.ecdh,
      identitySigningKey: remoteId.signing,
      signedPrekey: JSON.parse(peer.signedPrekeyPub) as JsonWebKey,
      signedPrekeyId: peer.signedPrekeyId,
      signedPrekeySignature: peer.signedPrekeySig,
      oneTimePrekey: peer.oneTimePrekey
        ? (JSON.parse(peer.oneTimePrekey.pub) as JsonWebKey)
        : undefined,
      oneTimePrekeyId: peer.oneTimePrekey?.id,
      registrationId: peer.registrationId ?? 0,
    },
  );
  const state = await initRatchetSession(shared, "initiator");
  await saveState(conversationId, state);
  await secureSet(X3DH_PREFIX + conversationId, "initiator");
  const preamble: X3dhPreamble = {
    v: 1,
    ik: local.identity.publicKey,
    ek: ephemeral.publicKey,
    spkId: peer.signedPrekeyId,
    opkId: peer.oneTimePrekey?.id,
  };
  await secureSet(X3DH_PREAMBLE_PREFIX + conversationId, JSON.stringify(preamble));
  return { state, preamble };
}

async function bootstrapDegraded(conversationId: string): Promise<RatchetSessionState> {
  const seed = new TextEncoder().encode(`logoshome-bootstrap:${conversationId}`);
  const ab = seed.buffer.slice(seed.byteOffset, seed.byteOffset + seed.byteLength);
  const state = await initRatchetSession(ab, "initiator");
  await saveState(conversationId, state);
  await secureSet(X3DH_PREFIX + conversationId, "degraded");
  return state;
}

/** Ensure a Double Ratchet session; prefer X3DH when peerUserId + device keys exist. */
export async function ensureRatchet(
  conversationId: string,
  peerUserId?: string | null,
): Promise<RatchetSessionState> {
  const existing = await loadState(conversationId);
  if (existing) return existing;
  if (peerUserId) {
    const x3dh = await bootstrapFromX3dh(conversationId, peerUserId);
    if (x3dh) return x3dh.state;
  }
  return bootstrapDegraded(conversationId);
}

async function ensureResponderFromPreamble(
  conversationId: string,
  preamble: X3dhPreamble,
): Promise<RatchetSessionState | null> {
  const local = await loadLocalPriv();
  if (!local) return null;
  const otp = local.oneTimePrekeys.find((p) => p.id === preamble.opkId) ?? local.oneTimePrekeys[0];
  const shared = await x3dhRespond(
    {
      identity: local.identity,
      signedPrekey: local.signedPrekey,
      oneTimePrekey: otp,
    },
    preamble.ik,
    preamble.ek,
  );
  const state = await initRatchetSession(shared, "responder");
  await saveState(conversationId, state);
  await secureSet(X3DH_PREFIX + conversationId, "responder");
  return state;
}

function encodeHeader(message: RatchetMessage, preamble?: X3dhPreamble | null): string {
  const payload = preamble ? { ...message.header, x3dh: preamble } : message.header;
  return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
}

function decodeHeader(ratchetHeader: string): {
  header: RatchetMessage["header"];
  preamble?: X3dhPreamble;
} {
  const parsed = JSON.parse(decodeURIComponent(escape(atob(ratchetHeader)))) as RatchetMessage["header"] & {
    x3dh?: X3dhPreamble;
  };
  const { x3dh, ...header } = parsed;
  return { header: header as RatchetMessage["header"], preamble: x3dh };
}

export async function encryptChatMessage(
  conversationId: string,
  plaintext: string,
  peerUserId?: string | null,
): Promise<{ ratchetHeader: string; ciphertext: string; mode: "x3dh" | "degraded" }> {
  await ensureMigrated();
  let state = await ensureRatchet(conversationId, peerUserId);
  const modeRaw = (await secureGet(X3DH_PREFIX + conversationId)) as
    | "x3dh"
    | "degraded"
    | "initiator"
    | "responder"
    | null;
  const mode = modeRaw ?? "degraded";
  let preamble: X3dhPreamble | null = null;
  if (mode === "initiator") {
    const raw = await secureGet(X3DH_PREAMBLE_PREFIX + conversationId);
    if (raw) preamble = JSON.parse(raw) as X3dhPreamble;
    // Attach preamble only once (first outbound after bootstrap).
    await secureRemove(X3DH_PREAMBLE_PREFIX + conversationId);
  }
  const { message, state: next } = await ratchetEncrypt(state, plaintext);
  await saveState(conversationId, next);
  return {
    ratchetHeader: encodeHeader(message, preamble),
    ciphertext: JSON.stringify({ iv: message.iv, ciphertext: message.ciphertext }),
    mode: mode === "degraded" ? "degraded" : "x3dh",
  };
}

export async function decryptChatMessage(
  conversationId: string,
  ratchetHeader: string,
  ciphertextBlob: string,
): Promise<string> {
  let state = await loadState(conversationId);
  let header: RatchetMessage["header"];
  let preamble: X3dhPreamble | undefined;
  let body: { iv: string; ciphertext: string };
  try {
    ({ header, preamble } = decodeHeader(ratchetHeader));
    body = JSON.parse(ciphertextBlob) as { iv: string; ciphertext: string };
  } catch {
    throw new Error("legacy_or_invalid");
  }

  if (!state && preamble) {
    state = await ensureResponderFromPreamble(conversationId, preamble);
  }
  if (!state) {
    state = await ensureRatchet(conversationId);
  }

  const msg: RatchetMessage = {
    header,
    iv: body.iv,
    ciphertext: body.ciphertext,
  };
  const { plaintext, state: next } = await ratchetDecrypt(state, msg);
  await saveState(conversationId, next);
  return plaintext;
}
