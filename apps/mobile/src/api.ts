import AsyncStorage from "@react-native-async-storage/async-storage";
import { kvDelete, kvGet, kvSet } from "./secure-kv";

const TOKEN_KEY = "lh.token";
const API_BASE_KEY = "lh.apiBase";
const ENV_API_BASE = (process.env.EXPO_PUBLIC_API_BASE ?? "").replace(/\/$/, "");

/** Runtime override (Me screen) wins over build-time EXPO_PUBLIC_API_BASE. */
let memoryApiBase: string | null = null;
let apiBaseHydrated = false;

/** In-memory cache so callers can use sync getToken() like the web client. */
let memoryToken: string | null = null;
let tokenHydrated = false;

function normalizeBase(url: string): string {
  return url.trim().replace(/\/$/, "");
}

export function getApiBase(): string {
  if (memoryApiBase) return memoryApiBase;
  return ENV_API_BASE;
}

export async function hydrateApiBase(): Promise<void> {
  if (apiBaseHydrated) return;
  try {
    const stored = await AsyncStorage.getItem(API_BASE_KEY);
    if (stored) memoryApiBase = normalizeBase(stored);
  } catch {
    /* keep env fallback */
  }
  apiBaseHydrated = true;
}

/** Persist deployed API origin, e.g. https://api.example.com */
export async function setApiBase(url: string | null): Promise<void> {
  const cleaned = url ? normalizeBase(url) : "";
  memoryApiBase = cleaned || null;
  try {
    if (cleaned) await AsyncStorage.setItem(API_BASE_KEY, cleaned);
    else await AsyncStorage.removeItem(API_BASE_KEY);
  } catch {
    /* memory still applies */
  }
}

export function getToken(): string | null {
  return memoryToken;
}

/**
 * Restore session from SecureStore (Keychain/Keystore fingerprint vault)
 * so relaunch auto-logs in without re-entering the password.
 */
export async function hydrateToken(): Promise<void> {
  await hydrateApiBase();
  if (tokenHydrated) return;
  try {
    const { value } = await kvGet(TOKEN_KEY);
    memoryToken = value;
    // One-time migrate from legacy AsyncStorage if SecureStore was empty.
    if (!memoryToken) {
      const legacy = await AsyncStorage.getItem(TOKEN_KEY);
      if (legacy) {
        memoryToken = legacy;
        await kvSet(TOKEN_KEY, legacy);
        await AsyncStorage.removeItem(TOKEN_KEY).catch(() => undefined);
      }
    }
  } catch {
    memoryToken = null;
  }
  tokenHydrated = true;
}

export async function setToken(token: string | null): Promise<void> {
  memoryToken = token;
  try {
    if (token) await kvSet(TOKEN_KEY, token);
    else await kvDelete(TOKEN_KEY);
    await AsyncStorage.removeItem(TOKEN_KEY).catch(() => undefined);
  } catch {
    // Persistence failed; memory token still applies for this session.
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  await hydrateApiBase();
  const base = getApiBase();
  if (!base) {
    throw new Error("api_base_required");
  }
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${base}${path}`, { ...init, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? "request_failed");
  }
  return res.json() as Promise<T>;
}
