/** AES-GCM envelope helpers for P3 notes / local secrets (WebCrypto). */

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

export async function generateNoteKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

export async function encryptJson(
  key: CryptoKey,
  value: unknown,
  aad?: string,
): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(value));
  const ct = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: aad ? new TextEncoder().encode(aad) : undefined,
    },
    key,
    encoded,
  );
  return { ciphertext: b64(ct), iv: b64(iv) };
}

export async function decryptJson<T>(
  key: CryptoKey,
  ciphertext: string,
  iv: string,
  aad?: string,
): Promise<T> {
  const ivBytes = fromB64(iv);
  const ctBytes = fromB64(ciphertext);
  const pt = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: ivBytes as BufferSource,
      additionalData: aad ? new TextEncoder().encode(aad) : undefined,
    },
    key,
    ctBytes as BufferSource,
  );
  return JSON.parse(new TextDecoder().decode(pt)) as T;
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
