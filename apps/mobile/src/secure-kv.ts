/**
 * Sensitive key-value storage: prefer expo-secure-store (Keychain / Keystore),
 * fall back to AsyncStorage, then in-memory (Node unit tests).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

type SecureStoreLike = {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
};

let secureStore: SecureStoreLike | null | undefined;
const memory = new Map<string, string>();

async function getSecureStore(): Promise<SecureStoreLike | null> {
  if (secureStore !== undefined) return secureStore;
  try {
    const mod = await import("expo-secure-store");
    secureStore = mod as SecureStoreLike;
  } catch {
    secureStore = null;
  }
  return secureStore;
}

export type KvBackend = "secure-store" | "async-storage" | "memory";

async function asyncGet(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return memory.get(key) ?? null;
  }
}

async function asyncSet(key: string, value: string): Promise<KvBackend> {
  try {
    await AsyncStorage.setItem(key, value);
    memory.delete(key);
    return "async-storage";
  } catch {
    memory.set(key, value);
    return "memory";
  }
}

async function asyncDelete(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    /* ignore */
  }
  memory.delete(key);
}

export async function kvGet(key: string): Promise<{ value: string | null; backend: KvBackend }> {
  const ss = await getSecureStore();
  if (ss) {
    try {
      const value = await ss.getItemAsync(key);
      return { value, backend: "secure-store" };
    } catch {
      /* fall through */
    }
  }
  try {
    const value = await AsyncStorage.getItem(key);
    if (value != null || !memory.has(key)) {
      return { value, backend: "async-storage" };
    }
  } catch {
    /* fall through to memory */
  }
  return { value: memory.get(key) ?? null, backend: "memory" };
}

export async function kvSet(key: string, value: string): Promise<KvBackend> {
  const ss = await getSecureStore();
  if (ss) {
    try {
      await ss.setItemAsync(key, value);
      await asyncDelete(key);
      return "secure-store";
    } catch {
      /* fall through */
    }
  }
  return asyncSet(key, value);
}

export async function kvDelete(key: string): Promise<void> {
  const ss = await getSecureStore();
  if (ss) {
    try {
      await ss.deleteItemAsync(key);
    } catch {
      /* ignore */
    }
  }
  await asyncDelete(key);
}

/** Wipe known secret keys from all backends. */
export async function wipeSecureSecrets(keys: string[]): Promise<void> {
  await Promise.all(keys.map((k) => kvDelete(k)));
}

export const KNOWN_SECRET_KEYS = [
  "lh.device.priv",
  "lh.product.signal.priv",
  "lh.noteKey.jwk",
] as const;
