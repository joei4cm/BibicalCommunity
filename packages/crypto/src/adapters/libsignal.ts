/**
 * Production Curve25519 / libsignal adapter seam.
 *
 * WebCryptoSignalClient (P-256) and X25519SignalClient ship for Workers/browser
 * portability. When `@signalapp/libsignal-client` native bindings load (Node),
 * `createSignalClient("libsignal")` returns a real PQXDH client. Otherwise the
 * adapter stays fail-closed.
 */

import type { DevicePublicKeys, EncryptedMessage, SecureSession, SignalClient } from "../signal-stub.js";
import { WebCryptoSignalClient } from "../webcrypto-signal.js";
import { X25519SignalClient } from "../x25519-signal.js";
import {
  NativeLibsignalSignalClient,
  tryCreateNativeLibsignalClient,
} from "./libsignal-native.js";

export { NativeLibsignalSignalClient, tryCreateNativeLibsignalClient };

export class LibsignalNotConfiguredError extends Error {
  constructor() {
    super(
      "libsignal adapter not configured — use WebCryptoSignalClient or X25519SignalClient until @signalapp/libsignal-client is provisioned",
    );
    this.name = "LibsignalNotConfiguredError";
  }
}

/** Drop-in SignalClient that fails closed until real libsignal is wired. */
export class LibsignalSignalClient implements SignalClient {
  async generateIdentity(): Promise<{ publicBundle: DevicePublicKeys; privateState: string }> {
    throw new LibsignalNotConfiguredError();
  }

  async establishSession(_localPrivate: string, _remote: DevicePublicKeys): Promise<SecureSession> {
    throw new LibsignalNotConfiguredError();
  }

  async encrypt(
    _session: SecureSession,
    _plaintext: string,
    _expiresAt?: number,
  ): Promise<EncryptedMessage> {
    throw new LibsignalNotConfiguredError();
  }

  async decrypt(_session: SecureSession, _message: EncryptedMessage): Promise<string> {
    throw new LibsignalNotConfiguredError();
  }
}

export type SignalBackend = "webcrypto" | "libsignal" | "x25519";

/**
 * Resolve backend from explicit prefer, else `LOGOSHOME_SIGNAL_BACKEND`
 * (`webcrypto` | `libsignal` | `x25519`) on `globalThis` or Node `process.env`.
 * Defaults to webcrypto (portable P-256). `x25519` selects Curve25519 WebCrypto path.
 */
export function resolveSignalBackend(prefer?: SignalBackend): SignalBackend {
  if (prefer) return prefer;
  const g = globalThis as {
    LOGOSHOME_SIGNAL_BACKEND?: string;
    process?: { env?: Record<string, string | undefined> };
  };
  const env = g.LOGOSHOME_SIGNAL_BACKEND ?? g.process?.env?.LOGOSHOME_SIGNAL_BACKEND ?? "";
  if (env === "libsignal") return "libsignal";
  if (env === "x25519") return "x25519";
  return "webcrypto";
}

let nativeClientPromise: Promise<SignalClient | null> | null = null;

function loadNativeLibsignal(): Promise<SignalClient | null> {
  if (!nativeClientPromise) nativeClientPromise = tryCreateNativeLibsignalClient();
  return nativeClientPromise;
}

/**
 * Factory used by apps to pick the active client.
 * For `libsignal`, prefers the native package when bindings load; otherwise
 * returns the fail-closed stub (callers may await `createSignalClientAsync`).
 */
export function createSignalClient(prefer?: SignalBackend): SignalClient {
  const backend = resolveSignalBackend(prefer);
  if (backend === "libsignal") return new LibsignalSignalClient();
  if (backend === "x25519") return new X25519SignalClient();
  return new WebCryptoSignalClient();
}

/** Async factory — resolves native libsignal when available. */
export async function createSignalClientAsync(prefer?: SignalBackend): Promise<SignalClient> {
  const backend = resolveSignalBackend(prefer);
  if (backend === "libsignal") {
    const native = await loadNativeLibsignal();
    return native ?? new LibsignalSignalClient();
  }
  if (backend === "x25519") return new X25519SignalClient();
  return new WebCryptoSignalClient();
}

export type LibsignalPackageProbe = {
  available: boolean;
  packageName: string;
  reason?: string;
  nativeRoundtrip?: boolean;
};

/**
 * Probe whether `@signalapp/libsignal-client` can be loaded and (optionally)
 * perform a native encrypt/decrypt roundtrip.
 */
export async function probeLibsignalPackage(
  packageName = "@signalapp/libsignal-client",
): Promise<LibsignalPackageProbe> {
  try {
    await import(/* @vite-ignore */ /* webpackIgnore: true */ packageName);
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    return { available: false, packageName, reason };
  }

  const native = await loadNativeLibsignal();
  if (!native) {
    return {
      available: true,
      packageName,
      reason: "package resolved but native client failed to initialize",
      nativeRoundtrip: false,
    };
  }

  try {
    const a = await native.generateIdentity();
    const b = await native.generateIdentity();
    const aPriv = JSON.parse(a.privateState) as { userId: string; deviceId: number };
    const bPriv = JSON.parse(b.privateState) as { userId: string; deviceId: number };
    const session = await native.establishSession(a.privateState, b.publicBundle);
    const responder: SecureSession = {
      remoteUserId: aPriv.userId,
      remoteDeviceId: String(aPriv.deviceId),
      stateBlob: JSON.stringify({
        v: 1,
        local: bPriv,
        remoteUserId: aPriv.userId,
        remoteDeviceId: aPriv.deviceId,
        role: "responder",
        remoteIdentityPub: a.publicBundle.identityKeyPub,
      }),
    };
    // Responder private blob must be full PrivateBlob from generateIdentity
    const responderBlob = JSON.parse(responder.stateBlob) as { local: unknown };
    responderBlob.local = JSON.parse(b.privateState);
    responder.stateBlob = JSON.stringify(responderBlob);

    const enc = await native.encrypt(session, "libsignal-probe");
    const plain = await native.decrypt(responder, enc);
    if (plain !== "libsignal-probe") throw new Error("roundtrip mismatch: " + plain);
    return { available: true, packageName, nativeRoundtrip: true };
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    return { available: true, packageName, reason, nativeRoundtrip: false };
  }
}
