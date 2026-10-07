import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { createId } from "@logoshome/shared";
import type { Env } from "../env";
import * as schema from "../db/schema";
import { requireAuth, type AuthVars } from "../middleware/auth";
export const chatRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();
chatRoutes.use("*", requireAuth);

const createConvoSchema = z.object({
  kind: z.enum(["dm", "group"]),
  title: z.string().optional(),
  memberIds: z.array(z.string()).min(1),
  disappearingTtlSec: z.number().int().positive().optional(),
});

const sendMessageSchema = z.object({
  ratchetHeader: z.string(),
  ciphertext: z.string(),
  contentType: z.enum(["msg", "receipt", "wipe", "control"]).default("msg"),
  expiresAt: z.number().optional(),
});

chatRoutes.post("/conversations", async (c) => {
  const body = createConvoSchema.parse(await c.req.json());
  const db = drizzle(c.env.DB, { schema });
  const id = createId("convo");
  const now = Date.now();
  await db.insert(schema.conversations).values({
    id,
    kind: body.kind,
    title: body.title,
    disappearingTtlSec: body.disappearingTtlSec,
    createdBy: c.get("userId"),
    createdAt: now,
  });
  const members = Array.from(new Set([c.get("userId"), ...body.memberIds]));
  for (const userId of members) {
    await db.insert(schema.conversationMembers).values({
      id: createId("cm"),
      conversationId: id,
      userId,
      role: userId === c.get("userId") ? "owner" : "member",
    });
  }
  return c.json({ id }, 201);
});

chatRoutes.post("/conversations/:id/messages", async (c) => {
  const body = sendMessageSchema.parse(await c.req.json());
  const conversationId = c.req.param("id");
  const db = drizzle(c.env.DB, { schema });
  const member = (
    await db
      .select()
      .from(schema.conversationMembers)
      .where(
        and(
          eq(schema.conversationMembers.conversationId, conversationId),
          eq(schema.conversationMembers.userId, c.get("userId")),
        ),
      )
      .limit(1)
  )[0];
  if (!member) return c.json({ error: "forbidden" }, 403);

  const convo = (
    await db.select().from(schema.conversations).where(eq(schema.conversations.id, conversationId)).limit(1)
  )[0];
  const expiresAt =
    body.expiresAt ??
    (convo?.disappearingTtlSec ? Date.now() + convo.disappearingTtlSec * 1000 : undefined);

  const id = createId("msg");
  await db.insert(schema.messages).values({
    id,
    conversationId,
    senderDeviceId: c.get("deviceId"),
    ratchetHeader: body.ratchetHeader,
    ciphertext: body.ciphertext,
    contentType: body.contentType,
    createdAt: Date.now(),
    expiresAt,
  });
  return c.json({ id, expiresAt }, 201);
});

chatRoutes.get("/conversations/:id/messages", async (c) => {
  const conversationId = c.req.param("id");
  const db = drizzle(c.env.DB, { schema });
  const member = (
    await db
      .select()
      .from(schema.conversationMembers)
      .where(
        and(
          eq(schema.conversationMembers.conversationId, conversationId),
          eq(schema.conversationMembers.userId, c.get("userId")),
        ),
      )
      .limit(1)
  )[0];
  if (!member) return c.json({ error: "forbidden" }, 403);

  const rows = await db
    .select()
    .from(schema.messages)
    .where(and(eq(schema.messages.conversationId, conversationId), eq(schema.messages.tombstoned, false)));

  return c.json({
    messages: rows.map((m) => ({
      id: m.id,
      senderDeviceId: m.senderDeviceId,
      ratchetHeader: m.ratchetHeader,
      ciphertext: m.ciphertext,
      contentType: m.contentType,
      createdAt: m.createdAt,
      expiresAt: m.expiresAt,
    })),
  });
});

chatRoutes.post("/calls", async (c) => {
  const body = z
    .object({ conversationId: z.string(), callId: z.string().optional() })
    .parse(await c.req.json());
  const callId = body.callId ?? createId("call");
  const id = c.env.CALL_ROOM.idFromName(callId);
  const stub = c.env.CALL_ROOM.get(id);
  const url = new URL(c.req.url);
  url.pathname = `/room/${callId}`;
  url.searchParams.set("conversationId", body.conversationId);
  url.searchParams.set("userId", c.get("userId"));
  // Auth already verified; DO handles WS fan-out of SDP/ICE only.
  return c.json({
    callId,
    signalingPath: `/v1/calls/${callId}/ws`,
    note: "Media is P2P WebRTC after signaling; TURN credentials minted separately.",
    doId: id.toString(),
    probe: await (await stub.fetch(url)).json(),
  });
});
