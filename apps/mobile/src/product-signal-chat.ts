/**
 * Mobile product Signal chat — `createProductSignalClient` (Expo → x25519).
 * Private identity/session blobs prefer SecureStore via secure-kv.
 */
import {
  createProductChatIdentity,
  getProductSignalClient,
  isProductX25519IdentityPub,
  productChatDecrypt,
  productChatEncrypt,
  productChatEstablish,
  type DevicePublicKeys,
  type SecureSession,
} from "@logoshome/crypto";
import { api } from "./api";
import { kvGet, kvSet } from "./secure-kv";

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

export async function mintProductIdentityForUpload(): Promise<DevicePublicKeys> {
  const { identity } = await createProductChatIdentity();
  await kvSet(PRODUCT_PRIV_KEY, identity.privateState);
  return identity.publicBundle;
}

export async function hasProductIdentity(): Promise<boolean> {
  const { value } = await kvGet(PRODUCT_PRIV_KEY);
  return Boolean(value);
}

async function fetchPeerProductBundle(peerUserId: string): Promise<DevicePublicKeys | null> {
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
        isProductX25519IdentityPub(d.identityKeyPub),
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

async function loadOrEstablishSession(
  conversationId: string,
  localPrivate: string,
  remote: DevicePublicKeys,
): Promise<SecureSession> {
  const { value: raw } = await kvGet(PRODUCT_SESSION_PREFIX + conversationId);
  if (raw) {
    try {
      return JSON.parse(raw) as SecureSession;
    } catch {
      /* re-establish */
    }
  }
  const client = await getProductSignalClient();
  const session = await productChatEstablish(client, localPrivate, remote);
  await kvSet(PRODUCT_SESSION_PREFIX + conversationId, JSON.stringify(session));
  return session;
}

export function isProductRatchetHeader(ratchetHeader: string): boolean {
  return ratchetHeader.startsWith(PRODUCT_HEADER_PREFIX);
}

export async function tryEncryptProductMobileMessage(
  conversationId: string,
  plaintext: string,
  peerUserId?: string | null,
  expiresAt?: number,
): Promise<{ ratchetHeader: string; ciphertext: string } | null> {
  if (!peerUserId) return null;
  const { value: localPrivate } = await kvGet(PRODUCT_PRIV_KEY);
  if (!localPrivate) return null;
  const remote = await fetchPeerProductBundle(peerUserId);
  if (!remote) return null;

  const client = await getProductSignalClient();
  const session = await loadOrEstablishSession(conversationId, localPrivate, remote);
  const enc = await productChatEncrypt(client, session, plaintext, expiresAt);
  await kvSet(PRODUCT_SESSION_PREFIX + conversationId, JSON.stringify(session));
  return {
    ratchetHeader: PRODUCT_HEADER_PREFIX + enc.ratchetHeader,
    ciphertext: enc.ciphertext,
  };
}

export async function tryDecryptProductMobileMessage(
  conversationId: string,
  ratchetHeader: string,
  ciphertext: string,
  peerUserId?: string | null,
): Promise<string | null> {
  if (!isProductRatchetHeader(ratchetHeader)) return null;
  const { value: localPrivate } = await kvGet(PRODUCT_PRIV_KEY);
  if (!localPrivate) return null;

  let { value: sessionRaw } = await kvGet(PRODUCT_SESSION_PREFIX + conversationId);
  if (!sessionRaw && peerUserId) {
    const remote = await fetchPeerProductBundle(peerUserId);
    if (remote) {
      await loadOrEstablishSession(conversationId, localPrivate, remote);
      ({ value: sessionRaw } = await kvGet(PRODUCT_SESSION_PREFIX + conversationId));
    }
  }
  if (!sessionRaw) return null;

  let session: SecureSession;
  try {
    session = JSON.parse(sessionRaw) as SecureSession;
  } catch {
    return null;
  }

  const client = await getProductSignalClient();
  const header = ratchetHeader.slice(PRODUCT_HEADER_PREFIX.length);
  try {
    const plain = await productChatDecrypt(client, session, {
      ratchetHeader: header,
      ciphertext,
      contentType: "msg",
    });
    await kvSet(PRODUCT_SESSION_PREFIX + conversationId, JSON.stringify(session));
    return plain;
  } catch {
    return null;
  }
}
