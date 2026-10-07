import { Hono } from "hono";
import { createId } from "@logoshome/shared";
import type { Env } from "../env";
import { requireAuth, type AuthVars } from "../middleware/auth";

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export const mediaRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();
mediaRoutes.use("*", requireAuth);

/** Mint an object key and Worker-proxy PUT path (local R2 often skips S3 presign). */
mediaRoutes.post("/upload-url", async (c) => {
  const userId = c.get("userId");
  const key = `media/${userId}/${createId()}`;
  return c.json({
    key,
    putUrl: `/v1/media/put/${key}`,
  });
});

mediaRoutes.put("/put/*", async (c) => {
  const splat = c.req.param("*");
  const objectKey = Array.isArray(splat) ? splat.join("/") : (splat ?? "");
  if (!objectKey) return c.json({ error: "missing_key" }, 400);

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

  await c.env.MEDIA.put(objectKey, body, {
    httpMetadata: { contentType },
  });

  return c.json({ ok: true, key: objectKey, bytes: body.byteLength });
});

/** Stream private encrypted blob — still requires auth. */
mediaRoutes.get("/*", async (c) => {
  const splat = c.req.param("*");
  const key = Array.isArray(splat) ? splat.join("/") : (splat ?? "");
  if (!key || key === "upload-url" || key.startsWith("put/")) {
    return c.json({ error: "not_found" }, 404);
  }

  const obj = await c.env.MEDIA.get(key);
  if (!obj) return c.json({ error: "not_found" }, 404);

  const headers = new Headers();
  headers.set("Content-Type", obj.httpMetadata?.contentType ?? "application/octet-stream");
  if (obj.size != null) headers.set("Content-Length", String(obj.size));
  if (obj.httpEtag) headers.set("ETag", obj.httpEtag);

  return new Response(obj.body, { status: 200, headers });
});
