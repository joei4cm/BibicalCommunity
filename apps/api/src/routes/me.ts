import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { profileUpdateSchema, type PrivacySettings } from "@logoshome/shared";
import type { Env } from "../env";
import * as schema from "../db/schema";
import { requireAuth, type AuthVars } from "../middleware/auth";
import { openField, sealField } from "../services/field-crypto";

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
    churches.push({
      churchId: m.churchId,
      name: church?.name ?? null,
      slug: church?.slug ?? null,
      role: m.role,
      verified: m.verified,
      groups: JSON.parse(m.groupIdsJson || "[]"),
    });
  }

  return c.json({
    id: user.id,
    uid: user.uid,
    locale: user.locale,
    theme: user.theme,
    privacy: JSON.parse(user.privacyJson),
    nickname: await openField(c.env, userId, "nickname", user.nicknameCt),
    legalName: await openField(c.env, userId, "legalName", user.legalNameCt),
    signature: await openField(c.env, userId, "signature", user.signatureCt),
    churches,
  });
});

/**
 * Privacy-scoped discovery. UID lookup respects discoverableByUid.
 * Handle search returns empty because only handleHash is stored server-side.
 */
meRoutes.get("/search", async (c) => {
  const q = (c.req.query("q") ?? "").trim();
  if (!q) return c.json({ results: [] });

  const db = drizzle(c.env.DB, { schema });
  const candidate = (
    await db.select().from(schema.users).where(eq(schema.users.uid, q.toUpperCase())).limit(1)
  )[0];

  if (!candidate || candidate.tombstoned) {
    return c.json({ results: [] });
  }

  let privacy: PrivacySettings;
  try {
    privacy = JSON.parse(candidate.privacyJson) as PrivacySettings;
  } catch {
    return c.json({ results: [] });
  }

  if (!privacy.discoverableByUid) {
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
