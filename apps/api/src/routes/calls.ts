import { Hono } from "hono";
import type { Env } from "../env";
import { requireAuth, type AuthVars } from "../middleware/auth";

/**
 * Call / TURN helpers.
 *
 * TURN credentials use the coturn REST / ephemeral-secret pattern
 * (HMAC-SHA1 over `expiry:userid`). Compatible with self-hosted coturn and
 * many managed TURN providers.
 *
 * Cloudflare Calls: for production SFU / managed TURN, prefer Cloudflare Calls
 * (Calls API + TURN) or an external TURN service; set `TURN_SECRET` and
 * `TURN_URIS` (JSON array of URIs). Default STUN-only URI is fine for local
 * / LAN testing but will not traverse restrictive NATs.
 */

export const callRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();
callRoutes.use("*", requireAuth);

const DEFAULT_TTL_SEC = 300;
const DEFAULT_TURN_URIS = ["stun:stun.cloudflare.com:3478"];

function parseTurnUris(raw: string | undefined): string[] {
  if (!raw) return DEFAULT_TURN_URIS;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.every((u) => typeof u === "string")) {
      return parsed.length > 0 ? parsed : DEFAULT_TURN_URIS;
    }
  } catch {
    /* fall through */
  }
  return DEFAULT_TURN_URIS;
}

function bytesToBase64(bytes: ArrayBuffer): string {
  const u8 = new Uint8Array(bytes);
  let s = "";
  for (const b of u8) s += String.fromCharCode(b);
  return btoa(s);
}

/**
 * POST /v1/calls/turn-credentials
 * Returns time-limited TURN username/credential (TTL 300s).
 */
callRoutes.post("/turn-credentials", async (c) => {
  const secret = c.env.TURN_SECRET ?? "dev-turn-secret";
  const uris = parseTurnUris(c.env.TURN_URIS);
  const ttl = DEFAULT_TTL_SEC;
  const expiry = Math.floor(Date.now() / 1000) + ttl;
  const userId = c.get("userId");
  const username = `${expiry}:${userId}`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(username));
  const credential = bytesToBase64(sig);

  return c.json({
    username,
    credential,
    ttl,
    uris,
    iceServers: [
      {
        urls: uris,
        username,
        credential,
      },
    ],
    note:
      "Ephemeral TURN secret (HMAC-SHA1). For production, use Cloudflare Calls or an external TURN provider with TURN_SECRET / TURN_URIS.",
  });
});
