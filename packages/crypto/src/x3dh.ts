/**
 * X3DH-shaped session setup using WebCrypto ECDH P-256.
 *
 * Limitations vs Signal Protocol (Curve25519 / XEdDSA / X25519):
 * - Uses NIST P-256 ECDH instead of Curve25519 X25519 (Workers/WebCrypto portability).
 * - Prekey signatures use ECDSA P-256 over SHA-256, not XEdDSA.
 * - Identity keys are ECDH P-256 key pairs (not X25519 + Ed25519 dual keys).
 * - Does not implement Signal's associated data binding, PQXDH, or sealed sender.
 * - This is a correct-shaped protocol skeleton for product wiring — not a
 *   drop-in replacement for libsignal / Signal Protocol.
 */

const ECDH_ALG = { name: "ECDH", namedCurve: "P-256" } as const;
const ECDSA_ALG = { name: "ECDSA", namedCurve: "P-256" } as const;
const SIGN_HASH = { name: "ECDSA", hash: "SHA-256" } as const;

export type ExportedKeyPair = {
  publicKey: JsonWebKey;
  privateKey: JsonWebKey;
};

export type IdentityKeyPair = ExportedKeyPair & {
  /** ECDSA key pair for signing/verifying signed prekeys (same curve). */
  signingPublicKey: JsonWebKey;
  signingPrivateKey: JsonWebKey;
};

export type SignedPrekey = ExportedKeyPair & {
  id: number;
  signature: string;
};

export type OneTimePrekey = ExportedKeyPair & {
  id: number;
};

export type PrekeyBundle = {
  identityKey: JsonWebKey;
  identitySigningKey: JsonWebKey;
  signedPrekey: JsonWebKey;
  signedPrekeyId: number;
  signedPrekeySignature: string;
  oneTimePrekey?: JsonWebKey;
  oneTimePrekeyId?: number;
  registrationId: number;
};

export type X3dhAliceKeys = {
  identity: IdentityKeyPair;
  ephemeral: ExportedKeyPair;
};

export type X3dhBobKeys = {
  identity: IdentityKeyPair;
  signedPrekey: SignedPrekey;
  oneTimePrekey?: OneTimePrekey;
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

function concatBuffers(...parts: ArrayBuffer[]): ArrayBuffer {
  const total = parts.reduce((n, p) => n + p.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(new Uint8Array(p), offset);
    offset += p.byteLength;
  }
  return out.buffer;
}

async function exportPair(pair: CryptoKeyPair): Promise<ExportedKeyPair> {
  return {
    publicKey: await crypto.subtle.exportKey("jwk", pair.publicKey),
    privateKey: await crypto.subtle.exportKey("jwk", pair.privateKey),
  };
}

async function importEcdhPrivate(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey("jwk", jwk, ECDH_ALG, false, ["deriveBits"]);
}

async function importEcdhPublic(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey("jwk", jwk, ECDH_ALG, true, []);
}

async function importEcdsaPrivate(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey("jwk", jwk, ECDSA_ALG, false, ["sign"]);
}

async function importEcdsaPublic(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey("jwk", jwk, ECDSA_ALG, true, ["verify"]);
}

async function ecdh(
  privateJwk: JsonWebKey,
  publicJwk: JsonWebKey,
): Promise<ArrayBuffer> {
  const priv = await importEcdhPrivate(privateJwk);
  const pub = await importEcdhPublic(publicJwk);
  return crypto.subtle.deriveBits({ name: "ECDH", public: pub }, priv, 256);
}

async function hkdfSharedSecret(ikm: ArrayBuffer): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new TextEncoder().encode("logoshome-x3dh-v1"),
      info: new TextEncoder().encode("X3DH-SharedSecret"),
    },
    key,
    256,
  );
}

/** Generate long-term identity keys (ECDH + ECDSA signing pair). */
export async function generateIdentityKeyPair(): Promise<IdentityKeyPair> {
  const ecdhPair = await crypto.subtle.generateKey(ECDH_ALG, true, ["deriveBits"]);
  const signPair = await crypto.subtle.generateKey(ECDSA_ALG, true, ["sign", "verify"]);
  const ecdh = await exportPair(ecdhPair);
  return {
    ...ecdh,
    signingPublicKey: await crypto.subtle.exportKey("jwk", signPair.publicKey),
    signingPrivateKey: await crypto.subtle.exportKey("jwk", signPair.privateKey),
  };
}

