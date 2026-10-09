/**
 * OpenE2EE-backed SignalClient for Workers/browser (MIT/Apache).
 *
 * Product path uses **PQXDH** when both peers publish Kyber last-resort prekeys:
 *   - Deterministic initiator = lower identity ECDH pub (lexicographic)
 *   - Initiator runs `performKeyAgreement` at establishSession
 *   - First encrypt embeds prekey metadata in ratchetHeader
 *   - Responder completes `performResponderKeyAgreement` on first decrypt
 *
 * Falls back to mutual X25519 ECDH when Kyber is missing on either side.
 * Not wire-compatible with Signal Messenger / official libsignal.
 * Official Workers WASM remains OPEN upstream (`LIBSIGNAL_WORKERS_OPEN`).
 */

import {
  decryptSessionPayload,
  deriveSessionKey,
  encryptSessionPayload,
} from "../session-aes.js";
import type { DevicePublicKeys, EncryptedMessage, SecureSession, SignalClient } from "../signal-stub.js";

type KeyMod = typeof import("@open-e2ee/signal-protocol-sdk/keys");

type OeIdentity = {
  dhKey: { publicKey: string; privateKey: string };
  signingKey: { publicKey: string; privateKey: string };
  registrationId: number;
};

type OeSigned = {
  keyId: number;
  publicKey: string;
  privateKey: string;
  signature: string;
};

type OeOneTime = { keyId: number; publicKey: string; privateKey: string };

type OeKyber = {
  keyId: number;
  publicKey: string;
  privateKey: string;
  signature: string;
};

type PrivateBundle = {
  v: 1;
  backend: "opene2ee";
  identity: OeIdentity;
  signedPrekey: OeSigned;
  oneTimePrekey: OeOneTime;
  kyber: OeKyber;
};

/** Prekey metadata carried on the initiator's first ciphertext header. */
type PqxdhPrekeyWire = {
  ephemeralPub: string;
  usedSignedPreKeyId: number;
  usedOneTimePreKeyId?: number;
  usedKyberPreKeyId?: number;
  kyberCiphertext?: string;
  usedKemOneTimePreKeyId?: number;
  kemOneTimePreKeyCiphertext?: string;
  senderRegistrationId: number;
  senderIdentityEcdh: string;
  senderIdentitySigning: string;
};

type SessionBlob = {
  usedOpenE2ee: true;
  usedPQXDH?: boolean;
  role: "initiator" | "responder" | "mutual_ecdh";
  /** Base64 shared secret material for PBKDF2 (set after agreement). */
  sharedMaterial?: string;
  /** Initiator: attach on first encrypt. */
  pendingPrekey?: PqxdhPrekeyWire;
  /** Responder: private state until first decrypt completes PQXDH. */
  localPrivate?: string;
};

type OeWireHeader = {
  v: 1;
  backend: "opene2ee";
  usedPQXDH?: boolean;
  iv: string;
  prekey?: PqxdhPrekeyWire;
};

type CryptoMod = {
  computeSharedSecret: (privB64: string, pubB64: string) => Promise<Uint8Array>;
};

type HandshakeMod = {
  performKeyAgreement: (
    identity: unknown,
    bundle: unknown,
    options?: { remoteAddress?: string },
  ) => Promise<{
    usedPQXDH: boolean;
    sharedSecret?: ArrayBuffer | Uint8Array;
    ephemeralKeyPair: { publicKey: string; privateKey: string };
    usedSignedPreKeyId: number;
    usedOneTimePreKeyId?: number;
    usedKyberPreKeyId?: number;
    kyberCiphertext?: string;
    usedKemOneTimePreKeyId?: number;
    kemOneTimePreKeyCiphertext?: string;
  }>;
  performResponderKeyAgreement: (
    identity: unknown,
    signedPreKey: unknown,
    oneTimePreKey: unknown,
    kyberPreKey: unknown,
    kemOneTimePreKey: unknown,
    prekeyMessage: unknown,
    aliceIdentityKey: unknown,
    aliceEphemeralKey: unknown,
    options?: { remoteAddress?: string },
  ) => Promise<{
    usedPQXDH: boolean;
    sharedSecret?: ArrayBuffer | Uint8Array;
  }>;
};

