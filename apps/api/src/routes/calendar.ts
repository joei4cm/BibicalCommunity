import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { and, eq, gte, lte, or } from "drizzle-orm";
import { z } from "zod";
import { createId } from "@logoshome/shared";
import type { Env } from "../env";
import * as schema from "../db/schema";
import { requireAuth, type AuthVars } from "../middleware/auth";

export const calendarRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();
calendarRoutes.use("*", requireAuth);

const createSchema = z.object({
  title: z.string().min(1).max(200),
  notes: z.string().max(2000).optional(),
  startAt: z.number().int(),
  endAt: z.number().int().optional(),
  allDay: z.boolean().optional(),
  inviteeIds: z.array(z.string()).max(50).optional(),
});

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  notes: z.string().max(2000).nullable().optional(),
  startAt: z.number().int().optional(),
  endAt: z.number().int().nullable().optional(),
  allDay: z.boolean().optional(),
});

calendarRoutes.get("/events", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const userId = c.get("userId");
  const fromRaw = c.req.query("from");
  const toRaw = c.req.query("to");
  const from = fromRaw ? Number(fromRaw) : Date.now() - 7 * 86400000;
  const to = toRaw ? Number(toRaw) : Date.now() + 62 * 86400000;

  const owned = await db
    .select()
    .from(schema.calendarEvents)
    .where(
      and(
        eq(schema.calendarEvents.ownerUserId, userId),
        gte(schema.calendarEvents.startAt, from),
        lte(schema.calendarEvents.startAt, to),
      ),
    );

  const invites = await db
    .select()
    .from(schema.calendarInvites)
    .where(
      and(
        eq(schema.calendarInvites.inviteeUserId, userId),
        or(
          eq(schema.calendarInvites.status, "pending"),
          eq(schema.calendarInvites.status, "accepted"),
        ),
      ),
    );

  const invitedEvents = [];
  for (const inv of invites) {
    const ev = (
      await db
        .select()
        .from(schema.calendarEvents)
        .where(eq(schema.calendarEvents.id, inv.eventId))
        .limit(1)
    )[0];
    if (!ev) continue;
    if (ev.startAt < from || ev.startAt > to) continue;
    invitedEvents.push({
      id: ev.id,
      title: ev.title,
      notes: ev.notes,
      startAt: ev.startAt,
      endAt: ev.endAt,
      allDay: ev.allDay,
      source: "invited" as const,
      inviteStatus: inv.status,
      inviteId: inv.id,
      ownerUserId: ev.ownerUserId,
      mine: false,
    });
  }

  const events = [
    ...owned.map((ev) => ({
      id: ev.id,
      title: ev.title,
      notes: ev.notes,
      startAt: ev.startAt,
      endAt: ev.endAt,
      allDay: ev.allDay,
      source: (ev.source === "invited" ? "local" : ev.source) as "local" | "invited",
      inviteStatus: null as string | null,
      inviteId: null as string | null,
      ownerUserId: ev.ownerUserId,
      mine: true,
    })),
    ...invitedEvents,
  ].sort((a, b) => a.startAt - b.startAt);

  return c.json({ events });
});

calendarRoutes.post("/events", async (c) => {
  const body = createSchema.parse(await c.req.json());
  const db = drizzle(c.env.DB, { schema });
  const userId = c.get("userId");
  const id = createId("cal");
  const now = Date.now();
  await db.insert(schema.calendarEvents).values({
    id,
    ownerUserId: userId,
    title: body.title,
    notes: body.notes,
    startAt: body.startAt,
    endAt: body.endAt,
    allDay: body.allDay ?? false,
    source: "local",
    createdAt: now,
    updatedAt: now,
  });

  const inviteeIds = [...new Set((body.inviteeIds ?? []).filter((x) => x !== userId))];
  for (const inviteeId of inviteeIds) {
    const inviteId = createId("cinv");
    await db.insert(schema.calendarInvites).values({
      id: inviteId,
      eventId: id,
      inviteeUserId: inviteeId,
      status: "pending",
      createdAt: now,
    });
    await db.insert(schema.inboxMessages).values({
      id: createId("inbox"),
      userId: inviteeId,
      kind: "calendar_invite",
      title: "日程邀请",
      body: `你被邀请参加：${body.title}`,
      payloadJson: JSON.stringify({ eventId: id, inviteId }),
      relatedUserId: userId,
      createdAt: now,
    });
  }

  return c.json({ id }, 201);
});

calendarRoutes.patch("/events/:id", async (c) => {
  const eventId = c.req.param("id");
  const body = patchSchema.parse(await c.req.json());
  const db = drizzle(c.env.DB, { schema });
  const userId = c.get("userId");
  const ev = (
    await db
      .select()
      .from(schema.calendarEvents)
      .where(eq(schema.calendarEvents.id, eventId))
      .limit(1)
  )[0];
  if (!ev) return c.json({ error: "not_found" }, 404);
  if (ev.ownerUserId !== userId) return c.json({ error: "forbidden" }, 403);

  const patch: Partial<typeof schema.calendarEvents.$inferInsert> = { updatedAt: Date.now() };
  if (body.title !== undefined) patch.title = body.title;
  if (body.notes !== undefined) patch.notes = body.notes;
  if (body.startAt !== undefined) patch.startAt = body.startAt;
  if (body.endAt !== undefined) patch.endAt = body.endAt;
  if (body.allDay !== undefined) patch.allDay = body.allDay;

  await db.update(schema.calendarEvents).set(patch).where(eq(schema.calendarEvents.id, eventId));
  return c.json({ ok: true });
});

calendarRoutes.delete("/events/:id", async (c) => {
  const eventId = c.req.param("id");
  const db = drizzle(c.env.DB, { schema });
  const userId = c.get("userId");
  const ev = (
    await db
      .select()
      .from(schema.calendarEvents)
      .where(eq(schema.calendarEvents.id, eventId))
      .limit(1)
  )[0];
  if (!ev) return c.json({ error: "not_found" }, 404);
  if (ev.ownerUserId !== userId) return c.json({ error: "forbidden" }, 403);

  await db.delete(schema.calendarInvites).where(eq(schema.calendarInvites.eventId, eventId));
  await db.delete(schema.calendarEvents).where(eq(schema.calendarEvents.id, eventId));
  return c.json({ ok: true });
});

calendarRoutes.post("/invites/:id/respond", async (c) => {
  const inviteId = c.req.param("id");
  const body = z.object({ accept: z.boolean() }).parse(await c.req.json());
  const db = drizzle(c.env.DB, { schema });
  const userId = c.get("userId");
  const inv = (
    await db
      .select()
      .from(schema.calendarInvites)
      .where(eq(schema.calendarInvites.id, inviteId))
      .limit(1)
  )[0];
  if (!inv) return c.json({ error: "not_found" }, 404);
  if (inv.inviteeUserId !== userId) return c.json({ error: "forbidden" }, 403);

  await db
    .update(schema.calendarInvites)
    .set({ status: body.accept ? "accepted" : "declined", respondedAt: Date.now() })
    .where(eq(schema.calendarInvites.id, inviteId));

  return c.json({ ok: true, status: body.accept ? "accepted" : "declined" });
});