/** Generate a signed prekey and ECDSA-sign its public JWK with the identity signing key. */
export async function generateSignedPrekey(
  identity: IdentityKeyPair,
  id = 1,
): Promise<SignedPrekey> {
  const pair = await crypto.subtle.generateKey(ECDH_ALG, true, ["deriveBits"]);
  const exported = await exportPair(pair);
  const signKey = await importEcdsaPrivate(identity.signingPrivateKey);
  const payload = new TextEncoder().encode(JSON.stringify(exported.publicKey));
  const sig = await crypto.subtle.sign(SIGN_HASH, signKey, payload);
  return { ...exported, id, signature: b64(sig) };
}

/** Generate a batch of one-time prekeys. */
export async function generateOneTimePrekeys(
  count: number,
  startId = 1,
): Promise<OneTimePrekey[]> {
  const out: OneTimePrekey[] = [];
  for (let i = 0; i < count; i++) {
    const pair = await crypto.subtle.generateKey(ECDH_ALG, true, ["deriveBits"]);
    const exported = await exportPair(pair);
    out.push({ ...exported, id: startId + i });
  }
  return out;
}

export async function verifySignedPrekey(
  identitySigningKey: JsonWebKey,
  signedPrekeyPub: JsonWebKey,
  signatureB64: string,
): Promise<boolean> {
  const pub = await importEcdsaPublic(identitySigningKey);
  const payload = new TextEncoder().encode(JSON.stringify(signedPrekeyPub));
  return crypto.subtle.verify(SIGN_HASH, pub, fromB64(signatureB64) as BufferSource, payload);
}

/**
 * Alice initiates X3DH against Bob's published prekey bundle.
 * Returns the shared secret ArrayBuffer (32 bytes after HKDF).
 */
export async function x3dhInitiate(
  aliceKeys: X3dhAliceKeys,
  bobBundle: PrekeyBundle,
): Promise<ArrayBuffer> {
  const ok = await verifySignedPrekey(
    bobBundle.identitySigningKey,
    bobBundle.signedPrekey,
    bobBundle.signedPrekeySignature,
  );
  if (!ok) throw new Error("invalid_signed_prekey_signature");

  const dh1 = await ecdh(aliceKeys.identity.privateKey, bobBundle.signedPrekey);
  const dh2 = await ecdh(aliceKeys.ephemeral.privateKey, bobBundle.identityKey);
  const dh3 = await ecdh(aliceKeys.ephemeral.privateKey, bobBundle.signedPrekey);

  const parts = [dh1, dh2, dh3];
  if (bobBundle.oneTimePrekey) {
    parts.push(await ecdh(aliceKeys.ephemeral.privateKey, bobBundle.oneTimePrekey));
  }
  return hkdfSharedSecret(concatBuffers(...parts));
}

/**
 * Bob responds to Alice's X3DH using his private keys and Alice's public identity + ephemeral.
 */
export async function x3dhRespond(
  bobKeys: X3dhBobKeys,
  aliceIdentityPub: JsonWebKey,
  aliceEphemeralPub: JsonWebKey,
): Promise<ArrayBuffer> {
  const dh1 = await ecdh(bobKeys.signedPrekey.privateKey, aliceIdentityPub);
  const dh2 = await ecdh(bobKeys.identity.privateKey, aliceEphemeralPub);
  const dh3 = await ecdh(bobKeys.signedPrekey.privateKey, aliceEphemeralPub);

  const parts = [dh1, dh2, dh3];
  if (bobKeys.oneTimePrekey) {
    parts.push(await ecdh(bobKeys.oneTimePrekey.privateKey, aliceEphemeralPub));
  }
  return hkdfSharedSecret(concatBuffers(...parts));
}

/** Convenience: build a public prekey bundle from private material. */
export function toPrekeyBundle(
  identity: IdentityKeyPair,
  signedPrekey: SignedPrekey,
  registrationId: number,
  oneTimePrekey?: OneTimePrekey,
): PrekeyBundle {
  return {
    identityKey: identity.publicKey,
    identitySigningKey: identity.signingPublicKey,
    signedPrekey: signedPrekey.publicKey,
    signedPrekeyId: signedPrekey.id,
    signedPrekeySignature: signedPrekey.signature,
    oneTimePrekey: oneTimePrekey?.publicKey,
    oneTimePrekeyId: oneTimePrekey?.id,
    registrationId,
  };
}

/** Generate a fresh ephemeral ECDH pair for X3DH initiation. */
export async function generateEphemeralKeyPair(): Promise<ExportedKeyPair> {
  const pair = await crypto.subtle.generateKey(ECDH_ALG, true, ["deriveBits"]);
  return exportPair(pair);
}