function b64(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of u8) s += String.fromCharCode(b);
  return btoa(s);
}

function encodeJson(value: unknown): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(value))));
}

function decodeJson<T>(raw: string): T {
  return JSON.parse(decodeURIComponent(escape(atob(raw)))) as T;
}

function secretBytes(secret: ArrayBuffer | Uint8Array | undefined): Uint8Array {
  if (secret == null) return new Uint8Array();
  if (secret instanceof ArrayBuffer) return new Uint8Array(secret);
  return secret;
}

async function loadOeModule(relPath: string): Promise<unknown> {
  const nodeModule = ["node", "module"].join(":");
  const nodePath = ["node", "path"].join(":");
  const nodeUrl = ["node", "url"].join(":");
  const { createRequire } = (await import(/* @vite-ignore */ nodeModule)) as {
    createRequire: (url: string | URL) => { resolve: (id: string) => string };
  };
  const { dirname } = (await import(/* @vite-ignore */ nodePath)) as {
    dirname: (p: string) => string;
  };
  const { pathToFileURL } = (await import(/* @vite-ignore */ nodeUrl)) as {
    pathToFileURL: (p: string) => { href: string };
  };
  const require = createRequire(import.meta.url);
  const root = dirname(require.resolve("@open-e2ee/signal-protocol-sdk/package.json"));
  return import(pathToFileURL(`${root}/dist/${relPath}`).href);
}

async function loadOeCrypto(): Promise<CryptoMod> {
  return (await loadOeModule("internal/crypto/ec/index.js")) as CryptoMod;
}

async function loadHandshake(): Promise<HandshakeMod> {
  return (await loadOeModule("internal/session/handshake.js")) as HandshakeMod;
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
  return {
    identityKeyPub: JSON.stringify({
      curve: "opene2ee",
      ecdh: priv.identity.dhKey.publicKey,
      signing: priv.identity.signingKey.publicKey,
      package: "@open-e2ee/signal-protocol-sdk",
    }),
    signedPrekeyPub: priv.signedPrekey.publicKey,
    signedPrekeySig: priv.signedPrekey.signature,
    signedPrekeyId: priv.signedPrekey.keyId,
    oneTimePrekeyPub: priv.oneTimePrekey.publicKey,
    oneTimePrekeyId: priv.oneTimePrekey.keyId,
    kyberPrekeyPub: priv.kyber.publicKey,
    kyberPrekeySig: priv.kyber.signature,
    kyberPrekeyId: priv.kyber.keyId,
    registrationId: priv.identity.registrationId,
  };
}

function parseIdentityPub(identityKeyPub: string): { ecdh: string; signing: string } {
  const parsed = JSON.parse(identityKeyPub) as {
    curve?: string;
    ecdh?: string;
    signing?: string;
  };
  if (parsed.curve !== "opene2ee" || !parsed.ecdh || !parsed.signing) {
    throw new Error("invalid_opene2ee_identity_pub");
  }
  return { ecdh: parsed.ecdh, signing: parsed.signing };
}

function remoteHasKyber(remote: DevicePublicKeys): boolean {
  return Boolean(remote.kyberPrekeyPub && remote.kyberPrekeySig && remote.kyberPrekeyId != null);
}

