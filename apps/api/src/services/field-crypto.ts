import type { Env } from "../env";

/** AES-GCM field encryption for P2 profile fields (standard mode). */
async function getDek(env: Env): Promise<CryptoKey> {
  const secret = env.KEK_MASTER ?? "dev-only-kek-change-me-32bytes!!";
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret.slice(0, 32).padEnd(32, "0")),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode("logoshome-dek-profile"),
      iterations: 100_000,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function b64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function fromB64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

export async function sealField(env: Env, userId: string, field: string, plaintext: string): Promise<string> {
  const key = await getDek(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const aad = new TextEncoder().encode(`${userId}:${field}`);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: aad },
    key,
    new TextEncoder().encode(plaintext),
  );
  return `v1.${b64(iv.buffer)}.${b64(ct)}`;
}

export async function openField(
  env: Env,
  userId: string,
  field: string,
  sealed: string | null | undefined,
): Promise<string | null> {
  if (!sealed) return null;
  if (!sealed.startsWith("v1.")) return sealed; // plaintext legacy rows
  const parts = sealed.split(".");
  if (parts.length !== 3) return null;
  const iv = fromB64(parts[1] ?? "");
  const ct = fromB64(parts[2] ?? "");
  const key = await getDek(env);
  const aad = new TextEncoder().encode(`${userId}:${field}`);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource, additionalData: aad },
    key,
    ct as BufferSource,
  );
  return new TextDecoder().decode(pt);
}
