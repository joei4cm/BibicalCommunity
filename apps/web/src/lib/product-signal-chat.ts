/**
 * Web product Signal chat path — `createProductSignalClient`
 * (browser default → x25519; opt-in OpenE2EE via `lh.signalBackend`).
 * Private identity/session blobs live in IndexedDB via secure-kv.
 */
import {
  createProductChatIdentity,
  getProductSignalClient,
  isProductOpenE2eeIdentityPub,
  isProductX25519IdentityPub,
  productBackendFromIdentityPub,
  productChatDecrypt,
  productChatEncrypt,
  productChatEstablish,
  type DevicePublicKeys,
  type SecureSession,
} from "@logoshome/crypto";
import { api } from "./api";
import { loadProductSignalPrefer } from "./product-signal-prefer";
import { secureGet, secureSet } from "./secure-kv";

export const PRODUCT_PRIV_KEY = "lh.product.signal.priv";
const PRODUCT_SESSION_PREFIX = "lh.product.session.";
const PRODUCT_HEADER_PREFIX = "product:";

type PeerDeviceBundle = {
  deviceId: string;
  identityKeyPub: string | null;
  signedPrekeyPub: string | null;
  signedPrekeySig: string | null;
  signedPrekeyId: number | null;
  registrationId: number | null;
  oneTimePrekey: { id: number; pub: string } | null;
};

function peerMatchesPrefer(
  identityKeyPub: string,
  prefer: ReturnType<typeof loadProductSignalPrefer>,
): boolean {
  if (prefer === "opene2ee") return isProductOpenE2eeIdentityPub(identityKeyPub);
  return isProductX25519IdentityPub(identityKeyPub);
}

/** Generate product identity, persist private blob, return public bundle for upload. */
export async function mintProductIdentityForUpload(): Promise<DevicePublicKeys> {
  const prefer = loadProductSignalPrefer();
  const { identity } = await createProductChatIdentity(prefer);
  await secureSet(PRODUCT_PRIV_KEY, identity.privateState);
  return identity.publicBundle;
}

export async function loadProductPrivate(): Promise<string | null> {
  return secureGet(PRODUCT_PRIV_KEY);
}

export async function hasProductIdentity(): Promise<boolean> {
  return Boolean(await secureGet(PRODUCT_PRIV_KEY));
}

async function fetchPeerProductBundle(peerUserId: string): Promise<DevicePublicKeys | null> {
  const prefer = loadProductSignalPrefer();
  try {
    const res = await api<{ devices: PeerDeviceBundle[] }>(
      `/v1/keys/${encodeURIComponent(peerUserId)}`,
    );
    const device = res.devices.find(
      (d) =>
        d.identityKeyPub &&
        d.signedPrekeyPub &&
        d.signedPrekeySig &&
        d.signedPrekeyId != null &&
        peerMatchesPrefer(d.identityKeyPub, prefer),
    );
    if (!device?.identityKeyPub || !device.signedPrekeyPub || !device.signedPrekeySig) {
      return null;
    }
    return {
      identityKeyPub: device.identityKeyPub,
      signedPrekeyPub: device.signedPrekeyPub,
      signedPrekeySig: device.signedPrekeySig,
      signedPrekeyId: device.signedPrekeyId ?? 1,
      oneTimePrekeyPub: device.oneTimePrekey?.pub,
      oneTimePrekeyId: device.oneTimePrekey?.id,
      registrationId: device.registrationId ?? 0,
    };
  } catch {
    return null;
  }
}

/** Peer-scoped so group fan-out can keep one session per member. */
function productSessionKey(conversationId: string, peerUserId: string): string {
  return `${PRODUCT_SESSION_PREFIX}${conversationId}:${peerUserId}`;
}

async function loadOrEstablishSession(
  conversationId: string,
  peerUserId: string,
  localPrivate: string,
  remote: DevicePublicKeys,
): Promise<SecureSession> {
  const key = productSessionKey(conversationId, peerUserId);
  const raw = await secureGet(key);
  if (raw) {
    try {
      return JSON.parse(raw) as SecureSession;
    } catch {
      /* re-establish */
    }
  }
  const prefer = productBackendFromIdentityPub(remote.identityKeyPub);
  const client = await getProductSignalClient(prefer);
  const session = await productChatEstablish(client, localPrivate, remote);
  await secureSet(key, JSON.stringify(session));
  return session;
}

export function isProductRatchetHeader(ratchetHeader: string): boolean {
  return ratchetHeader.startsWith(PRODUCT_HEADER_PREFIX);
}

export async function tryEncryptProductChatMessage(
  conversationId: string,
  plaintext: string,
  peerUserId?: string | null,
  expiresAt?: number,
): Promise<{ ratchetHeader: string; ciphertext: string; mode: "product" } | null> {
  if (!peerUserId) return null;
  const localPrivate = await loadProductPrivate();
  if (!localPrivate) return null;
  const remote = await fetchPeerProductBundle(peerUserId);
  if (!remote) return null;

  const prefer = productBackendFromIdentityPub(remote.identityKeyPub);
  const client = await getProductSignalClient(prefer);
  const session = await loadOrEstablishSession(conversationId, peerUserId, localPrivate, remote);
  const enc = await productChatEncrypt(client, session, plaintext, expiresAt);
  await secureSet(productSessionKey(conversationId, peerUserId), JSON.stringify(session));
  return {
    ratchetHeader: PRODUCT_HEADER_PREFIX + enc.ratchetHeader,
    ciphertext: enc.ciphertext,
    mode: "product",
  };
}

export async function tryDecryptProductChatMessage(
  conversationId: string,
  ratchetHeader: string,
  ciphertext: string,
  peerUserId?: string | null,
): Promise<string | null> {
  if (!isProductRatchetHeader(ratchetHeader)) return null;
  const localPrivate = await loadProductPrivate();
  if (!localPrivate) return null;
  if (!peerUserId) return null;

  const key = productSessionKey(conversationId, peerUserId);
  let sessionRaw = await secureGet(key);
  if (!sessionRaw) {
    const remote = await fetchPeerProductBundle(peerUserId);
    if (remote) {
      await loadOrEstablishSession(conversationId, peerUserId, localPrivate, remote);
      sessionRaw = await secureGet(key);
    }
  }
  if (!sessionRaw) return null;

  let session: SecureSession;
  try {
    session = JSON.parse(sessionRaw) as SecureSession;
  } catch {
    return null;
  }

  const client = await getProductSignalClient(loadProductSignalPrefer());
  const header = ratchetHeader.slice(PRODUCT_HEADER_PREFIX.length);
  try {
    const plain = await productChatDecrypt(client, session, {
      ratchetHeader: header,
      ciphertext,
      contentType: "msg",
    });
    await secureSet(key, JSON.stringify(session));
    return plain;
  } catch {
    return null;
  }
}