function buildRemotePrekeyBundle(remote: DevicePublicKeys) {
  const remoteId = parseIdentityPub(remote.identityKeyPub);
  return {
    registrationId: remote.registrationId ?? 0,
    deviceId: 1,
    identity: {
      version: 1 as const,
      x25519PublicKey: remoteId.ecdh,
      ed25519PublicKey: remoteId.signing,
    },
    ecSignedPreKey: {
      keyId: remote.signedPrekeyId,
      publicKey: remote.signedPrekeyPub,
      signature: remote.signedPrekeySig,
    },
    ecOneTimePreKey: remote.oneTimePrekeyPub
      ? {
          keyId: remote.oneTimePrekeyId ?? 0,
          publicKey: remote.oneTimePrekeyPub,
        }
      : undefined,
    kemLastResortPreKey: remoteHasKyber(remote)
      ? {
          keyId: remote.kyberPrekeyId!,
          publicKey: remote.kyberPrekeyPub!,
          signature: remote.kyberPrekeySig!,
        }
      : undefined,
  };
}

async function mutualSharedMaterial(
  cryptoMod: CryptoMod,
  keys: KeyMod,
  local: PrivateBundle,
  remote: DevicePublicKeys,
): Promise<string> {
  const remoteId = parseIdentityPub(remote.identityKeyPub);
  const composite = {
    version: 1 as const,
    x25519PublicKey: remoteId.ecdh,
    ed25519PublicKey: remoteId.signing,
  };
  const pubBytes = Uint8Array.from(atob(remote.signedPrekeyPub), (c) => c.charCodeAt(0));
  const keysExt = keys as KeyMod & {
    verifyPreKeySignature?: (
      identity: unknown,
      algorithmTag: number | string,
      keyId: number,
      serializedPublicKey: Uint8Array,
      signature: string,
    ) => Promise<boolean>;
    PREKEY_ALGORITHM_X25519?: number | string;
  };
  if (keysExt.verifyPreKeySignature) {
    const ok = await keysExt.verifyPreKeySignature(
      composite,
      keysExt.PREKEY_ALGORITHM_X25519 ?? 1,
      remote.signedPrekeyId,
      pubBytes,
      remote.signedPrekeySig,
    );
    if (!ok) throw new Error("opene2ee_signed_prekey_invalid");
  }

  const localIkPub = local.identity.dhKey.publicKey;
  const remoteIkPub = remoteId.ecdh;
  const ordered = localIkPub < remoteIkPub;

  const dhIk = await cryptoMod.computeSharedSecret(local.identity.dhKey.privateKey, remoteIkPub);
  const dhLocalIkRemoteSpk = await cryptoMod.computeSharedSecret(
    local.identity.dhKey.privateKey,
    remote.signedPrekeyPub,
  );
  const dhLocalSpkRemoteIk = await cryptoMod.computeSharedSecret(
    local.signedPrekey.privateKey,
    remoteIkPub,
  );

  const mid = ordered
    ? [dhLocalIkRemoteSpk, dhLocalSpkRemoteIk]
    : [dhLocalSpkRemoteIk, dhLocalIkRemoteSpk];
  return b64(concatBytes(dhIk, ...mid));
}

function parseWireHeader(ratchetHeader: string): OeWireHeader | { ivOnly: string } {
  try {
    const parsed = decodeJson<OeWireHeader>(ratchetHeader);
    if (parsed?.v === 1 && parsed.backend === "opene2ee" && typeof parsed.iv === "string") {
      return parsed;
    }
  } catch {
    /* legacy IV-only header */
  }
  return { ivOnly: ratchetHeader };
}

export class OpenE2eeSignalClient implements SignalClient {
  async generateIdentity() {
    const keys = (await import("@open-e2ee/signal-protocol-sdk/keys")) as KeyMod;
    const identityRaw = await keys.generateIdentityKeyPair();
    const identity = identityRaw as unknown as OeIdentity;
    const signedPrekey = (await keys.generateEcSignedPreKey(
      identityRaw,
    )) as unknown as OeSigned;
    const oneTimePrekey = (await keys.generateEcOneTimePreKeys(1))[0]! as unknown as OeOneTime;
    const kyber = (await keys.generateKyberLastResortPreKey(
      identityRaw,
    )) as unknown as OeKyber;
    const priv: PrivateBundle = {
      v: 1,
      backend: "opene2ee",
      identity,
      signedPrekey,
      oneTimePrekey,
      kyber,
    };
    return {
      publicBundle: pubKeysFromPrivate(priv),
      privateState: encodeJson(priv),
    };
  }

