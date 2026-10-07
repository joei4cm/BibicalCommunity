import {
  initRatchetSession,
  ratchetDecrypt,
  ratchetEncrypt,
  type RatchetMessage,
  type RatchetSessionState,
} from "@logoshome/crypto";

const STATE_PREFIX = "lh.ratchet.";

function loadState(conversationId: string): RatchetSessionState | null {
  const raw = localStorage.getItem(STATE_PREFIX + conversationId);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RatchetSessionState;
  } catch {
    return null;
  }
}

function saveState(conversationId: string, state: RatchetSessionState) {
  localStorage.setItem(STATE_PREFIX + conversationId, JSON.stringify(state));
}

/** Ensure a Double Ratchet session exists (bootstrapped from conversation-scoped seed). */
export async function ensureRatchet(conversationId: string): Promise<RatchetSessionState> {
  const existing = loadState(conversationId);
  if (existing) return existing;
  const seed = new TextEncoder().encode(`logoshome-bootstrap:${conversationId}`);
  const ab = seed.buffer.slice(seed.byteOffset, seed.byteOffset + seed.byteLength);
  const state = await initRatchetSession(ab, "initiator");
  saveState(conversationId, state);
  return state;
}

export async function encryptChatMessage(
  conversationId: string,
  plaintext: string,
): Promise<{ ratchetHeader: string; ciphertext: string }> {
  let state = await ensureRatchet(conversationId);
  const { message, state: next } = await ratchetEncrypt(state, plaintext);
  saveState(conversationId, next);
  return {
    ratchetHeader: btoa(unescape(encodeURIComponent(JSON.stringify(message.header)))),
    ciphertext: JSON.stringify({ iv: message.iv, ciphertext: message.ciphertext }),
  };
}

export async function decryptChatMessage(
  conversationId: string,
  ratchetHeader: string,
  ciphertextBlob: string,
): Promise<string> {
  let state = await ensureRatchet(conversationId);
  let header: RatchetMessage["header"];
  let body: { iv: string; ciphertext: string };
  try {
    header = JSON.parse(decodeURIComponent(escape(atob(ratchetHeader)))) as RatchetMessage["header"];
    body = JSON.parse(ciphertextBlob) as { iv: string; ciphertext: string };
  } catch {
    // Fallback for legacy AES-GCM session-aes messages
    throw new Error("legacy_or_invalid");
  }
  const msg: RatchetMessage = {
    header,
    iv: body.iv,
    ciphertext: body.ciphertext,
  };
  const { plaintext, state: next } = await ratchetDecrypt(state, msg);
  saveState(conversationId, next);
  return plaintext;
}
