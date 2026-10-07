/**
 * Ensure btoa/atob exist for @logoshome/crypto session-aes on RN runtimes
 * that lack them. WebCrypto subtle is required for real encrypt/keygen.
 */

function bytesToB64(bytes: Uint8Array): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0;
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    out += chars[a >> 2];
    out += chars[((a & 3) << 4) | ((b ?? 0) >> 4)];
    out += b === undefined ? "=" : chars[(((b ?? 0) & 15) << 2) | ((c ?? 0) >> 6)];
    out += c === undefined ? "=" : chars[(c ?? 0) & 63];
  }
  return out;
}

function b64ToBytes(s: string): Uint8Array {
  const clean = s.replace(/=+$/, "");
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const out: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const n =
      (chars.indexOf(clean[i]!) << 18) |
      (chars.indexOf(clean[i + 1]!) << 12) |
      ((chars.indexOf(clean[i + 2]!) & 63) << 6) |
      (chars.indexOf(clean[i + 3]!) & 63);
    out.push((n >> 16) & 255);
    if (clean[i + 2] && clean[i + 2] !== "=") out.push((n >> 8) & 255);
    if (clean[i + 3] && clean[i + 3] !== "=") out.push(n & 255);
  }
  return Uint8Array.from(out);
}

export function ensureBase64Globals(): void {
  const g = globalThis as typeof globalThis & {
    btoa?: (s: string) => string;
    atob?: (s: string) => string;
  };
  if (!g.btoa) {
    g.btoa = (bin: string) => {
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return bytesToB64(bytes);
    };
  }
  if (!g.atob) {
    g.atob = (b64: string) => {
      const bytes = b64ToBytes(b64);
      let s = "";
      for (const b of bytes) s += String.fromCharCode(b);
      return s;
    };
  }
}

type CryptoLike = { subtle?: unknown; getRandomValues?: (a: Uint8Array) => Uint8Array };

function getCrypto(): CryptoLike | undefined {
  return (globalThis as unknown as { crypto?: CryptoLike }).crypto;
}

export function hasWebCrypto(): boolean {
  return Boolean(getCrypto()?.subtle);
}

export function getRandomValues(bytes: Uint8Array): Uint8Array {
  const c = getCrypto();
  if (c?.getRandomValues) return c.getRandomValues(bytes);
  for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return bytes;
}
