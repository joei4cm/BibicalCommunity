import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import type { Env } from "../env";
import * as schema from "../db/schema";
import { requireAuth, type AuthVars } from "../middleware/auth";
import { sha256Hex } from "../services/crypto";
import { isConversationMember } from "../services/access-graph";
import { enforceRateLimit } from "../services/rate-limit";

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
 * Public Open Relay (Metered) — used only when Cloudflare Calls TURN and
 * coturn turn: URIs are unavailable so web/app calls still work cross-NAT.
 * Prefer TURN_CF_* or self-hosted TURN_URIS in production.
 */
export function openRelayIceServers(): {
  iceServers: IceServerJson[];
  uris: string[];
  username: string;
  credential: string;
  hasRelay: true;
  provider: "openrelay-fallback";
} {
  const username = "openrelayproject";
  const credential = "openrelayproject";
  const uris = [
    "stun:stun.l.google.com:19302",
    "stun:stun.cloudflare.com:3478",
    "turn:openrelay.metered.ca:80",
    "turn:openrelay.metered.ca:80?transport=tcp",
    "turn:openrelay.metered.ca:443",
    "turns:openrelay.metered.ca:443?transport=tcp",
  ];
  return {
    username,
    credential,
    uris,
    hasRelay: true,
    provider: "openrelay-fallback",
    iceServers: [
      { urls: ["stun:stun.l.google.com:19302", "stun:stun.cloudflare.com:3478"] },
      {
        urls: [
          "turn:openrelay.metered.ca:80",
          "turn:openrelay.metered.ca:80?transport=tcp",
          "turn:openrelay.metered.ca:443",
          "turns:openrelay.metered.ca:443?transport=tcp",
        ],
        username,
        credential,
      },
    ],
  };
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

  const conversationId = c.req.query("conversationId") ?? "";
  if (!conversationId) return c.json({ error: "conversation_required" }, 400);
  if (!(await isConversationMember(db, conversationId, session.userId))) {
    return c.json({ error: "forbidden" }, 403);
  }

  const convo = (
    await db
      .select()
      .from(schema.conversations)
      .where(eq(schema.conversations.id, conversationId))
      .limit(1)
  )[0];
  const maxPeers = convo?.kind === "dm" ? 2 : 16;

  const callId = c.req.param("callId");
  const id = c.env.CALL_ROOM.idFromName(callId);
  const stub = c.env.CALL_ROOM.get(id);
  const url = new URL(c.req.url);
  url.searchParams.set("userId", session.userId);
  url.searchParams.set("conversationId", conversationId);
  url.searchParams.set("maxPeers", String(maxPeers));
  return stub.fetch(url.toString(), c.req.raw);
});

callRoutes.post("/turn-credentials", requireAuth, async (c) => {
  const rl = await enforceRateLimit(c.env.DB, `calls:turn:${c.get("userId")}`, 30, 60_000);
  if (!rl.ok) {
    return c.json({ error: "rate_limited", retryAfterSec: rl.retryAfterSec }, 429);
  }
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

  if (hasRelay) {
    return c.json({
      username,
      credential,
      ttl,
      uris,
      iceServers,
      hasRelay: true,
      provider: "coturn-hmac",
      note: "Ephemeral TURN secret (HMAC-SHA1 / coturn REST).",
    });
  }

  // Public Open Relay only when explicitly allowed (dev / emergency).
  const allowOpenRelay = String(c.env.ALLOW_OPEN_RELAY_TURN ?? "") === "true";
  if (allowOpenRelay) {
    const fallback = openRelayIceServers();
    const why = cfMintFailed
      ? "Cloudflare Calls TURN mint failed; using public Open Relay fallback."
      : "No TURN_CF_* / turn: URIs; using public Open Relay fallback.";
    return c.json({
      username: fallback.username,
      credential: fallback.credential,
      ttl,
      uris: fallback.uris,
      iceServers: fallback.iceServers,
      hasRelay: true,
      provider: fallback.provider,
      note: why,
    });
  }

  return c.json({
    username,
    credential,
    ttl,
    uris,
    iceServers,
    hasRelay: false,
    provider: cfMintFailed ? "cloudflare-calls-failed" : "stun-only",
    note: cfMintFailed
      ? "Cloudflare Calls TURN mint failed; set TURN_CF_* or ALLOW_OPEN_RELAY_TURN=true."
      : "No turn: relay configured. Set TURN_CF_KEY_ID + TURN_CF_API_TOKEN (or ALLOW_OPEN_RELAY_TURN=true for public fallback).",
  });
});
