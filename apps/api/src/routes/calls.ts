import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import type { Env } from "../env";
import * as schema from "../db/schema";
import { requireAuth, type AuthVars } from "../middleware/auth";
import { sha256Hex } from "../services/crypto";

/**
 * Call / TURN helpers + CallRoom DO WebSocket upgrade.
 *
 * TURN: coturn REST / ephemeral-secret (HMAC-SHA1 over `expiry:userid`).
 * WS: browsers cannot set Authorization — pass `?token=` session bearer.
 */

export const callRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();

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
 * GET /v1/calls/:callId/ws?token=…&conversationId=…
 * Proxies WebSocket upgrade to CallRoomDO (SDP/ICE fan-out only).
 */
callRoutes.get("/:callId/ws", async (c) => {
  if (c.req.header("Upgrade")?.toLowerCase() !== "websocket") {
    return c.text("Expected Upgrade: websocket", 426);
  }
  const token = c.req.query("token");
  if (!token) return c.json({ error: "token_required" }, 401);
  const tokenHash = await sha256Hex(token);
  const db = drizzle(c.env.DB, { schema });
  const session = (
    await db.select().from(schema.sessions).where(eq(schema.sessions.tokenHash, tokenHash)).limit(1)
  )[0];
  if (!session || session.expiresAt < Date.now()) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const callId = c.req.param("callId");
  const id = c.env.CALL_ROOM.idFromName(callId);
  const stub = c.env.CALL_ROOM.get(id);
  const url = new URL(c.req.url);
  url.searchParams.set("userId", session.userId);
  if (!url.searchParams.get("conversationId")) {
    url.searchParams.set("conversationId", c.req.query("conversationId") ?? "");
  }
  return stub.fetch(url.toString(), c.req.raw);
});

callRoutes.post("/turn-credentials", requireAuth, async (c) => {
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
