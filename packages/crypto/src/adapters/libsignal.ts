/**
 * Production Curve25519 / libsignal adapter seam.
 *
 * WebCryptoSignalClient (P-256) ships for Workers/browser portability.
 * Swap this module in when you can load `@signalapp/libsignal-client` (or a
 * WASM build) on the target platform. Keep server as ciphertext courier only.
 */

import type { DevicePublicKeys, EncryptedMessage, SecureSession, SignalClient } from "../signal-stub.js";
import { WebCryptoSignalClient } from "../webcrypto-signal.js";
import { X25519SignalClient } from "../x25519-signal.js";

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

/** Factory used by apps to pick the active client. */
export function createSignalClient(prefer?: SignalBackend): SignalClient {
  const backend = resolveSignalBackend(prefer);
  if (backend === "libsignal") return new LibsignalSignalClient();
  if (backend === "x25519") return new X25519SignalClient();
  return new WebCryptoSignalClient();
}
