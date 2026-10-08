/**
 * Curve25519 SignalClient path using WebCrypto X25519 + Ed25519.
 *
 * Not a drop-in for @signalapp/libsignal-client (no full Double Ratchet /
 * sealed sender). Proves portable X25519 ECDH + Ed25519 signed-prekey
 * handshake with AES-GCM session crypto for product wiring and smoke.
 */

import {
  decryptSessionPayload,
  deriveSessionKey,
  encryptSessionPayload,
} from "./session-aes.js";
import type { DevicePublicKeys, EncryptedMessage, SecureSession, SignalClient } from "./signal-stub.js";

type KeyPairRaw = {
  publicKey: string;
  privateKey: string;
};

type PrivateBundle = {
  identityDh: KeyPairRaw;
  identitySign: KeyPairRaw;
  signedPrekey: KeyPairRaw & { id: number; signature: string };
  oneTimePrekeys: Array<KeyPairRaw & { id: number }>;
  registrationId: number;
};

type SessionBlob = {
  sharedMaterial: string;
};

function b64(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of u8) s += String.fromCharCode(b);
  return btoa(s);
}

function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function encodeJson(value: unknown): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(value))));
}

function decodeJson<T>(raw: string): T {
  return JSON.parse(decodeURIComponent(escape(atob(raw)))) as T;
}

async function exportRaw(key: CryptoKey): Promise<string> {
  return b64(await crypto.subtle.exportKey("raw", key));
}

async function importX25519Public(rawB64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", fromB64(rawB64) as BufferSource, { name: "X25519" }, true, []);
}

async function importX25519Private(rawB64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "pkcs8",
    fromB64(rawB64) as BufferSource,
    { name: "X25519" },
    true,
    ["deriveBits"],
  );
}

async function importEd25519Public(rawB64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    fromB64(rawB64) as BufferSource,
    { name: "Ed25519" },
    true,
    ["verify"],
  );
}

async function importEd25519Private(rawB64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "pkcs8",
    fromB64(rawB64) as BufferSource,
    { name: "Ed25519" },
    true,
    ["sign"],
  );
}

async function generateX25519Pair(): Promise<KeyPairRaw> {
  const kp = (await crypto.subtle.generateKey({ name: "X25519" }, true, ["deriveBits"])) as CryptoKeyPair;
  return {
    publicKey: await exportRaw(kp.publicKey),
    privateKey: b64(await crypto.subtle.exportKey("pkcs8", kp.privateKey)),
  };
}

async function generateEd25519Pair(): Promise<KeyPairRaw> {
  const kp = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  return {
    publicKey: await exportRaw(kp.publicKey),
    privateKey: b64(await crypto.subtle.exportKey("pkcs8", kp.privateKey)),
  };
}

async function ecdh(privateRaw: string, publicRaw: string): Promise<Uint8Array> {
  const priv = await importX25519Private(privateRaw);
  const pub = await importX25519Public(publicRaw);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "X25519", public: pub }, priv, 256));
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const len = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function pubKeysFromPrivate(priv: PrivateBundle): DevicePublicKeys {
  const otp = priv.oneTimePrekeys[0];
  return {
    identityKeyPub: JSON.stringify({
      curve: "x25519",
      ecdh: priv.identityDh.publicKey,
      signing: priv.identitySign.publicKey,
    }),
    signedPrekeyPub: priv.signedPrekey.publicKey,
    signedPrekeySig: priv.signedPrekey.signature,
    signedPrekeyId: priv.signedPrekey.id,
    oneTimePrekeyPub: otp?.publicKey,
    oneTimePrekeyId: otp?.id,
    registrationId: priv.registrationId,
  };
}

function parseIdentityPub(identityKeyPub: string): { ecdh: string; signing: string } {
  const parsed = JSON.parse(identityKeyPub) as { ecdh: string; signing: string; curve?: string };
  if (!parsed?.ecdh || !parsed?.signing) throw new Error("invalid_x25519_identity_pub");
  return parsed;
}

/**
 * Mutual static handshake both peers can compute without an ephemeral:
 * DH(IK_a, IK_b) || DH(IK_a, SPK_b) || DH(SPK_a, IK_b) with identity pubs sorted.
 */