  async establishSession(localPrivate: string, remote: DevicePublicKeys): Promise<SecureSession> {
    const priv = decodeJson<PrivateBundle>(localPrivate);
    if (priv.backend !== "opene2ee") throw new Error("opene2ee_private_state_mismatch");

    const localIk = priv.identity.dhKey.publicKey;
    const remoteIk = parseIdentityPub(remote.identityKeyPub).ecdh;
    const isInitiator = localIk < remoteIk;
    const canPqxdh = remoteHasKyber(remote) && Boolean(priv.kyber?.publicKey);

    if (canPqxdh && isInitiator) {
      const { performKeyAgreement } = await loadHandshake();
      const bundle = buildRemotePrekeyBundle(remote);
      const init = await performKeyAgreement(priv.identity, bundle, {
        remoteAddress: `reg-${remote.registrationId ?? 0}:1`,
      });
      const secret = secretBytes(init.sharedSecret);
      if (!init.usedPQXDH || secret.byteLength < 32) {
        throw new Error("opene2ee_pqxdh_initiator_incomplete");
      }
      const pendingPrekey: PqxdhPrekeyWire = {
        ephemeralPub: init.ephemeralKeyPair.publicKey,
        usedSignedPreKeyId: init.usedSignedPreKeyId,
        usedOneTimePreKeyId: init.usedOneTimePreKeyId,
        usedKyberPreKeyId: init.usedKyberPreKeyId,
        kyberCiphertext: init.kyberCiphertext,
        usedKemOneTimePreKeyId: init.usedKemOneTimePreKeyId,
        kemOneTimePreKeyCiphertext: init.kemOneTimePreKeyCiphertext,
        senderRegistrationId: priv.identity.registrationId,
        senderIdentityEcdh: priv.identity.dhKey.publicKey,
        senderIdentitySigning: priv.identity.signingKey.publicKey,
      };
      const blob: SessionBlob = {
        usedOpenE2ee: true,
        usedPQXDH: true,
        role: "initiator",
        sharedMaterial: b64(secret),
        pendingPrekey,
      };
      return {
        remoteUserId: `reg-${remote.registrationId ?? 0}`,
        remoteDeviceId: String(remote.registrationId ?? "remote"),
        stateBlob: encodeJson(blob),
      };
    }

    if (canPqxdh && !isInitiator) {
      const blob: SessionBlob = {
        usedOpenE2ee: true,
        usedPQXDH: true,
        role: "responder",
        localPrivate,
      };
      return {
        remoteUserId: `reg-${remote.registrationId ?? 0}`,
        remoteDeviceId: String(remote.registrationId ?? "remote"),
        stateBlob: encodeJson(blob),
      };
    }

    // Classical mutual ECDH fallback (no Kyber on peer / local).
    const keys = (await import("@open-e2ee/signal-protocol-sdk/keys")) as KeyMod;
    const cryptoMod = await loadOeCrypto();
    const sharedMaterial = await mutualSharedMaterial(cryptoMod, keys, priv, remote);
    const blob: SessionBlob = {
      usedOpenE2ee: true,
      usedPQXDH: false,
      role: "mutual_ecdh",
      sharedMaterial,
    };
    return {
      remoteUserId: `reg-${remote.registrationId ?? 0}`,
      remoteDeviceId: String(remote.registrationId ?? "remote"),
      stateBlob: encodeJson(blob),
    };
  }

