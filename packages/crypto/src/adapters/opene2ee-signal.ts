/**
 * OpenE2EE-backed SignalClient for Workers/browser (MIT/Apache).
 *
 * Uses `@open-e2ee/signal-protocol-sdk` key material (incl. Kyber in the public
 * bundle) and mutual X25519 ECDH via OpenE2EE internals + session AES-GCM.
 * Not wire-compatible with Signal Messenger / official libsignal.
 *
 * Opt-in via `LOGOSHOME_SIGNAL_BACKEND=opene2ee` or
 * `createProductSignalClient("opene2ee")`. Product default remains x25519 on
 * Workers until LogosHome explicitly adopts OpenE2EE (or official WASM lands).
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

type SessionBlob = {
  sharedMaterial: string;
  usedOpenE2ee: true;
};

type CryptoMod = {
  computeSharedSecret: (privB64: string, pubB64: string) => Promise<Uint8Array>;
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

async function loadOeCrypto(): Promise<CryptoMod> {
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
  return import(pathToFileURL(`${root}/dist/internal/crypto/ec/index.js`).href);
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
  // verifyPreKeySignature is on the public keys export map.
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

export class OpenE2eeSignalClient implements SignalClient {
  async generateIdentity() {
    const keys = (await import("@open-e2ee/signal-protocol-sdk/keys")) as KeyMod;
    // OpenE2EE brands Base64 public/private keys; we store them as plain strings.
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
    const keys = (await import("@open-e2ee/signal-protocol-sdk/keys")) as KeyMod;
    const cryptoMod = await loadOeCrypto();
    const sharedMaterial = await mutualSharedMaterial(cryptoMod, keys, priv, remote);
    const blob: SessionBlob = { sharedMaterial, usedOpenE2ee: true };
    return {
      remoteUserId: `reg-${remote.registrationId ?? 0}`,
      remoteDeviceId: String(remote.registrationId ?? "remote"),
      stateBlob: encodeJson(blob),
    };
  }

  async encrypt(session: SecureSession, plaintext: string, expiresAt?: number): Promise<EncryptedMessage> {
    const blob = decodeJson<SessionBlob>(session.stateBlob);
    const key = await deriveSessionKey(blob.sharedMaterial);
    const { ratchetHeader, ciphertext } = await encryptSessionPayload(key, plaintext, "opene2ee");
    return { ratchetHeader, ciphertext, contentType: "msg", expiresAt };
  }

  async decrypt(session: SecureSession, message: EncryptedMessage): Promise<string> {
    const blob = decodeJson<SessionBlob>(session.stateBlob);
    const key = await deriveSessionKey(blob.sharedMaterial);
    return decryptSessionPayload(key, message.ratchetHeader, message.ciphertext, "opene2ee");
  }
}
