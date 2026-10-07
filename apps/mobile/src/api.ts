import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "lh.token";
const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? "";

/** In-memory cache so callers can use sync getToken() like the web client. */
let memoryToken: string | null = null;
let hydrated = false;

export function getApiBase(): string {
  return API_BASE;
}

export function getToken(): string | null {
  return memoryToken;
}

export async function hydrateToken(): Promise<void> {
  if (hydrated) return;
  try {
    memoryToken = await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    memoryToken = null;
  }
  hydrated = true;
}

export async function setToken(token: string | null): Promise<void> {
  memoryToken = token;
  try {
    if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
    else await AsyncStorage.removeItem(TOKEN_KEY);
  } catch {
    // Persistence failed; memory token still applies for this session.
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!API_BASE) {
    throw new Error("EXPO_PUBLIC_API_BASE not set");
  }
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? "request_failed");
  }
  return res.json() as Promise<T>;
}
