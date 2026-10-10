import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { createId } from "@logoshome/shared";
import type { Env } from "../env";
import * as schema from "../db/schema";
import { requireAuth, type AuthVars } from "../middleware/auth";

export const inboxRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();
inboxRoutes.use("*", requireAuth);

inboxRoutes.get("/", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const userId = c.get("userId");
  const unreadOnly = c.req.query("unread") === "1";
  const rows = unreadOnly
    ? await db
        .select()
        .from(schema.inboxMessages)
        .where(and(eq(schema.inboxMessages.userId, userId), isNull(schema.inboxMessages.readAt)))
        .orderBy(desc(schema.inboxMessages.createdAt))
        .limit(100)
    : await db
        .select()
        .from(schema.inboxMessages)
        .where(eq(schema.inboxMessages.userId, userId))
        .orderBy(desc(schema.inboxMessages.createdAt))
        .limit(100);

  return c.json({
    messages: rows.map((m) => ({
      id: m.id,
      kind: m.kind,
      title: m.title,
      body: m.body,
      payload: (() => {
        try {
          return JSON.parse(m.payloadJson || "{}");
        } catch {
          return {};
        }
      })(),
      relatedUserId: m.relatedUserId,
      readAt: m.readAt,
      createdAt: m.createdAt,
    })),
  });
});

inboxRoutes.post("/:id/read", async (c) => {
  const id = c.req.param("id");
  const db = drizzle(c.env.DB, { schema });
  const userId = c.get("userId");
  const row = (
    await db
      .select()
      .from(schema.inboxMessages)
      .where(and(eq(schema.inboxMessages.id, id), eq(schema.inboxMessages.userId, userId)))
      .limit(1)
  )[0];
  if (!row) return c.json({ error: "not_found" }, 404);
  if (!row.readAt) {
    await db
      .update(schema.inboxMessages)
      .set({ readAt: Date.now() })
      .where(eq(schema.inboxMessages.id, id));
  }
  return c.json({ ok: true });
});

inboxRoutes.post("/read-all", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const userId = c.get("userId");
  const unread = await db
    .select()
    .from(schema.inboxMessages)
    .where(and(eq(schema.inboxMessages.userId, userId), isNull(schema.inboxMessages.readAt)));
  const now = Date.now();
  for (const m of unread) {
    await db.update(schema.inboxMessages).set({ readAt: now }).where(eq(schema.inboxMessages.id, m.id));
  }
  return c.json({ ok: true, count: unread.length });
});

/** Lightweight create for signup/approval replies (also used by other modules later). */
inboxRoutes.post("/", async (c) => {
  const body = z
    .object({
      userId: z.string().min(1),
      kind: z.enum(["signup_response", "approval", "notice", "friend_request", "friend_accepted", "calendar_invite"]),
      title: z.string().min(1).max(200),
      body: z.string().max(2000).optional(),
      payload: z.record(z.unknown()).optional(),
      relatedUserId: z.string().optional(),
    })
    .parse(await c.req.json());

  // Only allow writing to self for now (system paths use service helpers).
  if (body.userId !== c.get("userId")) {
    return c.json({ error: "forbidden" }, 403);
  }

  const db = drizzle(c.env.DB, { schema });
  const id = createId("inbox");
  await db.insert(schema.inboxMessages).values({
    id,
    userId: body.userId,
    kind: body.kind,
    title: body.title,
    body: body.body ?? "",
    payloadJson: JSON.stringify(body.payload ?? {}),
    relatedUserId: body.relatedUserId,
    createdAt: Date.now(),
  });
  return c.json({ id }, 201);
});
