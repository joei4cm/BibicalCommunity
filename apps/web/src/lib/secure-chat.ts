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
import {
  tryDecryptProductChatMessage,
  tryEncryptProductChatMessage,
} from "./product-signal-chat";
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

/** Canonical pair id so both peers derive the same degraded seed / storage key. */
function pairKey(selfUserId?: string | null, peerUserId?: string | null): string | null {
  if (!selfUserId || !peerUserId) return peerUserId ?? null;
  return [selfUserId, peerUserId].sort().join(":");
}

/** Peer-scoped ratchet so group fan-out keeps independent chains per member. */
function ratchetStateKey(
  conversationId: string,
  peerUserId?: string | null,
  selfUserId?: string | null,
): string {
  const pair = pairKey(selfUserId, peerUserId);
  // v2: sorted pair + role-aware degraded bootstrap (fixes peer can't decrypt).
  return pair ? `${STATE_PREFIX}v2:${conversationId}:${pair}` : `${STATE_PREFIX}v2:${conversationId}`;
}

function x3dhModeKey(
  conversationId: string,
  peerUserId?: string | null,
  selfUserId?: string | null,
): string {
  const pair = pairKey(selfUserId, peerUserId);
  return pair ? `${X3DH_PREFIX}v2:${conversationId}:${pair}` : `${X3DH_PREFIX}v2:${conversationId}`;
}

function x3dhPreambleKey(
  conversationId: string,
  peerUserId?: string | null,
  selfUserId?: string | null,
): string {
  const pair = pairKey(selfUserId, peerUserId);
  return pair
    ? `${X3DH_PREAMBLE_PREFIX}v2:${conversationId}:${pair}`
    : `${X3DH_PREAMBLE_PREFIX}v2:${conversationId}`;
}

