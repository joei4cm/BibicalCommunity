export const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export function getToken(): string | null {
  return localStorage.getItem("lh.token");
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem("lh.token", token);
  else localStorage.removeItem("lh.token");
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
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

/** GET helper that returns null on 404 instead of throwing. */
export async function apiOptional<T>(path: string): Promise<T | null> {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${API_BASE}${path}`, { headers });
  if (res.status === 404) return null;
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? "request_failed");
  }
  return res.json() as Promise<T>;
}
