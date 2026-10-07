import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { profileUpdateSchema } from "@logoshome/shared";
import type { Env } from "../env";
import * as schema from "../db/schema";
import { requireAuth, type AuthVars } from "../middleware/auth";
export const meRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();

meRoutes.use("*", requireAuth);

meRoutes.get("/", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const user = (
    await db.select().from(schema.users).where(eq(schema.users.id, c.get("userId"))).limit(1)
  )[0];
  if (!user) return c.json({ error: "not_found" }, 404);

  const memberships = await db
    .select()
    .from(schema.churchMembers)
    .where(eq(schema.churchMembers.userId, user.id));

  return c.json({
    id: user.id,
    uid: user.uid,
    locale: user.locale,
    theme: user.theme,
    privacy: JSON.parse(user.privacyJson),
    nickname: user.nicknameCt,
    signature: user.signatureCt,
    churches: memberships.map((m) => ({
      churchId: m.churchId,
      role: m.role,
      verified: m.verified,
      groups: JSON.parse(m.groupIdsJson || "[]"),
    })),
  });
});

meRoutes.patch("/", async (c) => {
  const body = profileUpdateSchema.parse(await c.req.json());
  const db = drizzle(c.env.DB, { schema });
  const patch: Partial<typeof schema.users.$inferInsert> = {};
  if (body.locale) patch.locale = body.locale;
  if (body.theme) patch.theme = body.theme;
  if (body.nickname !== undefined) patch.nicknameCt = body.nickname;
  if (body.legalName !== undefined) patch.legalNameCt = body.legalName;
  if (body.signature !== undefined) patch.signatureCt = body.signature;
  if (body.privacy) {
    const user = (
      await db.select().from(schema.users).where(eq(schema.users.id, c.get("userId"))).limit(1)
    )[0];
    const current = user ? JSON.parse(user.privacyJson) : {};
    patch.privacyJson = JSON.stringify({ ...current, ...body.privacy });
  }
  await db.update(schema.users).set(patch).where(eq(schema.users.id, c.get("userId")));
  return c.json({ ok: true });
});
