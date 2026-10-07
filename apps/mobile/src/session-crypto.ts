import {
  decryptSessionPayload,
  deriveSessionKey,
  encryptSessionPayload,
} from "@logoshome/crypto";
import { ensureBase64Globals, getRandomValues, hasWebCrypto } from "./crypto-polyfill";
import { kvGet, kvSet } from "./secure-kv";

export const SESSION_MATERIAL_PREFIX = "lh.session.material.";

ensureBase64Globals();

async function materialForConversation(conversationId: string): Promise<string> {
  const key = `${SESSION_MATERIAL_PREFIX}${conversationId}`;
  const { value: existing } = await kvGet(key);
  if (existing) return existing;
  // Deterministic-enough local material for MVP pairwise AES; replace with
  // X3DH shared secret once mobile Double Ratchet matches web ChatPanel.
  const bytes = getRandomValues(new Uint8Array(32));
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  const material = `mobile-session:${conversationId}:${hex}`;
  await kvSet(key, material);
  return material;
}

export async function encryptMobileMessage(
  conversationId: string,
  plaintext: string,
): Promise<{ ratchetHeader: string; ciphertext: string }> {
  if (!hasWebCrypto()) {
    throw new Error("webcrypto_unavailable");
  }
  const material = await materialForConversation(conversationId);
  const key = await deriveSessionKey(material);
  return encryptSessionPayload(key, plaintext, `conv:${conversationId}`);
}

export async function decryptMobileMessage(
  conversationId: string,
  ratchetHeader: string,
  ciphertext: string,
): Promise<string | null> {
  if (!hasWebCrypto()) return null;
  try {
    const material = await materialForConversation(conversationId);
    const key = await deriveSessionKey(material);
    return await decryptSessionPayload(key, ratchetHeader, ciphertext, `conv:${conversationId}`);
  } catch {
    return null;
  }
}
