/**
 * SignalClient backed by the in-repo X3DH + Double Ratchet (P-256 WebCrypto).
 * Prefer this over DevSignalStub for product paths. Production libsignal /
 * Curve25519 remains a Phase-4 swap behind the same SignalClient interface.
 */

import {
  generateIdentityKeyPair,
  generateOneTimePrekeys,
  generateSignedPrekey,
  toPrekeyBundle,
  verifySignedPrekey,
  x3dhRespond,
  type IdentityKeyPair,
  type OneTimePrekey,
  type SignedPrekey,
} from "./x3dh.js";
import {
  initRatchetSession,
  ratchetDecrypt,
  ratchetEncrypt,
  type RatchetMessage,
  type RatchetSessionState,
} from "./double-ratchet.js";
import type { DevicePublicKeys, EncryptedMessage, SecureSession, SignalClient } from "./signal-stub.js";

const ECDH_ALG = { name: "ECDH", namedCurve: "P-256" } as const;

async function ecdhBits(privateJwk: JsonWebKey, publicJwk: JsonWebKey): Promise<ArrayBuffer> {
  const priv = await crypto.subtle.importKey("jwk", privateJwk, ECDH_ALG, false, ["deriveBits"]);
  const pub = await crypto.subtle.importKey("jwk", publicJwk, ECDH_ALG, true, []);
  return crypto.subtle.deriveBits({ name: "ECDH", public: pub }, priv, 256);
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

function fingerprintEcdhPub(jwk: JsonWebKey): string {
  return `${jwk.x ?? ""}:${jwk.y ?? ""}`;
}

type PrivateBundle = {
  identity: IdentityKeyPair;
  signedPrekey: SignedPrekey;
  oneTimePrekeys: OneTimePrekey[];
  registrationId: number;
};

type SessionBlob = {
  ratchet: RatchetSessionState;
  role: "initiator" | "responder";
};

function encodeJson(value: unknown): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(value))));
}

function decodeJson<T>(raw: string): T {
  return JSON.parse(decodeURIComponent(escape(atob(raw)))) as T;
}

function pubKeysFromPrivate(priv: PrivateBundle): DevicePublicKeys {
  const otp = priv.oneTimePrekeys[0];
  const bundle = toPrekeyBundle(priv.identity, priv.signedPrekey, priv.registrationId, otp);
  return {
    identityKeyPub: JSON.stringify({
      ecdh: bundle.identityKey,
      signing: bundle.identitySigningKey,
    }),
    signedPrekeyPub: JSON.stringify(bundle.signedPrekey),
    signedPrekeySig: bundle.signedPrekeySignature,
    signedPrekeyId: bundle.signedPrekeyId,
    oneTimePrekeyPub: otp ? JSON.stringify(otp.publicKey) : undefined,
    oneTimePrekeyId: otp?.id,
    registrationId: priv.registrationId,
  };
}

function parseIdentityPub(identityKeyPub: string): { ecdh: JsonWebKey; signing: JsonWebKey } {
  const parsed = JSON.parse(identityKeyPub) as
    | { ecdh: JsonWebKey; signing: JsonWebKey }
    | JsonWebKey;
  if (parsed && typeof parsed === "object" && "ecdh" in parsed && "signing" in parsed) {
    return parsed;
  }
  // Legacy single-JWK identity pub — treat as both (signature verify will fail).
  return { ecdh: parsed as JsonWebKey, signing: parsed as JsonWebKey };
}

export class WebCryptoSignalClient implements SignalClient {
  async generateIdentity() {
    const identity = await generateIdentityKeyPair();
    const signedPrekey = await generateSignedPrekey(identity, 1);
    const oneTimePrekeys = await generateOneTimePrekeys(1, 1);
    const registrationId = Math.floor(Math.random() * 16380) + 1;
    const priv: PrivateBundle = { identity, signedPrekey, oneTimePrekeys, registrationId };
    return {
      publicBundle: pubKeysFromPrivate(priv),
      privateState: encodeJson(priv),
    };
  }