async function mutualSharedMaterial(
  local: PrivateBundle,
  remote: DevicePublicKeys,
): Promise<string> {
  const remoteId = parseIdentityPub(remote.identityKeyPub);
  const verifyKey = await importEd25519Public(remoteId.signing);
  const ok = await crypto.subtle.verify(
    "Ed25519",
    verifyKey,
    fromB64(remote.signedPrekeySig) as BufferSource,
    fromB64(remote.signedPrekeyPub) as BufferSource,
  );
  if (!ok) throw new Error("x25519_signed_prekey_invalid");

  const localIkPub = local.identityDh.publicKey;
  const remoteIkPub = remoteId.ecdh;
  const ordered = localIkPub < remoteIkPub;

  const dhIk = await ecdh(local.identityDh.privateKey, remoteIkPub);
  const dhLocalIkRemoteSpk = await ecdh(local.identityDh.privateKey, remote.signedPrekeyPub);
  const dhLocalSpkRemoteIk = await ecdh(local.signedPrekey.privateKey, remoteIkPub);

  // Order DH contributions so both peers concatenate identically.
  const mid = ordered
    ? [dhLocalIkRemoteSpk, dhLocalSpkRemoteIk]
    : [dhLocalSpkRemoteIk, dhLocalIkRemoteSpk];
  return b64(concatBytes(dhIk, ...mid));
}

export class X25519SignalClient implements SignalClient {
  async generateIdentity() {
    const identityDh = await generateX25519Pair();
    const identitySign = await generateEd25519Pair();
    const signed = await generateX25519Pair();
    const signKey = await importEd25519Private(identitySign.privateKey);
    const signature = b64(
      await crypto.subtle.sign("Ed25519", signKey, fromB64(signed.publicKey) as BufferSource),
    );
    const oneTime = await generateX25519Pair();
    const priv: PrivateBundle = {
      identityDh,
      identitySign,
      signedPrekey: { ...signed, id: 1, signature },
      oneTimePrekeys: [{ ...oneTime, id: 1 }],
      registrationId: Math.floor(Math.random() * 16380) + 1,
    };
    return {
      publicBundle: pubKeysFromPrivate(priv),
      privateState: encodeJson(priv),
    };
  }

  async establishSession(localPrivate: string, remote: DevicePublicKeys): Promise<SecureSession> {
    const priv = decodeJson<PrivateBundle>(localPrivate);
    const sharedMaterial = await mutualSharedMaterial(priv, remote);
    const blob: SessionBlob = { sharedMaterial };
    return {
      remoteUserId: `reg-${remote.registrationId ?? 0}`,
      remoteDeviceId: String(remote.registrationId ?? "remote"),
      stateBlob: encodeJson(blob),
    };
  }

  async encrypt(session: SecureSession, plaintext: string, expiresAt?: number): Promise<EncryptedMessage> {
    const blob = decodeJson<SessionBlob>(session.stateBlob);
    const key = await deriveSessionKey(blob.sharedMaterial);
    const { ratchetHeader, ciphertext } = await encryptSessionPayload(key, plaintext, "x25519");
    return {
      ratchetHeader,
      ciphertext,
      contentType: "msg",
      expiresAt,
    };
  }

  async decrypt(session: SecureSession, message: EncryptedMessage): Promise<string> {
    const blob = decodeJson<SessionBlob>(session.stateBlob);
    const key = await deriveSessionKey(blob.sharedMaterial);
    return decryptSessionPayload(key, message.ratchetHeader, message.ciphertext, "x25519");
  }
}

/** Capability probe for environments that expose WebCrypto X25519/Ed25519. */
export async function probeCurve25519WebCrypto(): Promise<boolean> {
  try {
    const kp = (await crypto.subtle.generateKey({ name: "X25519" }, false, ["deriveBits"])) as CryptoKeyPair;
    await crypto.subtle.deriveBits({ name: "X25519", public: kp.publicKey }, kp.privateKey, 256);
    const ed = (await crypto.subtle.generateKey({ name: "Ed25519" }, false, ["sign", "verify"])) as CryptoKeyPair;
    const msg = new TextEncoder().encode("probe");
    const sig = await crypto.subtle.sign("Ed25519", ed.privateKey, msg);
    return crypto.subtle.verify("Ed25519", ed.publicKey, sig, msg);
  } catch {
    return false;
  }
}
