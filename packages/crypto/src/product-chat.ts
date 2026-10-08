/**
 * Product chat path — apps encrypt/decrypt via `createProductSignalClient`
 * (Workers/browser → x25519; Node → native libsignal with x25519 soft-fallback).
 *
 * Server remains a ciphertext courier; private state never leaves the client.
 */

import {
  createProductSignalClient,
  resolveProductSignalBackend,
  type SignalBackend,
} from "./adapters/libsignal.js";
import type {
  DevicePublicKeys,
  EncryptedMessage,
  SecureSession,
  SignalClient,
} from "./signal-stub.js";

export type ProductChatIdentity = {
  publicBundle: DevicePublicKeys;
  privateState: string;
  backend: SignalBackend;
};

/** True when an uploaded identity pub is the portable X25519 product format. */
export function isProductX25519IdentityPub(identityKeyPub: string): boolean {
  try {
    const parsed = JSON.parse(identityKeyPub) as {
      curve?: string;
      ecdh?: unknown;
      signing?: unknown;
    };
    // OpenE2EE shares string ecdh/signing fields — do not classify as x25519.
    if (parsed?.curve === "opene2ee") return false;
    if (parsed?.curve === "x25519") return true;
    // Legacy X25519 pubs are raw base64 strings; P-256 X3DH uses JWK objects (`kty`).
    return typeof parsed?.ecdh === "string" && typeof parsed?.signing === "string";
  } catch {
    return false;
  }
}

/** True when identity pub is the opt-in OpenE2EE product format (Kyber + ECDH). */
export function isProductOpenE2eeIdentityPub(identityKeyPub: string): boolean {
  try {
    const parsed = JSON.parse(identityKeyPub) as { curve?: string };
    return parsed?.curve === "opene2ee";
  } catch {
    return false;
  }
}

/** Either portable product backend (default x25519 or opt-in OpenE2EE). */
export function isProductIdentityPub(identityKeyPub: string): boolean {
  return isProductX25519IdentityPub(identityKeyPub) || isProductOpenE2eeIdentityPub(identityKeyPub);
}

/** Infer product backend from an uploaded identity pub (default x25519). */
export function productBackendFromIdentityPub(identityKeyPub: string): SignalBackend {
  if (isProductOpenE2eeIdentityPub(identityKeyPub)) return "opene2ee";
  return "x25519";
}

export async function getProductSignalClient(prefer?: SignalBackend): Promise<SignalClient> {
  return createProductSignalClient(prefer);
}

export async function createProductChatIdentity(
  prefer?: SignalBackend,
): Promise<{ client: SignalClient; identity: ProductChatIdentity }> {
  const backend = resolveProductSignalBackend(prefer);
  const client = await createProductSignalClient(prefer);
  const { publicBundle, privateState } = await client.generateIdentity();
  return { client, identity: { publicBundle, privateState, backend } };
}

export async function productChatEstablish(
  client: SignalClient,
  localPrivate: string,
  remote: DevicePublicKeys,
): Promise<SecureSession> {
  return client.establishSession(localPrivate, remote);
}

export async function productChatEncrypt(
  client: SignalClient,
  session: SecureSession,
  plaintext: string,
  expiresAt?: number,
): Promise<EncryptedMessage> {
  return client.encrypt(session, plaintext, expiresAt);
}

export async function productChatDecrypt(
  client: SignalClient,
  session: SecureSession,
  message: EncryptedMessage,
): Promise<string> {
  return client.decrypt(session, message);
}

/**
 * Full A↔B roundtrip through the product factory — used by smokes and app self-tests.
 */
export async function productChatPeerRoundtrip(
  plaintext: string,
  prefer: SignalBackend = "x25519",
): Promise<{ backend: SignalBackend; ok: true }> {
  const client = await createProductSignalClient(prefer);
  const backend = resolveProductSignalBackend(prefer);
  const a = await client.generateIdentity();
  const b = await client.generateIdentity();
  const as = await client.establishSession(a.privateState, b.publicBundle);
  const bs = await client.establishSession(b.privateState, a.publicBundle);
  const enc = await client.encrypt(as, plaintext);
  const plain = await client.decrypt(bs, enc);
  if (plain !== plaintext) throw new Error("product_chat_roundtrip_mismatch");
  const reply = await client.encrypt(bs, `${plaintext}:ack`);
  if ((await client.decrypt(as, reply)) !== `${plaintext}:ack`) {
    throw new Error("product_chat_ack_mismatch");
  }
  return { backend, ok: true };
}
