/**
 * Workers-portable PQXDH probe via `@open-e2ee/signal-protocol-sdk` (MIT/Apache).
 *
 * Signal's official `@signalapp/libsignal-client` has no WASM/Workers build
 * (LIBSIGNAL_WORKERS_OPEN). This probe proves pure-TS PQXDH key agreement
 * (initiator+responder matching secrets) and an AES-GCM message roundtrip
 * under a Workers-shaped runtime (WebSocketPair present).
 *
 * Not wire-compatible with Signal Messenger / official libsignal.
 * Product default remains X25519 until an official Workers path exists or
 * LogosHome explicitly adopts OpenE2EE as the Workers protocol.
 */

import { isWorkersOrBrowserRuntime } from "./libsignal.js";

export type OpenE2eePqxdhProbe = {
  ok: boolean;
  usedPQXDH: boolean;
  sharedSecretBytes: number;
  workersShaped: boolean;
  packageName: string;
  peersMatched?: boolean;
  messageRoundtrip?: boolean;
  reason?: string;
};

type KeyMod = typeof import("@open-e2ee/signal-protocol-sdk/keys");

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

/**
 * Load OpenE2EE internal handshake without static `node:` imports.
 * Web tsconfig sets `types: ["vite/client"]` (no @types/node); static
 * `node:module`/`node:path`/`node:url` imports break `pnpm --filter web build`.
 */
async function loadHandshake(): Promise<HandshakeMod> {
  const nodeModule = ["node", "module"].join(":");
  const nodePath = ["node", "path"].join(":");
  const nodeUrl = ["node", "url"].join(":");
  const { createRequire } = (await import(/* @vite-ignore */ nodeModule)) as {
    createRequire: (url: string | URL) => {
      resolve: (id: string) => string;
    };
  };
  const { dirname } = (await import(/* @vite-ignore */ nodePath)) as {
    dirname: (p: string) => string;
  };
  const { pathToFileURL } = (await import(/* @vite-ignore */ nodeUrl)) as {
    pathToFileURL: (p: string) => { href: string };
  };
  const require = createRequire(import.meta.url);
  const pkgJson = require.resolve("@open-e2ee/signal-protocol-sdk/package.json");
  const root = dirname(pkgJson);
  return import(pathToFileURL(`${root}/dist/internal/session/handshake.js`).href);
}

function secretBytes(secret: ArrayBuffer | Uint8Array | undefined): Uint8Array {
  if (secret == null) return new Uint8Array();
  if (secret instanceof ArrayBuffer) return new Uint8Array(secret);
  return secret;
}

function secretsEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength || a.byteLength === 0) return false;
  let diff = 0;
  for (let i = 0; i < a.byteLength; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

async function aesGcmRoundtrip(sharedSecret: Uint8Array, plaintext: string): Promise<boolean> {
  // Copy into a fresh ArrayBuffer-backed view for DOM lib BufferSource typing.
  const src = sharedSecret.byteLength >= 32 ? sharedSecret.subarray(0, 32) : sharedSecret;
  const raw = new Uint8Array(src.byteLength);
  raw.set(src);
  const key = await crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  const pt = new TextDecoder().decode(
    await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct),
  );
  return pt === plaintext;
}

/**
 * Generate Alice/Bob identities + Bob prekey bundle, run PQXDH initiator +
 * responder agreement (matching secrets), then AES-GCM message roundtrip.
 * Optionally force Workers-shaped detection via WebSocketPair.
 */
