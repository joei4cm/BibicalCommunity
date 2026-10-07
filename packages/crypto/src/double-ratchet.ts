/**
 * Double Ratchet–shaped session crypto (WebCrypto).
 *
 * Simplified skeleton: root key + send/recv chain keys via HKDF-SHA-256,
 * message keys via AES-GCM. Correct API surface for product wiring; not a
 * full Signal Double Ratchet (skipped message keys, out-of-order, header
 * encryption, and DH ratchet steps are minimized).
 */

function b64(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of u8) s += String.fromCharCode(b);
  return btoa(s);
}

function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hkdf(
  ikm: ArrayBuffer | Uint8Array,
  info: string,
  lengthBits = 256,
): Promise<ArrayBuffer> {
  const raw = ikm instanceof Uint8Array ? ikm : new Uint8Array(ikm);
  const key = await crypto.subtle.importKey("raw", raw as BufferSource, "HKDF", false, [
    "deriveBits",
  ]);
  return crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new TextEncoder().encode("logoshome-dr-v1"),
      info: new TextEncoder().encode(info),
    },
    key,
    lengthBits,
  );
}

export type RatchetSessionState = {
  /** Base64 root key material */
  rootKey: string;
  /** Base64 send chain key */
  sendChainKey: string;
  /** Base64 receive chain key */
  recvChainKey: string;
  sendN: number;
  recvN: number;
  /** Optional DH ratchet public JWK (peer) */
  remoteDhPub?: JsonWebKey;
  /** Optional local DH ratchet private JWK */
  localDhPriv?: JsonWebKey;
  localDhPub?: JsonWebKey;
};

export type RatchetMessage = {
  header: {
    n: number;
    dhPub?: JsonWebKey;
  };
  /** Base64 AES-GCM IV */
  iv: string;
  /** Base64 ciphertext */
  ciphertext: string;
};

/** Initialize ratchet session from an X3DH (or other) shared secret. */
export async function initRatchetSession(
  sharedSecret: ArrayBuffer,
  role: "initiator" | "responder",
): Promise<RatchetSessionState> {
  const root = await hkdf(sharedSecret, "root");
  const sendInfo = role === "initiator" ? "chain-send" : "chain-recv";
  const recvInfo = role === "initiator" ? "chain-recv" : "chain-send";
  const sendChain = await hkdf(root, sendInfo);
  const recvChain = await hkdf(root, recvInfo);
  return {
    rootKey: b64(root),
    sendChainKey: b64(sendChain),
    recvChainKey: b64(recvChain),
    sendN: 0,
    recvN: 0,
  };
}

async function advanceChain(
  chainKeyB64: string,
): Promise<{ nextChain: string; messageKey: ArrayBuffer }> {
  const chain = fromB64(chainKeyB64);
  const messageKey = await hkdf(chain, "msg-key");
  const next = await hkdf(chain, "chain-next");
  return { nextChain: b64(next), messageKey };
}

/** Update root key from DH output (simplified DH ratchet step). */
export async function updateRootKey(
  state: RatchetSessionState,
  dhOutput: ArrayBuffer,
): Promise<RatchetSessionState> {
  const mixed = await hkdf(
    concatRaw(fromB64(state.rootKey), new Uint8Array(dhOutput)),
    "root-ratchet",
  );
  const sendChain = await hkdf(mixed, "chain-send");
  const recvChain = await hkdf(mixed, "chain-recv");
  return {
    ...state,
    rootKey: b64(mixed),
    sendChainKey: b64(sendChain),
    recvChainKey: b64(recvChain),
    sendN: 0,
    recvN: 0,
  };
}

function concatRaw(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

async function importAesGcm(messageKey: ArrayBuffer): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", messageKey, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function ratchetEncrypt(
  state: RatchetSessionState,
  plaintext: string,
  aad = "msg",
): Promise<{ state: RatchetSessionState; message: RatchetMessage }> {
  const { nextChain, messageKey } = await advanceChain(state.sendChainKey);
  const key = await importAesGcm(messageKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: new TextEncoder().encode(aad),
    },
    key,
    new TextEncoder().encode(plaintext),
  );
  const n = state.sendN;
  return {
    state: { ...state, sendChainKey: nextChain, sendN: n + 1 },
    message: {
      header: { n, dhPub: state.localDhPub },
      iv: b64(iv),
      ciphertext: b64(ct),
    },
  };
}

export async function ratchetDecrypt(
  state: RatchetSessionState,
  message: RatchetMessage,
  aad = "msg",
): Promise<{ state: RatchetSessionState; plaintext: string }> {
  // Simplified: assume in-order; advance once per decrypt.
  let nextState = { ...state };
  if (message.header.n !== nextState.recvN) {
    // Skip ahead (bounded) for skeleton correctness of API shape.
    while (nextState.recvN < message.header.n) {
      const skip = await advanceChain(nextState.recvChainKey);
      nextState = {
        ...nextState,
        recvChainKey: skip.nextChain,
        recvN: nextState.recvN + 1,
      };
    }
  }
  const { nextChain, messageKey } = await advanceChain(nextState.recvChainKey);
  const key = await importAesGcm(messageKey);
  const pt = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: fromB64(message.iv) as BufferSource,
      additionalData: new TextEncoder().encode(aad),
    },
    key,
    fromB64(message.ciphertext) as BufferSource,
  );
  return {
    state: {
      ...nextState,
      recvChainKey: nextChain,
      recvN: nextState.recvN + 1,
    },
    plaintext: new TextDecoder().decode(pt),
  };
}
