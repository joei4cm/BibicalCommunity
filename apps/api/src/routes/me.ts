import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { and, eq } from "drizzle-orm";
import {
  createId,
  isChurchAdminRoles,
  parseRolesJson,
  primaryChurchRole,
  profileUpdateSchema,
  vaultKindSchema,
  vaultPutSchema,
} from "@logoshome/shared";
import type { Env } from "../env";
import * as schema from "../db/schema";
import { requireAuth, type AuthVars } from "../middleware/auth";
import { openField, sealField } from "../services/field-crypto";
import { hmacHex } from "../services/crypto";
import { discoveryAllowed, readPrivacy } from "../services/privacy-policy";

export const meRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();

meRoutes.use("*", requireAuth);

meRoutes.get("/", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const userId = c.get("userId");
  const user = (
    await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1)
  )[0];
  if (!user) return c.json({ error: "not_found" }, 404);

  const memberships = await db
    .select()
    .from(schema.churchMembers)
    .where(eq(schema.churchMembers.userId, user.id));

  const churches = [];
  for (const m of memberships) {
    const church = (
      await db.select().from(schema.churches).where(eq(schema.churches.id, m.churchId)).limit(1)
    )[0];
    const roles = parseRolesJson(m.rolesJson, m.role);
    churches.push({
      churchId: m.churchId,
      name: church?.name ?? null,
      slug: church?.slug ?? null,
      role: primaryChurchRole(roles),
      roles,
      verified: m.verified,
      securityMode: church?.securityMode ?? "standard",
      groups: JSON.parse(m.groupIdsJson || "[]"),
    });
  }

  const platformAdmin = user.platformRole === "platform_admin";
  const canAccessAdminConsole =
    platformAdmin ||
    churches.some((ch) => isChurchAdminRoles(ch.roles ?? [ch.role as "member"]));

  return c.json({
    id: user.id,
    uid: user.uid,
    locale: user.locale,
    theme: user.theme,
    privacy: JSON.parse(user.privacyJson),
    nickname: await openField(c.env, userId, "nickname", user.nicknameCt),
    legalName: await openField(c.env, userId, "legalName", user.legalNameCt),
    signature: await openField(c.env, userId, "signature", user.signatureCt),
    platformRole: user.platformRole ?? null,
    platformAdmin,
    canAccessAdminConsole,
    churches,
  });
});

/**
 * Privacy-scoped discovery. UID lookup respects discoverableByUid.
 * Handle lookup uses HANDLE_PEPPER HMAC and respects discoverableByHandle.
 */
meRoutes.get("/search", async (c) => {
  const q = (c.req.query("q") ?? "").trim();
  if (!q) return c.json({ results: [] });

  const db = drizzle(c.env.DB, { schema });
  let via: "uid" | "handle" | null = null;
  let candidate = (
    await db.select().from(schema.users).where(eq(schema.users.uid, q.toUpperCase())).limit(1)
  )[0];
  if (candidate) via = "uid";

  if (!candidate) {
    const pepper = c.env.HANDLE_PEPPER ?? "dev-handle-pepper";
    const handleHash = await hmacHex(pepper, q.toLowerCase());
    candidate = (
      await db.select().from(schema.users).where(eq(schema.users.handleHash, handleHash)).limit(1)
    )[0];
    if (candidate) via = "handle";
  }

  if (!candidate || candidate.tombstoned || !via) {
    return c.json({ results: [] });
  }

  const privacy = readPrivacy(candidate.privacyJson);
  if (!privacy || !discoveryAllowed(privacy, via)) {
    return c.json({ results: [] });
  }

  return c.json({
    results: [
      {
        id: candidate.id,
        uid: candidate.uid,
        nickname: await openField(c.env, candidate.id, "nickname", candidate.nicknameCt),
      },
    ],
  });
});

meRoutes.patch("/", async (c) => {
  const body = profileUpdateSchema.parse(await c.req.json());
  const db = drizzle(c.env.DB, { schema });
  const userId = c.get("userId");
  const patch: Partial<typeof schema.users.$inferInsert> = {};
  if (body.locale) patch.locale = body.locale;
  if (body.theme) patch.theme = body.theme;
  if (body.nickname !== undefined) {
    patch.nicknameCt = await sealField(c.env, userId, "nickname", body.nickname);
  }
  if (body.legalName !== undefined) {
    patch.legalNameCt = await sealField(c.env, userId, "legalName", body.legalName);
  }
  if (body.signature !== undefined) {
    patch.signatureCt = await sealField(c.env, userId, "signature", body.signature);
  }
  if (body.privacy) {
    const user = (
      await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1)
    )[0];
    const current = user ? JSON.parse(user.privacyJson) : {};
    patch.privacyJson = JSON.stringify({ ...current, ...body.privacy });
  }
  await db.update(schema.users).set(patch).where(eq(schema.users.id, userId));
  return c.json({ ok: true });
});

