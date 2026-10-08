/**
 * Workers-portable PQXDH probe via `@open-e2ee/signal-protocol-sdk` (MIT/Apache).
 *
 * Signal's official `@signalapp/libsignal-client` has no WASM/Workers build
 * (LIBSIGNAL_WORKERS_OPEN). This probe proves a pure-TS PQXDH key agreement
 * runs in a Workers-shaped runtime (WebSocketPair present) using OpenE2EE keys.
 *
 * Not wire-compatible with Signal Messenger / official libsignal.
 * Product default remains X25519 until an official Workers path exists or
 * LogosHome explicitly adopts OpenE2EE as the Workers protocol.
 */

import { createRequire } from "node:module";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { isWorkersOrBrowserRuntime } from "./libsignal.js";

export type OpenE2eePqxdhProbe = {
  ok: boolean;
  usedPQXDH: boolean;
  sharedSecretBytes: number;
  workersShaped: boolean;
  packageName: string;
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
  }>;
};

async function loadHandshake(): Promise<HandshakeMod> {
  const require = createRequire(import.meta.url);
  const pkgJson = require.resolve("@open-e2ee/signal-protocol-sdk/package.json");
  const root = dirname(pkgJson);
  // Handshake is not on the package public exports map; resolve by file for the probe.
  return import(pathToFileURL(`${root}/dist/internal/session/handshake.js`).href);
}

/**
 * Generate Alice/Bob identities + Bob prekey bundle, run PQXDH initiator
 * agreement. Optionally force Workers-shaped detection via WebSocketPair.
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
    const { performKeyAgreement } = await loadHandshake();

    const alice = await keys.generateIdentityKeyPair();
    const bob = await keys.generateIdentityKeyPair();
    const bobSpk = await keys.generateEcSignedPreKey(bob);
    const bobOtp = (await keys.generateEcOneTimePreKeys(1))[0]!;
    const bobKyber = await keys.generateKyberLastResortPreKey(bob);
    const bobIdentity = keys.createCompositeIdentityV1(bob);

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

    const result = await performKeyAgreement(alice, bundle, { remoteAddress: "bob:1" });
    const secret = result.sharedSecret;
    const secretLen =
      secret == null
        ? 0
        : secret instanceof ArrayBuffer
          ? secret.byteLength
          : (secret as Uint8Array).byteLength;

    const workersShaped = isWorkersOrBrowserRuntime();
    if (!result.usedPQXDH || secretLen < 32) {
      return {
        ok: false,
        usedPQXDH: Boolean(result.usedPQXDH),
        sharedSecretBytes: secretLen,
        workersShaped,
        packageName,
        reason: "pqxdh_agreement_incomplete",
      };
    }
    if (!workersShaped) {
      return {
        ok: false,
        usedPQXDH: true,
        sharedSecretBytes: secretLen,
        workersShaped: false,
        packageName,
        reason: "workers_shape_not_detected",
      };
    }
    return {
      ok: true,
      usedPQXDH: true,
      sharedSecretBytes: secretLen,
      workersShaped: true,
      packageName,
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
