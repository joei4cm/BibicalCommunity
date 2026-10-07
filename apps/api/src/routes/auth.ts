import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { createId, loginSchema, registerSchema, privacySettingsSchema } from "@logoshome/shared";
import type { Env } from "../env";
import * as schema from "../db/schema";
import { hashPassword, hmacHex, randomToken, sha256Hex, verifyPassword } from "../services/crypto";
import { sealField } from "../services/field-crypto";
import type { AuthVars } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";

export const authRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();

authRoutes.post("/register", async (c) => {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }
  const body = registerSchema.parse(raw);
  const pepper = c.env.HANDLE_PEPPER ?? "dev-handle-pepper";
  const handleHash = await hmacHex(pepper, body.handle.toLowerCase());
  const emailHash = body.email ? await hmacHex(pepper, body.email.toLowerCase()) : null;
  const db = drizzle(c.env.DB, { schema });

  const existing = await db.select().from(schema.users).where(eq(schema.users.handleHash, handleHash)).limit(1);
  if (existing[0]) return c.json({ error: "handle_taken" }, 409);

  const userId = createId("usr");
  const deviceId = createId("dev");
  const sessionId = createId("ses");
  const uid = createId("u").slice(0, 12).toUpperCase();
  const now = Date.now();
  const passwordHash = await hashPassword(body.password);
  const privacy = privacySettingsSchema.parse({});

  await db.insert(schema.users).values({
    id: userId,
    uid,
    handleHash,
    emailHash,
    passwordHash,
    nicknameCt: await sealField(c.env, userId, "nickname", body.nickname),
    locale: body.locale,
    theme: "day",
    privacyJson: JSON.stringify(privacy),
    createdAt: now,
  });

  await db.insert(schema.devices).values({
    id: deviceId,
    userId,
    platform: "web",
    name: "Primary",
    createdAt: now,
  });

  const token = randomToken();
  await db.insert(schema.sessions).values({
    id: sessionId,
    userId,
    deviceId,
    tokenHash: await sha256Hex(token),
    expiresAt: now + 30 * 24 * 60 * 60 * 1000,
    createdAt: now,
  });

  return c.json({ token, userId, uid, deviceId, locale: body.locale });
});

authRoutes.post("/login", async (c) => {
  const body = loginSchema.parse(await c.req.json());
  const pepper = c.env.HANDLE_PEPPER ?? "dev-handle-pepper";
  const db = drizzle(c.env.DB, { schema });
  const handleHash = await hmacHex(pepper, body.handleOrEmail.toLowerCase());
  let user = (await db.select().from(schema.users).where(eq(schema.users.handleHash, handleHash)).limit(1))[0];
  if (!user && body.handleOrEmail.includes("@")) {
    const emailHash = await hmacHex(pepper, body.handleOrEmail.toLowerCase());
    user = (await db.select().from(schema.users).where(eq(schema.users.emailHash, emailHash)).limit(1))[0];
  }
  if (!user || user.tombstoned) return c.json({ error: "invalid_credentials" }, 401);
  const ok = await verifyPassword(body.password, user.passwordHash);
  if (!ok) return c.json({ error: "invalid_credentials" }, 401);

  const deviceId = createId("dev");
  const sessionId = createId("ses");
  const now = Date.now();
  await db.insert(schema.devices).values({
    id: deviceId,
    userId: user.id,
    platform: body.platform,
    name: body.deviceName ?? body.platform,
    createdAt: now,
  });
  const token = randomToken();
  await db.insert(schema.sessions).values({
    id: sessionId,
    userId: user.id,
    deviceId,
    tokenHash: await sha256Hex(token),
    expiresAt: now + 30 * 24 * 60 * 60 * 1000,
    createdAt: now,
  });

  return c.json({
    token,
    userId: user.id,
    uid: user.uid,
    deviceId,
    locale: user.locale,
    theme: user.theme,
  });
});

authRoutes.post("/logout", requireAuth, async (c) => {
  const db = drizzle(c.env.DB, { schema });
  await db.delete(schema.sessions).where(eq(schema.sessions.id, c.get("sessionId")));
  return c.json({ ok: true });
});
