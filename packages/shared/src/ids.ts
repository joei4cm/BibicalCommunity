/** ULID-like sortable id (Crockford base32). */
const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function createId(prefix?: string): string {
  const time = Date.now();
  let t = time;
  let timePart = "";
  for (let i = 0; i < 10; i++) {
    timePart = ENCODING[t % 32] + timePart;
    t = Math.floor(t / 32);
  }
  let rand = "";
  const bytes = cryptoGetRandom(16);
  for (let i = 0; i < 16; i++) {
    rand += ENCODING[(bytes[i] ?? 0) % 32];
  }
  const id = timePart + rand;
  return prefix ? `${prefix}_${id}` : id;
}

function cryptoGetRandom(len: number): Uint8Array {
  const out = new Uint8Array(len);
  const subtleCrypto = globalThis.crypto as Crypto | undefined;
  if (subtleCrypto && typeof subtleCrypto.getRandomValues === "function") {
    subtleCrypto.getRandomValues(out);
    return out;
  }
  for (let i = 0; i < len; i++) out[i] = Math.floor(Math.random() * 256);
  return out;
}

export type LocaleCode = "zh-CN" | "en" | "ja";
export const SUPPORTED_LOCALES: LocaleCode[] = ["zh-CN", "en", "ja"];

/** App chrome themes. `day` is the default cement (cool slate) palette. */
export type ThemeId = "day" | "blush" | "sepia" | "night" | "highContrast";
export const THEME_IDS: ThemeId[] = ["day", "blush", "sepia", "night", "highContrast"];
