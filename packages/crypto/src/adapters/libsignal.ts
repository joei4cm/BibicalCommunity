/**
 * Production Curve25519 / libsignal adapter seam.
 *
 * WebCryptoSignalClient (P-256) ships for Workers/browser portability.
 * Swap this module in when you can load `@signalapp/libsignal-client` (or a
 * WASM build) on the target platform. Keep server as ciphertext courier only.
 */

import type { DevicePublicKeys, EncryptedMessage, SecureSession, SignalClient } from "../signal-stub.js";
import { WebCryptoSignalClient } from "../webcrypto-signal.js";

export class LibsignalNotConfiguredError extends Error {
  constructor() {
    super(
      "libsignal adapter not configured — use WebCryptoSignalClient until Curve25519/libsignal is provisioned",
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

/** Factory used by apps to pick the active client. */
export function createSignalClient(prefer: "webcrypto" | "libsignal" = "webcrypto"): SignalClient {
  if (prefer === "libsignal") return new LibsignalSignalClient();
  return new WebCryptoSignalClient();
}
