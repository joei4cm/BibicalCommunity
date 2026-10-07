import {
  decryptJson as decryptJsonRaw,
  encryptJson as encryptJsonRaw,
  generateAndExportNoteKey,
  importNoteKey,
} from "@logoshome/crypto";

const NOTE_KEY_STORAGE = "lh.noteKey.jwk";

let cachedKey: CryptoKey | null = null;

/** Load or create the client-side AES-GCM note key (JWK in localStorage). */
export async function loadOrCreateNoteKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const raw = localStorage.getItem(NOTE_KEY_STORAGE);
  if (raw) {
    try {
      const jwk = JSON.parse(raw) as JsonWebKey;
      cachedKey = await importNoteKey(jwk);
      return cachedKey;
    } catch {
      localStorage.removeItem(NOTE_KEY_STORAGE);
    }
  }
  const { key, jwk } = await generateAndExportNoteKey();
  localStorage.setItem(NOTE_KEY_STORAGE, JSON.stringify(jwk));
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
