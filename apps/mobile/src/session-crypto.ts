import {
  decryptSessionPayload,
  deriveSessionKey,
  encryptSessionPayload,
} from "@logoshome/crypto";
import { ensureBase64Globals, hasWebCrypto } from "./crypto-polyfill";
import {
  tryDecryptProductMobileMessage,
  tryEncryptProductMobileMessage,
} from "./product-signal-chat";

ensureBase64Globals();

/**
 * Opt-in only (`EXPO_PUBLIC_ALLOW_DEGRADED_CHAT=true`). Closed beta / production
 * must fail closed — same policy as web `VITE_ALLOW_DEGRADED_CHAT`.
 */
export function degradedChatAllowed(): boolean {
  try {
    return String(process.env.EXPO_PUBLIC_ALLOW_DEGRADED_CHAT ?? "") === "true";
  } catch {
    return false;
  }
}

/**
 * Degraded (no peer product keys) material is deterministic from conversationId
 * so two handsets can still decrypt each other — same model as web bootstrapDegraded.
 * Prefer the product x25519 path whenever both peers uploaded keys.
 */
function degradedMaterial(
  conversationId: string,
  peerUserId?: string | null,
  selfUserId?: string | null,
): string {
  if (peerUserId && selfUserId) {
    const pair = [selfUserId, peerUserId].sort().join(":");
    return `logoshome-bootstrap-v2:${conversationId}:${pair}`;
  }
  return peerUserId
    ? `logoshome-bootstrap-v2:${conversationId}:${peerUserId}`
    : `logoshome-bootstrap-v2:${conversationId}`;
}

export async function encryptMobileMessage(
  conversationId: string,
  plaintext: string,
  peerUserId?: string | null,
  selfUserId?: string | null,
): Promise<{ ratchetHeader: string; ciphertext: string; mode: "product" | "degraded" }> {
  if (!hasWebCrypto()) {
    throw new Error("webcrypto_unavailable");
  }
  const product = await tryEncryptProductMobileMessage(conversationId, plaintext, peerUserId);
  if (product) return product;

  if (!degradedChatAllowed()) {
    throw new Error("chat_keys_required");
  }

  const material = degradedMaterial(conversationId, peerUserId, selfUserId);
  const key = await deriveSessionKey(material);
  const enc = await encryptSessionPayload(key, plaintext, `conv:${conversationId}`);
  return { ...enc, mode: "degraded" };
}

export async function decryptMobileMessage(
  conversationId: string,
  ratchetHeader: string,
  ciphertext: string,
  peerUserId?: string | null,
  selfUserId?: string | null,
): Promise<string | null> {
  if (!hasWebCrypto()) return null;
  const productPlain = await tryDecryptProductMobileMessage(
    conversationId,
    ratchetHeader,
    ciphertext,
    peerUserId,
  );
  if (productPlain != null) return productPlain;

  if (!degradedChatAllowed()) return null;

  try {
    const material = degradedMaterial(conversationId, peerUserId, selfUserId);
    const key = await deriveSessionKey(material);
    return await decryptSessionPayload(key, ratchetHeader, ciphertext, `conv:${conversationId}`);
  } catch {
    return null;
  }
}