/**
 * GET /v1/me/vault/:kind — opaque client-encrypted blob (reader place / history).
 * Server never sees plaintext pointers.
 */
meRoutes.get("/vault/:kind", async (c) => {
  const kindParsed = vaultKindSchema.safeParse(c.req.param("kind"));
  if (!kindParsed.success) return c.json({ error: "invalid_vault_kind" }, 400);
  const kind = kindParsed.data;
  const db = drizzle(c.env.DB, { schema });
  const userId = c.get("userId");
  const row = (
    await db
      .select()
      .from(schema.userVault)
      .where(and(eq(schema.userVault.userId, userId), eq(schema.userVault.kind, kind)))
      .limit(1)
  )[0];
  if (!row) return c.json({ kind, blob: null });
  return c.json({
    kind,
    blob: {
      ciphertext: row.ciphertext,
      iv: row.iv,
      updatedAt: row.updatedAt,
    },
  });
});

/** PUT /v1/me/vault/:kind — upsert encrypted blob for this account. */
meRoutes.put("/vault/:kind", async (c) => {
  const kindParsed = vaultKindSchema.safeParse(c.req.param("kind"));
  if (!kindParsed.success) return c.json({ error: "invalid_vault_kind" }, 400);
  const kind = kindParsed.data;
  const body = vaultPutSchema.parse(await c.req.json());
  const db = drizzle(c.env.DB, { schema });
  const userId = c.get("userId");
  const now = Date.now();
  const existing = (
    await db
      .select()
      .from(schema.userVault)
      .where(and(eq(schema.userVault.userId, userId), eq(schema.userVault.kind, kind)))
      .limit(1)
  )[0];
  if (existing) {
    await db
      .update(schema.userVault)
      .set({ ciphertext: body.ciphertext, iv: body.iv, updatedAt: now })
      .where(eq(schema.userVault.id, existing.id));
    return c.json({ ok: true, kind, updatedAt: now, id: existing.id });
  }
  const id = createId("vault");
  await db.insert(schema.userVault).values({
    id,
    userId,
    kind,
    ciphertext: body.ciphertext,
    iv: body.iv,
    updatedAt: now,
  });
  return c.json({ ok: true, kind, updatedAt: now, id }, 201);
});

/** List this account's devices (for revoke UX). Recovery material stays client-only. */
meRoutes.get("/devices", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const userId = c.get("userId");
  const currentDeviceId = c.get("deviceId");
  const rows = await db.select().from(schema.devices).where(eq(schema.devices.userId, userId));
  return c.json({
    currentDeviceId,
    devices: rows.map((d) => ({
      id: d.id,
      platform: d.platform,
      name: d.name,
      revoked: d.revoked,
      createdAt: d.createdAt,
      hasIdentityKey: Boolean(d.identityKeyPub),
      isCurrent: d.id === currentDeviceId,
    })),
  });
});

/** Revoke a device: mark revoked + delete its sessions (cannot revoke last current without wipe). */
meRoutes.post("/devices/:deviceId/revoke", async (c) => {
  const deviceId = c.req.param("deviceId");
  const db = drizzle(c.env.DB, { schema });
  const userId = c.get("userId");
  const currentDeviceId = c.get("deviceId");

  const device = (
    await db
      .select()
      .from(schema.devices)
      .where(and(eq(schema.devices.id, deviceId), eq(schema.devices.userId, userId)))
      .limit(1)
  )[0];
  if (!device) return c.json({ error: "not_found" }, 404);
  if (device.revoked) return c.json({ ok: true, alreadyRevoked: true, id: deviceId });

  // Revoking the current device ends this session — allowed, but call out explicitly.
  await db.update(schema.devices).set({ revoked: true }).where(eq(schema.devices.id, deviceId));
  await db.delete(schema.sessions).where(eq(schema.sessions.deviceId, deviceId));

  return c.json({
    ok: true,
    id: deviceId,
    revokedCurrent: deviceId === currentDeviceId,
  });
});