async function loadState(
  conversationId: string,
  peerUserId?: string | null,
  selfUserId?: string | null,
): Promise<RatchetSessionState | null> {
  await ensureMigrated();
  const raw = await secureGet(ratchetStateKey(conversationId, peerUserId, selfUserId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RatchetSessionState;
  } catch {
    return null;
  }
}

async function saveState(
  conversationId: string,
  state: RatchetSessionState,
  peerUserId?: string | null,
  selfUserId?: string | null,
): Promise<void> {
  await ensureMigrated();
  await secureSet(ratchetStateKey(conversationId, peerUserId, selfUserId), JSON.stringify(state));
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
  selfUserId?: string | null,
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
  await saveState(conversationId, state, peerUserId, selfUserId);
  await secureSet(x3dhModeKey(conversationId, peerUserId, selfUserId), "initiator");
  const preamble: X3dhPreamble = {
    v: 1,
    ik: local.identity.publicKey,
    ek: ephemeral.publicKey,
    spkId: peer.signedPrekeyId,
    opkId: peer.oneTimePrekey?.id,
  };
  await secureSet(x3dhPreambleKey(conversationId, peerUserId, selfUserId), JSON.stringify(preamble));
  return { state, preamble };
}

/** Opt-in only (`VITE_ALLOW_DEGRADED_CHAT=true`). Production must fail closed. */
export function degradedChatAllowed(): boolean {
  try {
    return String(import.meta.env.VITE_ALLOW_DEGRADED_CHAT ?? "") === "true";
  } catch {
    return false;
  }
}

async function bootstrapDegraded(
  conversationId: string,
  peerUserId?: string | null,
  selfUserId?: string | null,
): Promise<RatchetSessionState> {
  if (!degradedChatAllowed()) {
    throw new Error("chat_keys_required");
  }
  const pair = pairKey(selfUserId, peerUserId);
  // v2 seed is symmetric for both peers (sorted user ids).
  const seedMaterial = pair
    ? `logoshome-bootstrap-v2:${conversationId}:${pair}`
    : `logoshome-bootstrap-v2:${conversationId}`;
  const seed = new TextEncoder().encode(seedMaterial);
  const ab = seed.buffer.slice(seed.byteOffset, seed.byteOffset + seed.byteLength);
  const role =
    selfUserId && peerUserId
      ? selfUserId < peerUserId
        ? "initiator"
        : "responder"
      : "initiator";
  const state = await initRatchetSession(ab, role);
  await saveState(conversationId, state, peerUserId, selfUserId);
  await secureSet(x3dhModeKey(conversationId, peerUserId, selfUserId), "degraded");
  return state;
}

/** Ensure a Double Ratchet session; prefer X3DH when peerUserId + device keys exist. */
export async function ensureRatchet(
  conversationId: string,
  peerUserId?: string | null,
  selfUserId?: string | null,
): Promise<RatchetSessionState> {
  const existing = await loadState(conversationId, peerUserId, selfUserId);
  if (existing) return existing;
  if (peerUserId) {
    const x3dh = await bootstrapFromX3dh(conversationId, peerUserId, selfUserId);
    if (x3dh) return x3dh.state;
  }
  return bootstrapDegraded(conversationId, peerUserId, selfUserId);
}

async function ensureResponderFromPreamble(
  conversationId: string,
  preamble: X3dhPreamble,
  peerUserId?: string | null,
  selfUserId?: string | null,
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
  await saveState(conversationId, state, peerUserId, selfUserId);
  await secureSet(x3dhModeKey(conversationId, peerUserId, selfUserId), "responder");
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
  selfUserId?: string | null,
): Promise<{ ratchetHeader: string; ciphertext: string; mode: "product" | "x3dh" | "degraded" }> {
  await ensureMigrated();
  // Prefer product SignalClient (browser → x25519) when both peers uploaded product keys.
  const product = await tryEncryptProductChatMessage(conversationId, plaintext, peerUserId);
  if (product) return product;

  let state = await ensureRatchet(conversationId, peerUserId, selfUserId);
  const modeRaw = (await secureGet(x3dhModeKey(conversationId, peerUserId, selfUserId))) as
    | "x3dh"
    | "degraded"
    | "initiator"
    | "responder"
    | null;
  const mode = modeRaw ?? "degraded";
  if (mode === "degraded" && !degradedChatAllowed()) {
    throw new Error("chat_keys_required");
  }
  let preamble: X3dhPreamble | null = null;
  if (mode === "initiator") {
    const raw = await secureGet(x3dhPreambleKey(conversationId, peerUserId, selfUserId));
    if (raw) preamble = JSON.parse(raw) as X3dhPreamble;
    // Attach preamble only once (first outbound after bootstrap).
    await secureRemove(x3dhPreambleKey(conversationId, peerUserId, selfUserId));
  }
  const { message, state: next } = await ratchetEncrypt(state, plaintext);
  await saveState(conversationId, next, peerUserId, selfUserId);
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
  peerUserId?: string | null,
  selfUserId?: string | null,
): Promise<string> {
  const productPlain = await tryDecryptProductChatMessage(
    conversationId,
    ratchetHeader,
    ciphertextBlob,
    peerUserId,
  );
  if (productPlain != null) return productPlain;

  let state = await loadState(conversationId, peerUserId, selfUserId);
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
    state = await ensureResponderFromPreamble(conversationId, preamble, peerUserId, selfUserId);
  }
  if (!state) {
    state = await ensureRatchet(conversationId, peerUserId, selfUserId);
  }

  const msg: RatchetMessage = {
    header,
    iv: body.iv,
    ciphertext: body.ciphertext,
  };
  try {
    const { plaintext, state: next } = await ratchetDecrypt(state, msg);
    await saveState(conversationId, next, peerUserId, selfUserId);
    return plaintext;
  } catch (err) {
    // Recover from stale/broken local ratchet by rebuilding once.
    await secureRemove(ratchetStateKey(conversationId, peerUserId, selfUserId));
    await secureRemove(x3dhModeKey(conversationId, peerUserId, selfUserId));
    if (preamble) {
      state = await ensureResponderFromPreamble(conversationId, preamble, peerUserId, selfUserId);
    } else {
      state = await ensureRatchet(conversationId, peerUserId, selfUserId);
    }
    if (!state) throw err;
    const { plaintext, state: next } = await ratchetDecrypt(state, msg);
    await saveState(conversationId, next, peerUserId, selfUserId);
    return plaintext;
  }
}
