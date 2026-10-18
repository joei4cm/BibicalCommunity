import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { and, eq, gt, inArray } from "drizzle-orm";
import { z } from "zod";
import { createId, privacySettingsSchema } from "@logoshome/shared";
import type { Env } from "../env";
import * as schema from "../db/schema";
import { requireAuth, type AuthVars } from "../middleware/auth";
import { openField } from "../services/field-crypto";
export const chatRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();
chatRoutes.use("*", requireAuth);

function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

type MemberRow = { userId: string; lastReadAt: number | null };

/** Latest peer lastReadAt that peers allow sharing (WhatsApp-style read ticks). */
async function sharedPeerLastReadAt(
  db: ReturnType<typeof drizzle>,
  members: MemberRow[],
  selfUserId: string,
): Promise<number | null> {
  const peers = members.filter((m) => m.userId !== selfUserId);
  if (peers.length === 0) return null;
  const users = await db
    .select({ id: schema.users.id, privacyJson: schema.users.privacyJson })
    .from(schema.users)
    .where(
      inArray(
        schema.users.id,
        peers.map((p) => p.userId),
      ),
    );
  const privacyById = new Map(
    users.map((u) => {
      try {
        return [u.id, privacySettingsSchema.parse(JSON.parse(u.privacyJson))] as const;
      } catch {
        return [u.id, privacySettingsSchema.parse({})] as const;
      }
    }),
  );
  let max = 0;
  for (const p of peers) {
    const privacy = privacyById.get(p.userId) ?? privacySettingsSchema.parse({});
    if (!privacy.shareReadReceipts) continue;
    const at = p.lastReadAt ?? 0;
    if (at > max) max = at;
  }
  return max > 0 ? max : null;
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

  const unreadRows = await c.env.DB.prepare(
    `SELECT m.conversation_id AS conversationId, COUNT(*) AS n
     FROM messages m
     INNER JOIN conversation_members cm
       ON cm.conversation_id = m.conversation_id AND cm.user_id = ?
     LEFT JOIN devices d ON d.id = m.sender_device_id
     WHERE IFNULL(cm.archived, 0) = 0
       AND IFNULL(m.tombstoned, 0) = 0
       AND m.content_type = 'msg'
       AND m.created_at > IFNULL(cm.last_read_at, 0)
       AND (d.user_id IS NULL OR d.user_id != ?)
     GROUP BY m.conversation_id`,
  )
    .bind(userId, userId)
    .all<{ conversationId: string; n: number }>();
  const unreadByConvo = new Map<string, number>();
  for (const row of unreadRows.results ?? []) {
    unreadByConvo.set(row.conversationId, Number(row.n ?? 0));
  }

  const lastRows = await c.env.DB.prepare(
    `SELECT conversation_id AS conversationId, MAX(created_at) AS lastAt
     FROM messages
     WHERE IFNULL(tombstoned, 0) = 0
       AND conversation_id IN (
         SELECT conversation_id FROM conversation_members WHERE user_id = ?
       )
     GROUP BY conversation_id`,
  )
    .bind(userId)
    .all<{ conversationId: string; lastAt: number }>();
  const lastAtByConvo = new Map<string, number>();
  for (const row of lastRows.results ?? []) {
    lastAtByConvo.set(row.conversationId, Number(row.lastAt ?? 0));
  }

  const convoIds = memberships.map((m) => m.conversationId);
  const membershipByConvo = new Map(memberships.map((m) => [m.conversationId, m]));

  const convos =
    convoIds.length === 0
      ? []
      : await db
          .select()
          .from(schema.conversations)
          .where(inArray(schema.conversations.id, convoIds));

  const allMembers =
    convoIds.length === 0
      ? []
      : await db
          .select()
          .from(schema.conversationMembers)
          .where(inArray(schema.conversationMembers.conversationId, convoIds));

  const membersByConvo = new Map<string, typeof allMembers>();
  for (const row of allMembers) {
    const list = membersByConvo.get(row.conversationId) ?? [];
    list.push(row);
    membersByConvo.set(row.conversationId, list);
  }

  const peerIds = [
    ...new Set(allMembers.map((m) => m.userId).filter((id) => id !== userId)),
  ];
  const peerUsers =
    peerIds.length === 0
      ? []
      : await db
          .select({
            id: schema.users.id,
            uid: schema.users.uid,
            nicknameCt: schema.users.nicknameCt,
            privacyJson: schema.users.privacyJson,
          })
          .from(schema.users)
          .where(inArray(schema.users.id, peerIds));

  const peerLabelEntries = await Promise.all(
    peerUsers.map(async (u) => {
      const nickname = await openField(c.env, u.id, "nickname", u.nicknameCt);
      return [u.id, { userId: u.id, uid: u.uid, nickname }] as const;
    }),
  );
  const peerLabelById = new Map(peerLabelEntries);

  const privacyById = new Map(
    peerUsers.map((u) => {
      try {
        return [u.id, privacySettingsSchema.parse(JSON.parse(u.privacyJson))] as const;
      } catch {
        return [u.id, privacySettingsSchema.parse({})] as const;
      }
    }),
  );

  function peerLastReadFast(members: MemberRow[]): number | null {
    const peers = members.filter((m) => m.userId !== userId);
    if (peers.length === 0) return null;
    let max = 0;
    for (const p of peers) {
      const privacy = privacyById.get(p.userId) ?? privacySettingsSchema.parse({});
      if (!privacy.shareReadReceipts) continue;
      const at = p.lastReadAt ?? 0;
      if (at > max) max = at;
    }
    return max > 0 ? max : null;
  }

  const conversations = [];
  for (const convo of convos) {
    const m = membershipByConvo.get(convo.id);
    if (!m) continue;
    const members = membersByConvo.get(convo.id) ?? [];
    const peerUserIds = members.map((row) => row.userId).filter((id) => id !== userId);
    conversations.push({
      id: convo.id,
      kind: convo.kind,
      title: convo.title,
      disappearingTtlSec: convo.disappearingTtlSec,
      createdBy: convo.createdBy,
      createdAt: convo.createdAt,
      memberIds: members.map((row) => row.userId),
      peerUserIds,
      peers: peerUserIds
        .map((id) => peerLabelById.get(id))
        .filter((p): p is { userId: string; uid: string; nickname: string | null } => Boolean(p)),
      unreadCount: unreadByConvo.get(convo.id) ?? 0,
      lastMessageAt: lastAtByConvo.get(convo.id) ?? convo.createdAt,
      peerLastReadAt: peerLastReadFast(members),
      membership: {
        id: m.id,
        role: m.role,
        archived: m.archived,
        lastReadAt: m.lastReadAt ?? null,
      },
    });
  }
  return c.json({ conversations });
});

