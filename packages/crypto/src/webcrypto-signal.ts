/**
 * SignalClient backed by the in-repo X3DH + Double Ratchet (P-256 WebCrypto).
 * Prefer this over DevSignalStub for product paths. Production libsignal /
 * Curve25519 remains a Phase-4 swap behind the same SignalClient interface.
 */

import {
  generateEphemeralKeyPair,
  generateIdentityKeyPair,
  generateOneTimePrekeys,
  generateSignedPrekey,
  toPrekeyBundle,
  x3dhInitiate,
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

  async establishSession(localPrivate: string, remote: DevicePublicKeys): Promise<SecureSession> {
    const priv = decodeJson<PrivateBundle>(localPrivate);
    const remoteId = parseIdentityPub(remote.identityKeyPub);
    const ephemeral = await generateEphemeralKeyPair();
    const shared = await x3dhInitiate(
      { identity: priv.identity, ephemeral },
      {
        identityKey: remoteId.ecdh,
        identitySigningKey: remoteId.signing,
        signedPrekey: JSON.parse(remote.signedPrekeyPub) as JsonWebKey,
        signedPrekeyId: remote.signedPrekeyId,
        signedPrekeySignature: remote.signedPrekeySig,
        oneTimePrekey: remote.oneTimePrekeyPub
          ? (JSON.parse(remote.oneTimePrekeyPub) as JsonWebKey)
          : undefined,
        oneTimePrekeyId: remote.oneTimePrekeyId,
        registrationId: remote.registrationId,
      },
    );
    const ratchet = await initRatchetSession(shared, "initiator");
    const blob: SessionBlob = { ratchet, role: "initiator" };
    return {
      remoteUserId: "peer",
      remoteDeviceId: String(remote.registrationId),
      stateBlob: encodeJson({
        ...blob,
        // Carry Alice publics so Bob can respond via establishResponderSession.
        aliceIdentityPub: priv.identity.publicKey,
        aliceEphemeralPub: ephemeral.publicKey,
        sharedSeed: encodeJson([...new Uint8Array(shared)]),
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
