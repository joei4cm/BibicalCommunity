/**
 * Client-side AES-GCM for chat attachments. Ciphertext goes to R2; the content
 * key travels only inside the E2EE chat payload.
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

export type MediaContentKey = {
  /** Base64 raw AES-256 key */
  k: string;
  /** Base64 12-byte IV */
  iv: string;
  v: 1;
};

export async function encryptMediaBlob(
  data: ArrayBuffer,
  aad = "lh-media-v1",
): Promise<{ ciphertext: ArrayBuffer; contentKey: MediaContentKey }> {
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(aad) },
    key,
    data,
  );
  const raw = await crypto.subtle.exportKey("raw", key);
  return {
    ciphertext,
    contentKey: { v: 1, k: b64(raw), iv: b64(iv) },
  };
}

export async function decryptMediaBlob(
  ciphertext: ArrayBuffer,
  contentKey: MediaContentKey,
  aad = "lh-media-v1",
): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    "raw",
    fromB64(contentKey.k) as BufferSource,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );
  return crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: fromB64(contentKey.iv) as BufferSource,
      additionalData: new TextEncoder().encode(aad),
    },
    key,
    ciphertext,
  );
}