/** Mark a conversation as read up to `at` (default: now). Clears chat badge for that thread. */
chatRoutes.post("/conversations/:id/read", async (c) => {
  const conversationId = c.req.param("id");
  const body = z
    .object({ at: z.number().int().positive().optional() })
    .parse(await c.req.json().catch(() => ({})));
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
  const at = body.at ?? Date.now();
  await db
    .update(schema.conversationMembers)
    .set({ lastReadAt: at })
    .where(eq(schema.conversationMembers.id, member.id));
  return c.json({ ok: true, lastReadAt: at });
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
  const afterRaw = Number(c.req.query("after") ?? "0");
  const after = Number.isFinite(afterRaw) && afterRaw > 0 ? Math.floor(afterRaw) : 0;
  const filters = [
    eq(schema.messages.conversationId, conversationId),
    eq(schema.messages.tombstoned, false),
  ];
  if (after > 0) filters.push(gt(schema.messages.createdAt, after));
  const rows = await db
    .select()
    .from(schema.messages)
    .where(and(...filters));

  // Resolve sender user ids so clients can mark "mine" across devices.
  const senderDeviceIds = Array.from(new Set(rows.map((m) => m.senderDeviceId)));
  const senderDevices =
    senderDeviceIds.length > 0
      ? await db
          .select({ id: schema.devices.id, userId: schema.devices.userId })
          .from(schema.devices)
          .where(inArray(schema.devices.id, senderDeviceIds))
      : [];
  const senderUserByDevice = new Map(senderDevices.map((d) => [d.id, d.userId]));

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
      senderUserId: senderUserByDevice.get(m.senderDeviceId) ?? null,
      ratchetHeader: m.ratchetHeader,
      ciphertext: m.ciphertext,
      contentType: m.contentType,
      createdAt: m.createdAt,
      expiresAt: m.expiresAt,
    });
  }

  // Mark read only when something newer than the stored cursor arrived.
  // Idle polls used to write last_read_at every few seconds.
  const newest = live.reduce((max, m) => Math.max(max, m.createdAt), 0);
  let lastReadAt = member.lastReadAt ?? 0;
  if (newest > lastReadAt) {
    lastReadAt = now;
    await db
      .update(schema.conversationMembers)
      .set({ lastReadAt: now })
      .where(eq(schema.conversationMembers.id, member.id));
  }

  const members = await db
    .select()
    .from(schema.conversationMembers)
    .where(eq(schema.conversationMembers.conversationId, conversationId));
  const peerLastReadAt = await sharedPeerLastReadAt(db, members, c.get("userId"));

  return c.json({ messages: live, lastReadAt, peerLastReadAt });
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
