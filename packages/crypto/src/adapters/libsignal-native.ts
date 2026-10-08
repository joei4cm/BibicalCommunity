/**
 * Production `@signalapp/libsignal-client` SignalClient (Node native bindings).
 *
 * Browser/Workers without the native addon continue to use X25519/WebCrypto
 * backends; this module is selected only when the package loads successfully.
 */

import type {
  DevicePublicKeys,
  EncryptedMessage,
  SecureSession,
  SignalClient,
} from "../signal-stub.js";

type Ls = typeof import("@signalapp/libsignal-client");

function b64(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]!);
  return btoa(s);
}
function fromB64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out as Uint8Array<ArrayBuffer>;
}

type PrivateBlob = {
  v: 1;
  userId: string;
  deviceId: number;
  registrationId: number;
  identity: string;
  signedPreKeyId: number;
  signedPreKey: string;
  signedPreKeySig: string;
  oneTimePreKeyId: number;
  oneTimePreKey: string;
  kyberPreKeyId: number;
  kyberPreKey: string;
  kyberPreKeySig: string;
};

type SessionBlob = {
  v: 1;
  local: PrivateBlob;
  remoteUserId: string;
  remoteDeviceId: number;
  /** Serialized SessionRecord for the remote address, if established */
  remoteSession?: string;
  /** Whether we already completed the first inbound prekey decrypt as responder */
  role: "initiator" | "responder";
  /** Cached remote identity public key (base64) for trust */
  remoteIdentityPub?: string;
};

class MemSessionStore {
  map = new Map<string, import("@signalapp/libsignal-client").SessionRecord>();
  constructor(private ls: Ls) {}
  async saveSession(
    name: import("@signalapp/libsignal-client").ProtocolAddress,
    record: import("@signalapp/libsignal-client").SessionRecord,
  ) {
    this.map.set(name.toString(), record);
  }
  async getSession(name: import("@signalapp/libsignal-client").ProtocolAddress) {
    return this.map.get(name.toString()) ?? null;
  }
  async getExistingSessions(
    addresses: import("@signalapp/libsignal-client").ProtocolAddress[],
  ) {
    return addresses.map((a) => {
      const rec = this.map.get(a.toString());
      if (!rec) throw new Error("missing session " + a.toString());
      return rec;
    });
  }
  dump(addr: import("@signalapp/libsignal-client").ProtocolAddress): string | undefined {
    const rec = this.map.get(addr.toString());
    return rec ? b64(rec.serialize()) : undefined;
  }
  load(addrKey: string, serialized?: string) {
    if (!serialized) return;
    this.map.set(addrKey, this.ls.SessionRecord.deserialize(fromB64(serialized)));
  }
}

class MemIdentityStore {
  map = new Map<string, import("@signalapp/libsignal-client").PublicKey>();
  constructor(
    private ls: Ls,
    private our: import("@signalapp/libsignal-client").IdentityKeyPair,
    private registrationId: number,
  ) {}
  async getIdentityKey() {
    return this.our.privateKey;
  }
  async getIdentityKeyPair() {
    return this.our;
  }
  async getLocalRegistrationId() {
    return this.registrationId;
  }
  async saveIdentity(
    name: import("@signalapp/libsignal-client").ProtocolAddress,
    key: import("@signalapp/libsignal-client").PublicKey,
  ) {
    const k = name.toString();
    const prev = this.map.get(k);
    this.map.set(k, key);
    if (prev != null && !prev.equals(key)) return this.ls.IdentityChange.ReplacedExisting;
    return this.ls.IdentityChange.NewOrUnchanged;
  }
  async isTrustedIdentity(
    name: import("@signalapp/libsignal-client").ProtocolAddress,
    key: import("@signalapp/libsignal-client").PublicKey,
  ) {
    const prev = this.map.get(name.toString());
    return prev == null || prev.equals(key);
  }
  async getIdentity(name: import("@signalapp/libsignal-client").ProtocolAddress) {
    return this.map.get(name.toString()) ?? null;
  }
}

class MemPreKeyStore {
  private map = new Map<number, import("@signalapp/libsignal-client").PreKeyRecord>();
  async savePreKey(id: number, record: import("@signalapp/libsignal-client").PreKeyRecord) {
    this.map.set(id, record);
  }
  async getPreKey(id: number) {
    const r = this.map.get(id);
    if (!r) throw new Error("missing prekey " + id);
    return r;
  }
  async removePreKey(id: number) {
    this.map.delete(id);
  }
}

class MemSignedPreKeyStore {
  private map = new Map<number, import("@signalapp/libsignal-client").SignedPreKeyRecord>();
  async saveSignedPreKey(
    id: number,
    record: import("@signalapp/libsignal-client").SignedPreKeyRecord,
  ) {
    this.map.set(id, record);
  }
  async getSignedPreKey(id: number) {
    const r = this.map.get(id);
    if (!r) throw new Error("missing signed prekey " + id);
    return r;
  }
}

