/**
 * Pairwise AES-GCM session crypto (WebCrypto).
 * Not full Signal Protocol — bridges product wiring until libsignal lands.
 * Server still only stores opaque ciphertext.
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

export async function deriveSessionKey(
  sharedSecretMaterial: string,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(sharedSecretMaterial),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode("logoshome-session-v1"),
      iterations: 120_000,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptSessionPayload(
  key: CryptoKey,
  plaintext: string,
  aad = "msg",
): Promise<{ ratchetHeader: string; ciphertext: string }> {
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
  return { ratchetHeader: b64(iv), ciphertext: b64(ct) };
}

export async function decryptSessionPayload(
  key: CryptoKey,
  ratchetHeader: string,
  ciphertext: string,
  aad = "msg",
): Promise<string> {
  const pt = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: fromB64(ratchetHeader) as BufferSource,
      additionalData: new TextEncoder().encode(aad),
    },
    key,
    fromB64(ciphertext) as BufferSource,
  );
  return new TextDecoder().decode(pt);
}

/** Exportable note root key stored in IndexedDB / secure store (client only). */
export async function generateAndExportNoteKey(): Promise<{
  key: CryptoKey;
  jwk: JsonWebKey;
}> {
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
  const jwk = await crypto.subtle.exportKey("jwk", key);
  return { key, jwk };
}

export async function importNoteKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey("jwk", jwk, { name: "AES-GCM", length: 256 }, false, [
    "encrypt",
    "decrypt",
  ]);
}
