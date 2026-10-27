/**
 * API client for web / PWA / Electron / Capacitor.
 *
 * Resolution order for base URL:
 * 1. `lh.apiBase` in localStorage (Me / Login override)
 * 2. build-time `VITE_API_BASE`
 * 3. production Worker default when running inside a packaged shell (file:/capacitor:/Electron)
 * 4. "" → same-origin relative (Vite proxy / Pages+Worker proxy setups)
 */

import { isPublicBibleGetPath } from "./api-public-path";

const ENV_API_BASE = String(import.meta.env.VITE_API_BASE ?? "")
  .trim()
  .replace(/\/$/, "");

/** Cloudflare Worker used by production deploy (see Deploy Cloudflare workflow). */
export const DEFAULT_PROD_API_BASE = "https://logoshome-api.joei4cm.workers.dev";

const STORAGE_KEY = "lh.apiBase";

export function isPackagedShell(): boolean {
  if (typeof window === "undefined") return false;
  const proto = window.location.protocol;
  if (proto === "file:" || proto === "capacitor:" || proto === "ionic:") return true;
  const w = window as Window & { Capacitor?: unknown; electronAPI?: unknown };
  if (w.Capacitor || w.electronAPI) return true;
  if (typeof navigator !== "undefined" && /Electron/i.test(navigator.userAgent)) return true;
  return false;
}

/** Join an API path (or absolute URL) with the resolved API base. */
export function resolveApiUrl(base: string, pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  const b = base.trim().replace(/\/$/, "");
  return b ? `${b}${path}` : path;
}

export function apiUrl(pathOrUrl: string): string {
  return resolveApiUrl(getApiBase(), pathOrUrl);
}

export function getApiBase(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)?.trim().replace(/\/$/, "");
    if (stored) return stored;
  } catch {
    /* ignore */
  }
  if (ENV_API_BASE) return ENV_API_BASE;
  if (isPackagedShell()) return DEFAULT_PROD_API_BASE;
  return "";
}

export function setApiBase(url: string | null | undefined) {
  const cleaned = (url ?? "").trim().replace(/\/$/, "");
  try {
    if (cleaned) localStorage.setItem(STORAGE_KEY, cleaned);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** @deprecated use getApiBase() — kept for call sites that expect a string snapshot. */
export const API_BASE = ENV_API_BASE;

export function getToken(): string | null {
  return localStorage.getItem("lh.token");
}

/** WebSocket URL against the API host (Pages origin has no Worker upgrade). */
export function apiWsUrl(pathWithQuery: string): string {
  const path = pathWithQuery.startsWith("/") ? pathWithQuery : `/${pathWithQuery}`;
  const baseStr = getApiBase();
  if (baseStr) {
    try {
      const base = new URL(baseStr, typeof location !== "undefined" ? location.origin : undefined);
      const proto = base.protocol === "https:" ? "wss:" : "ws:";
      return `${proto}//${base.host}${path}`;
    } catch {
      /* fall through */
    }
  }
  const proto = typeof location !== "undefined" && location.protocol === "https:" ? "wss:" : "ws:";
  const host = typeof location !== "undefined" ? location.host : "localhost";
  return `${proto}//${host}${path}`;
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem("lh.token", token);
  else localStorage.removeItem("lh.token");
}

export type ApiInit = RequestInit & {
  /** Override auth. Default: attach Bearer except for public bible GETs. */
  auth?: boolean;
};

async function readJsonBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    // Packaged apps with empty API_BASE hit index.html → "<!doctype …".
    if (/^\s*</.test(text)) {
      throw new Error("api_html_response");
    }
    throw new Error("invalid_json");
  }
}

function shouldAttachAuth(path: string, init: ApiInit): boolean {
  if (init.auth === true) return true;
  if (init.auth === false) return false;
  const method = String(init.method ?? "GET").toUpperCase();
  return !isPublicBibleGetPath(path, method);
}

export async function api<T>(path: string, init: ApiInit = {}): Promise<T> {
  const { auth: _auth, ...rest } = init;
  const headers = new Headers(rest.headers);
  if (!headers.has("Content-Type") && rest.body && !(rest.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const token = getToken();
  if (token && shouldAttachAuth(path, init)) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const base = getApiBase();
  const res = await fetch(`${base}${path}`, { ...rest, headers });
  const body = await readJsonBody(res);
  if (!res.ok) {
    const err = (body as { error?: string } | null)?.error;
    throw new Error(err ?? "request_failed");
  }
  return body as T;
}

/** GET helper that returns null on 404 instead of throwing. */
export async function apiOptional<T>(path: string, init: ApiInit = {}): Promise<T | null> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token && shouldAttachAuth(path, { ...init, method: init.method ?? "GET" })) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const base = getApiBase();
  const res = await fetch(`${base}${path}`, { ...init, headers });
  if (res.status === 404) return null;
  const body = await readJsonBody(res);
  if (!res.ok) {
    const err = (body as { error?: string } | null)?.error;
    throw new Error(err ?? "request_failed");
  }
  return body as T;
}