class MemKyberStore {
  private map = new Map<number, import("@signalapp/libsignal-client").KyberPreKeyRecord>();
  async saveKyberPreKey(
    id: number,
    record: import("@signalapp/libsignal-client").KyberPreKeyRecord,
  ) {
    this.map.set(id, record);
  }
  async getKyberPreKey(id: number) {
    const r = this.map.get(id);
    if (!r) throw new Error("missing kyber prekey " + id);
    return r;
  }
  async markKyberPreKeyUsed() {}
}

function parsePrivate(raw: string): PrivateBlob {
  return JSON.parse(raw) as PrivateBlob;
}

function parseSession(raw: string): SessionBlob {
  return JSON.parse(raw) as SessionBlob;
}

export class NativeLibsignalSignalClient implements SignalClient {
  constructor(private ls: Ls) {}

  async generateIdentity(): Promise<{ publicBundle: DevicePublicKeys; privateState: string }> {
    const identity = this.ls.IdentityKeyPair.generate();
    const registrationId = Math.floor(Math.random() * 16380) + 1;
    const signedPriv = this.ls.PrivateKey.generate();
    const signedPub = signedPriv.getPublicKey();
    const signedPreKeyId = 1;
    const signedPreKeySig = identity.privateKey.sign(signedPub.serialize());
    const otPriv = this.ls.PrivateKey.generate();
    const oneTimePreKeyId = 100 + Math.floor(Math.random() * 900);
    const kem = this.ls.KEMKeyPair.generate();
    const kyberPreKeyId = 50 + Math.floor(Math.random() * 50);
    const kyberPreKeySig = identity.privateKey.sign(kem.getPublicKey().serialize());
    const userId = `ls_${registrationId}`;
    const deviceId = 1;

    const privateState: PrivateBlob = {
      v: 1,
      userId,
      deviceId,
      registrationId,
      identity: b64(identity.serialize()),
      signedPreKeyId,
      signedPreKey: b64(
        this.ls.SignedPreKeyRecord.new(
          signedPreKeyId,
          Date.now(),
          signedPub,
          signedPriv,
          signedPreKeySig,
        ).serialize(),
      ),
      signedPreKeySig: b64(signedPreKeySig),
      oneTimePreKeyId,
      oneTimePreKey: b64(
        this.ls.PreKeyRecord.new(oneTimePreKeyId, otPriv.getPublicKey(), otPriv).serialize(),
      ),
      kyberPreKeyId,
      kyberPreKey: b64(
        this.ls.KyberPreKeyRecord.new(kyberPreKeyId, Date.now(), kem, kyberPreKeySig).serialize(),
      ),
      kyberPreKeySig: b64(kyberPreKeySig),
    };

    return {
      publicBundle: {
        identityKeyPub: b64(identity.publicKey.serialize()),
        signedPrekeyPub: b64(signedPub.serialize()),
        signedPrekeySig: b64(signedPreKeySig),
        signedPrekeyId: signedPreKeyId,
        oneTimePrekeyPub: b64(otPriv.getPublicKey().serialize()),
        oneTimePrekeyId: oneTimePreKeyId,
        kyberPrekeyPub: b64(kem.getPublicKey().serialize()),
        kyberPrekeySig: b64(kyberPreKeySig),
        kyberPrekeyId: kyberPreKeyId,
        registrationId,
      },
      privateState: JSON.stringify(privateState),
    };
  }

  async establishSession(localPrivate: string, remote: DevicePublicKeys): Promise<SecureSession> {
    const local = parsePrivate(localPrivate);
    const identity = this.ls.IdentityKeyPair.deserialize(fromB64(local.identity));
    const localAddr = this.ls.ProtocolAddress.new(local.userId, local.deviceId);
    const remoteUserId = `ls_${remote.registrationId}`;
    const remoteAddr = this.ls.ProtocolAddress.new(remoteUserId, 1);

    const remoteIk = this.ls.PublicKey.deserialize(fromB64(remote.identityKeyPub));
    const remoteSpk = this.ls.PublicKey.deserialize(fromB64(remote.signedPrekeyPub));
    const remoteSpkSig = fromB64(remote.signedPrekeySig);
    const remotePre =
      remote.oneTimePrekeyPub && remote.oneTimePrekeyId != null
        ? this.ls.PublicKey.deserialize(fromB64(remote.oneTimePrekeyPub))
        : null;
    if (!remote.kyberPrekeyPub || !remote.kyberPrekeySig || remote.kyberPrekeyId == null) {
      throw new Error("libsignal remote bundle missing kyber prekey fields");
    }
    const remoteKyber = this.ls.KEMPublicKey.deserialize(fromB64(remote.kyberPrekeyPub));
    const remoteKyberSig = fromB64(remote.kyberPrekeySig);

    const bundle = this.ls.PreKeyBundle.new(
      remote.registrationId,
      1,
      remote.oneTimePrekeyId ?? null,
      remotePre,
      remote.signedPrekeyId,
      remoteSpk,
      remoteSpkSig,
      remoteIk,
      remote.kyberPrekeyId,
      remoteKyber,
      remoteKyberSig,
    );

    const sessions = new MemSessionStore(this.ls);
    const idStore = new MemIdentityStore(this.ls, identity, local.registrationId);
    await this.ls.processPreKeyBundle(
      bundle,
      remoteAddr,
      localAddr,
      sessions as never,
      idStore as never,
    );

    const blob: SessionBlob = {
      v: 1,
      local,
      remoteUserId,
      remoteDeviceId: 1,
      remoteSession: sessions.dump(remoteAddr),
      role: "initiator",
      remoteIdentityPub: remote.identityKeyPub,
    };
    return {
      remoteUserId: blob.remoteUserId,
      remoteDeviceId: String(blob.remoteDeviceId),
      stateBlob: JSON.stringify(blob),
    };
  }

