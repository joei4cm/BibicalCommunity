import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { createId, isOwnedMediaKey } from "@logoshome/shared";
import type { Env } from "../env";
import { requireMedia } from "../media-binding";
import { requireAuth, type AuthVars } from "../middleware/auth";
import * as schema from "../db/schema";
import { mediaKeyReadableByUser } from "../services/access-graph";

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export const mediaRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();
mediaRoutes.use("*", requireAuth);

function keyFromPath(pathname: string, marker: string): string {
  const idx = pathname.indexOf(marker);
  if (idx < 0) return "";
  return decodeURIComponent(pathname.slice(idx + marker.length)).replace(/^\/+/, "");
}

/** Mint an object key and Worker-proxy PUT path (local R2 often skips S3 presign). */
mediaRoutes.post("/upload-url", async (c) => {
  const userId = c.get("userId");
  const key = `media/${userId}/${createId()}`;
  return c.json({
    key,
    putUrl: `/v1/media/put/${key}`,
  });
});

/** PUT /v1/media/put/<objectKey> — objectKey may contain slashes; must be owned. */
mediaRoutes.put("/put/*", async (c) => {
  const objectKey = keyFromPath(new URL(c.req.url).pathname, "/v1/media/put/");
  if (!objectKey) return c.json({ error: "missing_key" }, 400);
  if (!isOwnedMediaKey(objectKey, c.get("userId"))) {
    return c.json({ error: "media_key_forbidden" }, 403);
  }

  const contentLengthHeader = c.req.header("content-length");
  if (contentLengthHeader) {
    const len = Number(contentLengthHeader);
    if (!Number.isFinite(len) || len < 0) {
      return c.json({ error: "invalid_content_length" }, 400);
    }
    if (len > MAX_UPLOAD_BYTES) {
      return c.json({ error: "payload_too_large", maxBytes: MAX_UPLOAD_BYTES }, 413);
    }
  }

  const contentType = c.req.header("content-type") ?? "application/octet-stream";
  const body = await c.req.arrayBuffer();
  if (body.byteLength > MAX_UPLOAD_BYTES) {
    return c.json({ error: "payload_too_large", maxBytes: MAX_UPLOAD_BYTES }, 413);
  }

  const media = requireMedia(c);
  if (media instanceof Response) return media;

  await media.put(objectKey, body, {
    httpMetadata: { contentType },
  });

  return c.json({ ok: true, key: objectKey, bytes: body.byteLength });
});

/**
 * Stream private blob — owner, conversation peer (owner of key must share the
 * conversation), or church member who can see a forum post referencing this key.
 */
mediaRoutes.get("/*", async (c) => {
  const key = keyFromPath(new URL(c.req.url).pathname, "/v1/media/");
  if (!key || key === "upload-url" || key.startsWith("put/")) {
    return c.json({ error: "not_found" }, 404);
  }

  const db = drizzle(c.env.DB, { schema });
  const conversationId = c.req.query("conversationId");
  const allowed = await mediaKeyReadableByUser(db, c.get("userId"), key, conversationId);
  if (!allowed) return c.json({ error: "forbidden" }, 403);

  const media = requireMedia(c);
  if (media instanceof Response) return media;
  const obj = await media.get(key);
  if (!obj) return c.json({ error: "not_found" }, 404);

  const headers = new Headers();
  headers.set("Content-Type", obj.httpMetadata?.contentType ?? "application/octet-stream");
  if (obj.size != null) headers.set("Content-Length", String(obj.size));
  if (obj.httpEtag) headers.set("ETag", obj.httpEtag);

  return new Response(obj.body, { status: 200, headers });
});