  /**
   * Symmetric peer session (both sides call with local private + remote pub).
   * Mutual P-256 ECDH + role by identity fingerprint so send/recv chains mesh,
   * matching X25519SignalClient.establishSession usage in Workers/browser.
   */
  async establishSession(localPrivate: string, remote: DevicePublicKeys): Promise<SecureSession> {
    const priv = decodeJson<PrivateBundle>(localPrivate);
    const remoteId = parseIdentityPub(remote.identityKeyPub);
    const remoteSpk = JSON.parse(remote.signedPrekeyPub) as JsonWebKey;
    const sigOk = await verifySignedPrekey(
      remoteId.signing,
      remoteSpk,
      remote.signedPrekeySig,
    );
    if (!sigOk) throw new Error("webcrypto_signed_prekey_invalid");

    const localIkFp = fingerprintEcdhPub(priv.identity.publicKey);
    const remoteIkFp = fingerprintEcdhPub(remoteId.ecdh);
    const ordered = localIkFp < remoteIkFp;

    const dhIk = await ecdhBits(priv.identity.privateKey, remoteId.ecdh);
    const dhLocalIkRemoteSpk = await ecdhBits(priv.identity.privateKey, remoteSpk);
    const dhLocalSpkRemoteIk = await ecdhBits(priv.signedPrekey.privateKey, remoteId.ecdh);
    const mid = ordered
      ? [dhLocalIkRemoteSpk, dhLocalSpkRemoteIk]
      : [dhLocalSpkRemoteIk, dhLocalIkRemoteSpk];
    const shared = concatBuffers(dhIk, ...mid);

    // Lower fingerprint is initiator so both peers pick complementary ratchet roles.
    const role: "initiator" | "responder" = ordered ? "initiator" : "responder";
    const ratchet = await initRatchetSession(shared, role);
    const blob: SessionBlob = { ratchet, role };
    return {
      remoteUserId: "peer",
      remoteDeviceId: String(remote.registrationId),
      stateBlob: encodeJson({
        ...blob,
        // Still expose identity pubs for establishResponderSession callers / tests.
        aliceIdentityPub: priv.identity.publicKey,
      }),
    };
  }

  /**
   * Bob-side session from Alice's establishSession metadata + Bob's private state.
   * Not on the minimal SignalClient interface; used by tests and dual-device wiring.
   */
  async establishResponderSession(
    bobPrivate: string,
    aliceIdentityPub: JsonWebKey,
    aliceEphemeralPub: JsonWebKey,
  ): Promise<SecureSession> {
    const priv = decodeJson<PrivateBundle>(bobPrivate);
    const otp = priv.oneTimePrekeys[0];
    const shared = await x3dhRespond(
      {
        identity: priv.identity,
        signedPrekey: priv.signedPrekey,
        oneTimePrekey: otp,
      },
      aliceIdentityPub,
      aliceEphemeralPub,
    );
    const ratchet = await initRatchetSession(shared, "responder");
    return {
      remoteUserId: "peer",
      remoteDeviceId: String(priv.registrationId),
      stateBlob: encodeJson({ ratchet, role: "responder" } satisfies SessionBlob),
    };
  }

  async encrypt(session: SecureSession, plaintext: string, expiresAt?: number): Promise<EncryptedMessage> {
    const blob = decodeJson<SessionBlob & Record<string, unknown>>(session.stateBlob);
    const { message, state: next } = await ratchetEncrypt(blob.ratchet, plaintext);
    blob.ratchet = next;
    session.stateBlob = encodeJson(blob);
    return {
      ratchetHeader: encodeJson(message.header),
      ciphertext: JSON.stringify({ iv: message.iv, ciphertext: message.ciphertext }),
      contentType: "msg",
      expiresAt,
    };
  }

  async decrypt(session: SecureSession, message: EncryptedMessage): Promise<string> {
    const blob = decodeJson<SessionBlob & Record<string, unknown>>(session.stateBlob);
    const header = decodeJson<RatchetMessage["header"]>(message.ratchetHeader);
    const body = JSON.parse(message.ciphertext) as { iv: string; ciphertext: string };
    const { plaintext, state: next } = await ratchetDecrypt(blob.ratchet, {
      header,
      iv: body.iv,
      ciphertext: body.ciphertext,
    });
    blob.ratchet = next;
    session.stateBlob = encodeJson(blob);
    return plaintext;
  }
}
