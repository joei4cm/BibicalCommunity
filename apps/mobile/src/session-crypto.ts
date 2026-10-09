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
 * Degraded (no peer product keys) material is deterministic from conversationId
 * so two handsets can still decrypt each other — same model as web bootstrapDegraded.
 * Prefer the product x25519 path whenever both peers uploaded keys.
 */
function degradedMaterial(conversationId: string, peerUserId?: string | null): string {
  return peerUserId
    ? `logoshome-bootstrap:${conversationId}:${peerUserId}`
    : `logoshome-bootstrap:${conversationId}`;
}

export async function encryptMobileMessage(
  conversationId: string,
  plaintext: string,
  peerUserId?: string | null,
): Promise<{ ratchetHeader: string; ciphertext: string; mode: "product" | "degraded" }> {
  if (!hasWebCrypto()) {
    throw new Error("webcrypto_unavailable");
  }
  const product = await tryEncryptProductMobileMessage(conversationId, plaintext, peerUserId);
  if (product) return product;

  const material = degradedMaterial(conversationId, peerUserId);
  const key = await deriveSessionKey(material);
  const enc = await encryptSessionPayload(key, plaintext, `conv:${conversationId}`);
  return { ...enc, mode: "degraded" };
}

export async function decryptMobileMessage(
  conversationId: string,
  ratchetHeader: string,
  ciphertext: string,
  peerUserId?: string | null,
): Promise<string | null> {
  if (!hasWebCrypto()) return null;
  const productPlain = await tryDecryptProductMobileMessage(
    conversationId,
    ratchetHeader,
    ciphertext,
    peerUserId,
  );
  if (productPlain != null) return productPlain;

  try {
    const material = degradedMaterial(conversationId, peerUserId);
    const key = await deriveSessionKey(material);
    return await decryptSessionPayload(key, ratchetHeader, ciphertext, `conv:${conversationId}`);
  } catch {
    return null;
  }
}
