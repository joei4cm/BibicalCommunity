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
 * TURN: coturn REST / ephemeral-secret (HMAC-SHA1 over `expiry:userid`),
 * or Cloudflare Calls TURN when TURN_CF_KEY_ID + TURN_CF_API_TOKEN are set.
 * WS: browsers cannot set Authorization — pass `?token=` session bearer.
 */

export const callRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();

const DEFAULT_TTL_SEC = 300;
const DEFAULT_TURN_URIS = [
  "stun:stun.cloudflare.com:3478",
  "stun:stun.l.google.com:19302",
];

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

function isTurnUri(uri: string): boolean {
  const u = uri.trim().toLowerCase();
  return u.startsWith("turn:") || u.startsWith("turns:");
}

function isStunUri(uri: string): boolean {
  const u = uri.trim().toLowerCase();
  return u.startsWith("stun:") || u.startsWith("stuns:");
}

function bytesToBase64(bytes: ArrayBuffer): string {
  const u8 = new Uint8Array(bytes);
  let s = "";
  for (const b of u8) s += String.fromCharCode(b);
  return btoa(s);
}

type IceServerJson = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

function buildIceServers(
  uris: string[],
  username?: string,
  credential?: string,
): { iceServers: IceServerJson[]; hasRelay: boolean } {
  const stun = uris.filter(isStunUri);
  const relay = uris.filter(isTurnUri);
  const iceServers: IceServerJson[] = [];
  if (stun.length > 0) iceServers.push({ urls: stun });
  if (relay.length > 0) {
    if (username && credential) {
      iceServers.push({ urls: relay, username, credential });
    } else {
      iceServers.push({ urls: relay });
    }
  }
  return { iceServers, hasRelay: relay.length > 0 };
}

/**
 * Optional Cloudflare Calls TURN:
 * https://developers.cloudflare.com/realtime/turn/generate-credentials/
 */
async function mintCloudflareTurnIce(
  keyId: string,
  apiToken: string,
  ttlSec: number,
): Promise<{
  username: string;
  credential: string;
  uris: string[];
  iceServers: IceServerJson[];
  hasRelay: boolean;
} | null> {
  try {
    const res = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(keyId)}/credentials/generate-ice-servers`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ttl: ttlSec }),
      },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      iceServers?: IceServerJson[];
    };
    const iceServers = json.iceServers ?? [];
    if (iceServers.length === 0) return null;
    const uris: string[] = [];
    let username = "";
    let credential = "";
    for (const s of iceServers) {
      const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
      for (const u of urls) if (u) uris.push(String(u));
      if (s.username) username = s.username;
      if (s.credential) credential = s.credential;
    }
    return {
      username,
      credential,
      uris,
      iceServers,
      hasRelay: uris.some(isTurnUri),
    };
  } catch {
    return null;
  }
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
  const ttl = DEFAULT_TTL_SEC;
  const cfKey = c.env.TURN_CF_KEY_ID;
  const cfToken = c.env.TURN_CF_API_TOKEN;

  // Prefer Cloudflare Calls TURN when configured (real turn: / turns: relays).
  let cfMintFailed = false;
  if (cfKey && cfToken) {
    const minted = await mintCloudflareTurnIce(cfKey, cfToken, ttl);
    if (minted?.hasRelay) {
      return c.json({
        username: minted.username,
        credential: minted.credential,
        ttl,
        uris: minted.uris,
        iceServers: minted.iceServers,
        hasRelay: true,
        provider: "cloudflare-calls",
        note: "Cloudflare Calls TURN credentials (ephemeral).",
      });
    }
    cfMintFailed = true;
  }

  const secret = c.env.TURN_SECRET ?? "dev-turn-secret";
  const uris = parseTurnUris(c.env.TURN_URIS);
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
  const { iceServers, hasRelay } = buildIceServers(uris, username, credential);

  const stunOnlyNote = cfMintFailed
    ? "Cloudflare Calls TURN mint failed — falling back to STUN-only. Check TURN_CF_KEY_ID / TURN_CF_API_TOKEN, or set TURN_URIS with turn: hosts + TURN_SECRET."
    : "No turn:/turns: URI configured — STUN only. Set TURN_URIS with turn: hosts + TURN_SECRET, or TURN_CF_KEY_ID + TURN_CF_API_TOKEN for Cloudflare Calls TURN.";

  return c.json({
    username,
    credential,
    ttl,
    uris,
    iceServers,
    hasRelay,
    provider: hasRelay ? "coturn-hmac" : "stun-only",
    note: hasRelay
      ? "Ephemeral TURN secret (HMAC-SHA1 / coturn REST). Set TURN_URIS to turn:… hosts."
      : stunOnlyNote,
  });
});
