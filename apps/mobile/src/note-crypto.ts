/**
 * Client-side AES-GCM note key for Bible annotations (parity with web note-crypto).
 * Key JWK prefers expo-secure-store; falls back to AsyncStorage.
 */
import {
  decryptJson as decryptJsonRaw,
  encryptJson as encryptJsonRaw,
  generateAndExportNoteKey,
  importNoteKey,
} from "@logoshome/crypto";
import { ensureBase64Globals, hasWebCrypto } from "./crypto-polyfill";
import { kvDelete, kvGet, kvSet } from "./secure-kv";

export const NOTE_KEY_STORAGE = "lh.noteKey.jwk";

ensureBase64Globals();

/** Avoid DOM lib: CryptoKey/JsonWebKey come from @logoshome/crypto return types. */
type NoteKey = Awaited<ReturnType<typeof importNoteKey>>;

let cachedKey: NoteKey | null = null;

export async function loadOrCreateNoteKey(): Promise<NoteKey> {
  if (cachedKey) return cachedKey;
  if (!hasWebCrypto()) {
    throw new Error("webcrypto_unavailable");
  }
  const { value: raw } = await kvGet(NOTE_KEY_STORAGE);
  if (raw) {
    try {
      const jwk = JSON.parse(raw) as Parameters<typeof importNoteKey>[0];
      cachedKey = await importNoteKey(jwk);
      return cachedKey;
    } catch {
      await kvDelete(NOTE_KEY_STORAGE);
    }
  }
  const { key, jwk } = await generateAndExportNoteKey();
  await kvSet(NOTE_KEY_STORAGE, JSON.stringify(jwk));
  cachedKey = key;
  return key;
}

export async function encryptJson(
  value: unknown,
  aad?: string,
): Promise<{ ciphertext: string; iv: string }> {
  const key = await loadOrCreateNoteKey();
  return encryptJsonRaw(key, value, aad);
}

export async function decryptJson<T>(
  ciphertext: string,
  iv: string,
  aad?: string,
): Promise<T> {
  const key = await loadOrCreateNoteKey();
  return decryptJsonRaw<T>(key, ciphertext, iv, aad);
}