  async encrypt(
    session: SecureSession,
    plaintext: string,
    expiresAt?: number,
  ): Promise<EncryptedMessage> {
    const blob = parseSession(session.stateBlob);
    const identity = this.ls.IdentityKeyPair.deserialize(fromB64(blob.local.identity));
    const localAddr = this.ls.ProtocolAddress.new(blob.local.userId, blob.local.deviceId);
    const remoteAddr = this.ls.ProtocolAddress.new(blob.remoteUserId, blob.remoteDeviceId);
    const sessions = new MemSessionStore(this.ls);
    sessions.load(remoteAddr.toString(), blob.remoteSession);
    const idStore = new MemIdentityStore(this.ls, identity, blob.local.registrationId);
    if (blob.remoteIdentityPub) {
      await idStore.saveIdentity(
        remoteAddr,
        this.ls.PublicKey.deserialize(fromB64(blob.remoteIdentityPub)),
      );
    }
    const msg = await this.ls.signalEncrypt(
      new TextEncoder().encode(plaintext),
      remoteAddr,
      localAddr,
      sessions as never,
      idStore as never,
    );
    blob.remoteSession = sessions.dump(remoteAddr);
    session.stateBlob = JSON.stringify(blob);
    return {
      ratchetHeader: String(msg.type()),
      ciphertext: b64(msg.serialize()),
      contentType: "msg",
      expiresAt,
    };
  }

  async decrypt(session: SecureSession, message: EncryptedMessage): Promise<string> {
    const blob = parseSession(session.stateBlob);
    const identity = this.ls.IdentityKeyPair.deserialize(fromB64(blob.local.identity));
    const localAddr = this.ls.ProtocolAddress.new(blob.local.userId, blob.local.deviceId);
    const remoteAddr = this.ls.ProtocolAddress.new(blob.remoteUserId, blob.remoteDeviceId);
    const sessions = new MemSessionStore(this.ls);
    sessions.load(remoteAddr.toString(), blob.remoteSession);
    const idStore = new MemIdentityStore(this.ls, identity, blob.local.registrationId);
    if (blob.remoteIdentityPub) {
      await idStore.saveIdentity(
        remoteAddr,
        this.ls.PublicKey.deserialize(fromB64(blob.remoteIdentityPub)),
      );
    }

    const type = Number(message.ratchetHeader);
    const raw = fromB64(message.ciphertext);
    let plain: Uint8Array;
    if (type === this.ls.CiphertextMessageType.PreKey) {
      const preKeys = new MemPreKeyStore();
      const signed = new MemSignedPreKeyStore();
      const kyber = new MemKyberStore();
      await preKeys.savePreKey(
        blob.local.oneTimePreKeyId,
        this.ls.PreKeyRecord.deserialize(fromB64(blob.local.oneTimePreKey)),
      );
      await signed.saveSignedPreKey(
        blob.local.signedPreKeyId,
        this.ls.SignedPreKeyRecord.deserialize(fromB64(blob.local.signedPreKey)),
      );
      await kyber.saveKyberPreKey(
        blob.local.kyberPreKeyId,
        this.ls.KyberPreKeyRecord.deserialize(fromB64(blob.local.kyberPreKey)),
      );
      plain = await this.ls.signalDecryptPreKey(
        this.ls.PreKeySignalMessage.deserialize(raw),
        remoteAddr,
        localAddr,
        sessions as never,
        idStore as never,
        preKeys as never,
        signed as never,
        kyber as never,
      );
      blob.role = "responder";
    } else {
      plain = await this.ls.signalDecrypt(
        this.ls.SignalMessage.deserialize(raw),
        remoteAddr,
        localAddr,
        sessions as never,
        idStore as never,
      );
    }
    blob.remoteSession = sessions.dump(remoteAddr);
    session.stateBlob = JSON.stringify(blob);
    return new TextDecoder().decode(plain);
  }
}

/** Attempt to load native libsignal; returns null when unavailable on this platform. */
export async function tryCreateNativeLibsignalClient(): Promise<SignalClient | null> {
  try {
    const ls = await import(
      /* @vite-ignore */
      /* webpackIgnore: true */
      "@signalapp/libsignal-client"
    );
    // Touch a native entrypoint so missing prebuilds fail here.
    ls.IdentityKeyPair.generate();
    return new NativeLibsignalSignalClient(ls);
  } catch {
    return null;
  }
}
