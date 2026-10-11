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

function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

async function areFriends(
  db: ReturnType<typeof drizzle>,
  a: string,
  b: string,
): Promise<boolean> {
  if (a === b) return true;
  const [userAId, userBId] = orderedPair(a, b);
  const row = (
    await db
      .select()
      .from(schema.friendships)
      .where(and(eq(schema.friendships.userAId, userAId), eq(schema.friendships.userBId, userBId)))
      .limit(1)
  )[0];
  return Boolean(row);
}

const createConvoSchema = z.object({
  kind: z.enum(["dm", "group", "seminar"]),
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
  const selfId = c.get("userId");
  const members = Array.from(new Set([selfId, ...body.memberIds]));
  if (body.kind === "dm") {
    const peers = members.filter((id) => id !== selfId);
    if (peers.length !== 1) return c.json({ error: "dm_requires_one_peer" }, 400);
    if (!(await areFriends(db, selfId, peers[0]!))) {
      return c.json({ error: "friends_required" }, 403);
    }
  }
  const id = createId("convo");
  const now = Date.now();
  await db.insert(schema.conversations).values({
    id,
    kind: body.kind,
    title: body.title,
    disappearingTtlSec: body.disappearingTtlSec,
    createdBy: selfId,
    createdAt: now,
  });
  for (const userId of members) {
    await db.insert(schema.conversationMembers).values({
      id: createId("cm"),
      conversationId: id,
      userId,
      role: userId === selfId ? "owner" : "member",
    });
  }
  return c.json({ id }, 201);
});

chatRoutes.get("/conversations", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const userId = c.get("userId");
  const memberships = await db
    .select()
    .from(schema.conversationMembers)
    .where(eq(schema.conversationMembers.userId, userId));

  const conversations = [];
  for (const m of memberships) {
    const convo = (
      await db
        .select()
        .from(schema.conversations)
        .where(eq(schema.conversations.id, m.conversationId))
        .limit(1)
    )[0];
    if (!convo) continue;
    const members = await db
      .select()
      .from(schema.conversationMembers)
      .where(eq(schema.conversationMembers.conversationId, convo.id));
    conversations.push({
      id: convo.id,
      kind: convo.kind,
      title: convo.title,
      disappearingTtlSec: convo.disappearingTtlSec,
      createdBy: convo.createdBy,
      createdAt: convo.createdAt,
      memberIds: members.map((row) => row.userId),
      peerUserIds: members.map((row) => row.userId).filter((id) => id !== userId),
      membership: {
        id: m.id,
        role: m.role,
        archived: m.archived,
      },
    });
  }
  return c.json({ conversations });
});

const patchConvoSchema = z.object({
  disappearingTtlSec: z.number().int().positive().nullable().optional(),
  archived: z.boolean().optional(),
});

chatRoutes.patch("/conversations/:id", async (c) => {
  const body = patchConvoSchema.parse(await c.req.json());
  const conversationId = c.req.param("id");
  const db = drizzle(c.env.DB, { schema });
  const userId = c.get("userId");

  const member = (
    await db
      .select()
      .from(schema.conversationMembers)
      .where(
        and(
          eq(schema.conversationMembers.conversationId, conversationId),
          eq(schema.conversationMembers.userId, userId),
        ),
      )
      .limit(1)
  )[0];
  if (!member) return c.json({ error: "forbidden" }, 403);

  // TTL is owner-only; archive is per-member (hide from own inbox).
  if (body.disappearingTtlSec !== undefined) {
    if (member.role !== "owner") return c.json({ error: "forbidden" }, 403);
    await db
      .update(schema.conversations)
      .set({ disappearingTtlSec: body.disappearingTtlSec })
      .where(eq(schema.conversations.id, conversationId));
  }
  if (body.archived !== undefined) {
    await db
      .update(schema.conversationMembers)
      .set({ archived: body.archived })
      .where(eq(schema.conversationMembers.id, member.id));
  }

  const convo = (
    await db.select().from(schema.conversations).where(eq(schema.conversations.id, conversationId)).limit(1)
  )[0];
  const updatedMember = (
    await db
      .select()
      .from(schema.conversationMembers)
      .where(eq(schema.conversationMembers.id, member.id))
      .limit(1)
  )[0];

  return c.json({
    id: conversationId,
    disappearingTtlSec: convo?.disappearingTtlSec ?? null,
    membership: {
      id: updatedMember?.id ?? member.id,
      role: updatedMember?.role ?? member.role,
      archived: updatedMember?.archived ?? member.archived,
    },
  });
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
  if (convo?.kind === "dm") {
    const selfId = c.get("userId");
    const members = await db
      .select()
      .from(schema.conversationMembers)
      .where(eq(schema.conversationMembers.conversationId, conversationId));
    const peer = members.map((m) => m.userId).find((id) => id !== selfId);
    if (peer && !(await areFriends(db, selfId, peer))) {
      return c.json({ error: "friends_required" }, 403);
    }
  }
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

  const now = Date.now();
  const rows = await db
    .select()
    .from(schema.messages)
    .where(and(eq(schema.messages.conversationId, conversationId), eq(schema.messages.tombstoned, false)));

  // Disappearing messages: tombstone expired rows and omit ciphertext from the response.
  const live = [];
  for (const m of rows) {
    if (m.expiresAt != null && m.expiresAt <= now) {
      await db
        .update(schema.messages)
        .set({ tombstoned: true, ratchetHeader: "", ciphertext: "" })
        .where(eq(schema.messages.id, m.id));
      continue;
    }
    live.push({
      id: m.id,
      senderDeviceId: m.senderDeviceId,
      ratchetHeader: m.ratchetHeader,
      ciphertext: m.ciphertext,
      contentType: m.contentType,
      createdAt: m.createdAt,
      expiresAt: m.expiresAt,
    });
  }

  return c.json({ messages: live });
});

const favoriteSchema = z.object({
  messageId: z.string().min(1),
  ciphertext: z.string().min(1),
  iv: z.string().min(1),
});

chatRoutes.post("/favorites", async (c) => {
  const body = favoriteSchema.parse(await c.req.json());
  const db = drizzle(c.env.DB, { schema });
  const id = createId("fav");
  await db.insert(schema.messageFavorites).values({
    id,
    userId: c.get("userId"),
    messageId: body.messageId,
    ciphertext: body.ciphertext,
    iv: body.iv,
    createdAt: Date.now(),
  });
  return c.json({ id }, 201);
});

chatRoutes.get("/favorites", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const rows = await db
    .select()
    .from(schema.messageFavorites)
    .where(eq(schema.messageFavorites.userId, c.get("userId")));
  return c.json({
    favorites: rows.map((f) => ({
      id: f.id,
      messageId: f.messageId,
      ciphertext: f.ciphertext,
      iv: f.iv,
      createdAt: f.createdAt,
    })),
  });
});

chatRoutes.post("/calls", async (c) => {
  const body = z
    .object({ conversationId: z.string(), callId: z.string().optional() })
    .parse(await c.req.json());
  // Deterministic room so both peers join the same signaling DO.
  const callId = body.callId ?? `call_${body.conversationId}`;
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