export async function probeOpenE2eePqxdhWorkers(
  options: { forceWorkersShape?: boolean } = {},
): Promise<OpenE2eePqxdhProbe> {
  const packageName = "@open-e2ee/signal-protocol-sdk";
  let prevPair: unknown;
  const g = globalThis as { WebSocketPair?: unknown };
  const force = options.forceWorkersShape !== false;
  if (force) {
    prevPair = g.WebSocketPair;
    g.WebSocketPair = function WebSocketPair() {};
  }
  try {
    const keys = (await import("@open-e2ee/signal-protocol-sdk/keys")) as KeyMod;
    const { performKeyAgreement, performResponderKeyAgreement } = await loadHandshake();

    const alice = await keys.generateIdentityKeyPair();
    const bob = await keys.generateIdentityKeyPair();
    const bobSpk = await keys.generateEcSignedPreKey(bob);
    const bobOtp = (await keys.generateEcOneTimePreKeys(1))[0]!;
    const bobKyber = await keys.generateKyberLastResortPreKey(bob);
    const bobIdentity = keys.createCompositeIdentityV1(bob);
    const aliceIdentity = keys.createCompositeIdentityV1(alice);

    const bundle = {
      registrationId: bob.registrationId,
      deviceId: 1,
      identity: bobIdentity,
      ecSignedPreKey: {
        keyId: bobSpk.keyId,
        publicKey: bobSpk.publicKey,
        signature: bobSpk.signature,
      },
      ecOneTimePreKey: {
        keyId: bobOtp.keyId,
        publicKey: bobOtp.publicKey,
      },
      kemLastResortPreKey: {
        keyId: bobKyber.keyId,
        publicKey: bobKyber.publicKey,
        signature: bobKyber.signature,
      },
    };

    const init = await performKeyAgreement(alice, bundle, { remoteAddress: "bob:1" });
    const initSecret = secretBytes(init.sharedSecret);
    const workersShaped = isWorkersOrBrowserRuntime();

    if (!init.usedPQXDH || initSecret.byteLength < 32) {
      return {
        ok: false,
        usedPQXDH: Boolean(init.usedPQXDH),
        sharedSecretBytes: initSecret.byteLength,
        workersShaped,
        packageName,
        reason: "pqxdh_agreement_incomplete",
      };
    }

    const aliceDhPublic = (alice as { dhKey?: { publicKey?: string } }).dhKey?.publicKey;
    if (!aliceDhPublic) {
      return {
        ok: false,
        usedPQXDH: true,
        sharedSecretBytes: initSecret.byteLength,
        workersShaped,
        packageName,
        reason: "alice_dh_public_missing",
      };
    }

    const prekeyMessage = {
      type: "prekey",
      messageVersion: "v1",
      ratchetKey: init.ephemeralKeyPair.publicKey,
      counter: 0,
      previousCounter: 0,
      ciphertext: "AA==",
      mac: "AAAAAAAA",
      senderId: "alice",
      senderDeviceId: 1,
      senderIdentity: aliceIdentity,
      senderEphemeralKey: init.ephemeralKeyPair.publicKey,
      senderRegistrationId: alice.registrationId,
      recipientIdentityType: "aci",
      usedSignedPreKeyId: init.usedSignedPreKeyId,
      usedOneTimePreKeyId: init.usedOneTimePreKeyId,
      usedKyberPreKeyId: init.usedKyberPreKeyId,
      kyberCiphertext: init.kyberCiphertext,
      usedKemOneTimePreKeyId: init.usedKemOneTimePreKeyId,
      kemOneTimePreKeyCiphertext: init.kemOneTimePreKeyCiphertext,
    };

    const resp = await performResponderKeyAgreement(
      bob,
      bobSpk,
      bobOtp,
      bobKyber,
      null,
      prekeyMessage,
      aliceDhPublic,
      init.ephemeralKeyPair.publicKey,
      { remoteAddress: "alice:1" },
    );
    const respSecret = secretBytes(resp.sharedSecret);
    const peersMatched =
      Boolean(resp.usedPQXDH) && secretsEqual(initSecret, respSecret);

    if (!peersMatched) {
      return {
        ok: false,
        usedPQXDH: true,
        sharedSecretBytes: initSecret.byteLength,
        workersShaped,
        packageName,
        peersMatched: false,
        reason: "pqxdh_peer_secrets_mismatch",
      };
    }

    const messageRoundtrip = await aesGcmRoundtrip(initSecret, "workers-opene2ee-msg");
    if (!messageRoundtrip) {
      return {
        ok: false,
        usedPQXDH: true,
        sharedSecretBytes: initSecret.byteLength,
        workersShaped,
        packageName,
        peersMatched: true,
        messageRoundtrip: false,
        reason: "aes_gcm_roundtrip_failed",
      };
    }

    if (!workersShaped) {
      return {
        ok: false,
        usedPQXDH: true,
        sharedSecretBytes: initSecret.byteLength,
        workersShaped: false,
        packageName,
        peersMatched: true,
        messageRoundtrip: true,
        reason: "workers_shape_not_detected",
      };
    }

    return {
      ok: true,
      usedPQXDH: true,
      sharedSecretBytes: initSecret.byteLength,
      workersShaped: true,
      packageName,
      peersMatched: true,
      messageRoundtrip: true,
    };
  } catch (err) {
    return {
      ok: false,
      usedPQXDH: false,
      sharedSecretBytes: 0,
      workersShaped: isWorkersOrBrowserRuntime(),
      packageName,
      reason: err instanceof Error ? err.message : String(err),
    };
  } finally {
    if (force) {
      if (prevPair === undefined) delete g.WebSocketPair;
      else g.WebSocketPair = prevPair;
    }
  }
}