  async encrypt(session: SecureSession, plaintext: string, expiresAt?: number): Promise<EncryptedMessage> {
    const blob = decodeJson<SessionBlob>(session.stateBlob);
    if (!blob.sharedMaterial) {
      throw new Error("opene2ee_session_not_ready");
    }
    const key = await deriveSessionKey(blob.sharedMaterial);
    const { ratchetHeader: iv, ciphertext } = await encryptSessionPayload(
      key,
      plaintext,
      "opene2ee",
    );
    const header: OeWireHeader = {
      v: 1,
      backend: "opene2ee",
      usedPQXDH: Boolean(blob.usedPQXDH),
      iv,
      prekey: blob.pendingPrekey,
    };
    if (blob.pendingPrekey) {
      delete blob.pendingPrekey;
      session.stateBlob = encodeJson(blob);
    }
    return {
      ratchetHeader: encodeJson(header),
      ciphertext,
      contentType: "msg",
      expiresAt,
    };
  }

  async decrypt(session: SecureSession, message: EncryptedMessage): Promise<string> {
    let blob = decodeJson<SessionBlob>(session.stateBlob);
    const wire = parseWireHeader(message.ratchetHeader);

    if ("ivOnly" in wire) {
      if (!blob.sharedMaterial) throw new Error("opene2ee_session_not_ready");
      const key = await deriveSessionKey(blob.sharedMaterial);
      return decryptSessionPayload(key, wire.ivOnly, message.ciphertext, "opene2ee");
    }

    if (!blob.sharedMaterial && blob.role === "responder" && wire.prekey && blob.localPrivate) {
      blob = await this.completeResponderPqxdh(blob, wire.prekey);
      session.stateBlob = encodeJson(blob);
    }

    if (!blob.sharedMaterial) throw new Error("opene2ee_session_not_ready");
    const key = await deriveSessionKey(blob.sharedMaterial);
    return decryptSessionPayload(key, wire.iv, message.ciphertext, "opene2ee");
  }

  private async completeResponderPqxdh(
    blob: SessionBlob,
    prekey: PqxdhPrekeyWire,
  ): Promise<SessionBlob> {
    if (!blob.localPrivate) throw new Error("opene2ee_responder_private_missing");
    const priv = decodeJson<PrivateBundle>(blob.localPrivate);
    const { performResponderKeyAgreement } = await loadHandshake();

    const aliceIdentity = {
      version: 1 as const,
      x25519PublicKey: prekey.senderIdentityEcdh,
      ed25519PublicKey: prekey.senderIdentitySigning,
    };

    const prekeyMessage = {
      type: "prekey",
      messageVersion: "v1",
      ratchetKey: prekey.ephemeralPub,
      counter: 0,
      previousCounter: 0,
      ciphertext: "AA==",
      mac: "AAAAAAAA",
      senderId: `reg-${prekey.senderRegistrationId}`,
      senderDeviceId: 1,
      senderIdentity: aliceIdentity,
      senderEphemeralKey: prekey.ephemeralPub,
      senderRegistrationId: prekey.senderRegistrationId,
      recipientIdentityType: "aci",
      usedSignedPreKeyId: prekey.usedSignedPreKeyId,
      usedOneTimePreKeyId: prekey.usedOneTimePreKeyId,
      usedKyberPreKeyId: prekey.usedKyberPreKeyId,
      kyberCiphertext: prekey.kyberCiphertext,
      usedKemOneTimePreKeyId: prekey.usedKemOneTimePreKeyId,
      kemOneTimePreKeyCiphertext: prekey.kemOneTimePreKeyCiphertext,
    };

    const resp = await performResponderKeyAgreement(
      priv.identity,
      priv.signedPrekey,
      priv.oneTimePrekey,
      priv.kyber,
      null,
      prekeyMessage,
      prekey.senderIdentityEcdh,
      prekey.ephemeralPub,
      { remoteAddress: `reg-${prekey.senderRegistrationId}:1` },
    );
    const secret = secretBytes(resp.sharedSecret);
    if (!resp.usedPQXDH || secret.byteLength < 32) {
      throw new Error("opene2ee_pqxdh_responder_incomplete");
    }
    return {
      usedOpenE2ee: true,
      usedPQXDH: true,
      role: "responder",
      sharedMaterial: b64(secret),
    };
  }
}
