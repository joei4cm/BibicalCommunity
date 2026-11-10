/** Local identity keys tied to a signed-in session (keep lh.apiBase / prefs / deviceId). */
const SESSION_KEYS = ["lh.token", "lh.uid", "lh.userId", "lh.nickname"] as const;

/**
 * Drop the client session without wiping device id / API base / reader prefs.
 * Used when the server rejects the Bearer token so the user can sign in again.
 */
export function clearAuthSession(): void {
  try {
    for (const key of SESSION_KEYS) {
      localStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
}

export function isUnauthorizedError(status: number, error?: string | null): boolean {
  if (status === 401) return true;
  return error === "unauthorized" || error === "401";
}

/** Notify the shell that the Bearer session is gone (Comms gates / AuthGate). */
export function emitAuthLost(error = "unauthorized"): void {
  try {
    window.dispatchEvent(new CustomEvent("lh:auth-lost", { detail: { error } }));
  } catch {
    /* ignore */
  }
}
