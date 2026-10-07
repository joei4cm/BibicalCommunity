import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq, inArray } from "drizzle-orm";
import { createId, wipeCommandSchema } from "@logoshome/shared";
import type { Env } from "../env";
import * as schema from "../db/schema";
import { requireAuth, type AuthVars } from "../middleware/auth";
import { randomToken, sha256Hex } from "../services/crypto";

export const adminRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();
adminRoutes.use("*", requireAuth);

adminRoutes.post("/wipe", async (c) => {
  const body = wipeCommandSchema.parse(await c.req.json());
  const db = drizzle(c.env.DB, { schema });
  // Foundation: any authenticated caller can self-wipe; cross-user wipe requires church admin role.
  if (body.userId !== c.get("userId")) {
    const memberships = await db
      .select()
      .from(schema.churchMembers)
      .where(eq(schema.churchMembers.userId, c.get("userId")));
    const isAdmin = memberships.some((m) => m.role === "admin" || m.role === "security_officer");
    if (!isAdmin) return c.json({ error: "forbidden" }, 403);
  }

  const token = randomToken();
  const id = createId("wipe");
  const now = Date.now();
  await db.insert(schema.wipeCommands).values({
    id,
    userId: body.userId,
    deviceId: body.deviceId,
    issuedBy: c.get("userId"),
    reasonCode: body.reasonCode,
    tokenHash: await sha256Hex(token),
    status: "pending",
    issuedAt: now,
    expiresAt: now + 24 * 60 * 60 * 1000,
  });

  // Server-side destruction of ciphertext courier data
  await db.update(schema.users).set({ tombstoned: true }).where(eq(schema.users.id, body.userId));
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, body.userId));

  // Tombstone messages in conversations the wiped user belongs to
  const convoMemberships = await db
    .select({ conversationId: schema.conversationMembers.conversationId })
    .from(schema.conversationMembers)
    .where(eq(schema.conversationMembers.userId, body.userId));
  const conversationIds = convoMemberships.map((m) => m.conversationId);
  if (conversationIds.length > 0) {
    await db
      .update(schema.messages)
      .set({ tombstoned: true, ciphertext: "", ratchetHeader: "" })
      .where(inArray(schema.messages.conversationId, conversationIds));
  }

  // Revoke all devices for the wiped user
  await db.update(schema.devices).set({ revoked: true }).where(eq(schema.devices.userId, body.userId));

  return c.json({ id, wipeToken: token, status: "pending" }, 201);
});

adminRoutes.get("/wipe/pending", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const rows = await db
    .select()
    .from(schema.wipeCommands)
    .where(eq(schema.wipeCommands.userId, c.get("userId")));
  return c.json({
    commands: rows.filter((r) => r.status === "pending").map((r) => ({
      id: r.id,
      deviceId: r.deviceId,
      reasonCode: r.reasonCode,
      expiresAt: r.expiresAt,
    })),
  });
});

adminRoutes.post("/wipe/:id/ack", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  await db
    .update(schema.wipeCommands)
    .set({ status: "completed" })
    .where(eq(schema.wipeCommands.id, c.req.param("id")));
  return c.json({ ok: true });
});
