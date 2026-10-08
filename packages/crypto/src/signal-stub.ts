/**
 * Signal-protocol-shaped interfaces. Production will swap in libsignal / native
 * implementations; server remains a ciphertext courier only.
 */

export interface DevicePublicKeys {
  identityKeyPub: string;
  signedPrekeyPub: string;
  signedPrekeySig: string;
  signedPrekeyId: number;
  oneTimePrekeyPub?: string;
  oneTimePrekeyId?: number;
  /** PQXDH Kyber prekey (required for @signalapp/libsignal-client native path). */
  kyberPrekeyPub?: string;
  kyberPrekeySig?: string;
  kyberPrekeyId?: number;
  registrationId: number;
}

export interface EncryptedMessage {
  ratchetHeader: string;
  ciphertext: string;
  contentType: "msg" | "receipt" | "wipe" | "control";
  expiresAt?: number;
}

export interface SecureSession {
  remoteUserId: string;
  remoteDeviceId: string;
  /** Opaque ratchet state — never uploaded plaintext */
  stateBlob: string;
}

export interface SignalClient {
  generateIdentity(): Promise<{ publicBundle: DevicePublicKeys; privateState: string }>;
  encrypt(session: SecureSession, plaintext: string, expiresAt?: number): Promise<EncryptedMessage>;
  decrypt(session: SecureSession, message: EncryptedMessage): Promise<string>;
  establishSession(localPrivate: string, remote: DevicePublicKeys): Promise<SecureSession>;
}

/** Dev stub: NOT secure — base64 placeholder for wiring UI/API. */
export class DevSignalStub implements SignalClient {
  async generateIdentity() {
    const registrationId = Math.floor(Math.random() * 16380) + 1;
    return {
      publicBundle: {
        identityKeyPub: "dev-ik",
        signedPrekeyPub: "dev-spk",
        signedPrekeySig: "dev-sig",
        signedPrekeyId: 1,
        registrationId,
      },
      privateState: "dev-private-do-not-use-in-prod",
    };
  }

  async establishSession(localPrivate: string, remote: DevicePublicKeys): Promise<SecureSession> {
    return {
      remoteUserId: "unknown",
      remoteDeviceId: "unknown",
      stateBlob: `${localPrivate}:${remote.identityKeyPub}`,
    };
  }

  async encrypt(session: SecureSession, plaintext: string, expiresAt?: number): Promise<EncryptedMessage> {
    return {
      ratchetHeader: btoa(session.stateBlob.slice(0, 16)),
      ciphertext: btoa(unescape(encodeURIComponent(plaintext))),
      contentType: "msg",
      expiresAt,
    };
  }

  async decrypt(_session: SecureSession, message: EncryptedMessage): Promise<string> {
    return decodeURIComponent(escape(atob(message.ciphertext)));
  }
}
