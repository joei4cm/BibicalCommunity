import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { and, eq, or } from "drizzle-orm";
import { z } from "zod";
import { createId, isChurchAdminRoles, parseRolesJson } from "@logoshome/shared";
import type { Env } from "../env";
import * as schema from "../db/schema";
import { requireAuth, type AuthVars } from "../middleware/auth";
import { hmacHex } from "../services/crypto";
import { openField } from "../services/field-crypto";
import { buildOrgTree } from "../services/church-access";
import { messageRequestAllowed, readPrivacy } from "../services/privacy-policy";

export const friendsRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();
friendsRoutes.use("*", requireAuth);

function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

async function publicUser(
  env: Env,
  user: typeof schema.users.$inferSelect,
): Promise<{ id: string; uid: string; nickname: string | null; signature: string | null }> {
  return {
    id: user.id,
    uid: user.uid,
    nickname: await openField(env, user.id, "nickname", user.nicknameCt),
    signature: await openField(env, user.id, "signature", user.signatureCt),
  };
}

async function resolveUserByQuery(
  db: ReturnType<typeof drizzle>,
  env: Env,
  query: string,
): Promise<typeof schema.users.$inferSelect | null> {
  const q = query.trim();
  if (!q) return null;

  if (q.startsWith("usr_") || q.length > 20) {
    const byId = (
      await db.select().from(schema.users).where(eq(schema.users.id, q)).limit(1)
    )[0];
    if (byId && !byId.tombstoned) return byId;
  }

  const byUid = (
    await db.select().from(schema.users).where(eq(schema.users.uid, q.toUpperCase())).limit(1)
  )[0];
  if (byUid && !byUid.tombstoned) return byUid;

  const pepper = env.HANDLE_PEPPER ?? "dev-handle-pepper";
  const handleHash = await hmacHex(pepper, q.toLowerCase());
  const byHandle = (
    await db.select().from(schema.users).where(eq(schema.users.handleHash, handleHash)).limit(1)
  )[0];
  if (byHandle && !byHandle.tombstoned) return byHandle;

  return null;
}

async function pushInbox(
  db: ReturnType<typeof drizzle>,
  opts: {
    userId: string;
    kind: string;
    title: string;
    body?: string;
    relatedUserId?: string;
    payload?: Record<string, unknown>;
  },
) {
  await db.insert(schema.inboxMessages).values({
    id: createId("inbox"),
    userId: opts.userId,
    kind: opts.kind,
    title: opts.title,
    body: opts.body ?? "",
    payloadJson: JSON.stringify(opts.payload ?? {}),
    relatedUserId: opts.relatedUserId,
    createdAt: Date.now(),
  });
}

friendsRoutes.get("/", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const userId = c.get("userId");
  const rows = await db
    .select()
    .from(schema.friendships)
    .where(or(eq(schema.friendships.userAId, userId), eq(schema.friendships.userBId, userId)));

  const friends = [];
  for (const row of rows) {
    const peerId = row.userAId === userId ? row.userBId : row.userAId;
    const peer = (
      await db.select().from(schema.users).where(eq(schema.users.id, peerId)).limit(1)
    )[0];
    if (!peer || peer.tombstoned) continue;
    friends.push({
      friendshipId: row.id,
      createdAt: row.createdAt,
      user: await publicUser(c.env, peer),
    });
  }
  return c.json({ friends });
});

friendsRoutes.get("/requests", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const userId = c.get("userId");
  const incoming = await db
    .select()
    .from(schema.friendRequests)
    .where(
      and(eq(schema.friendRequests.toUserId, userId), eq(schema.friendRequests.status, "pending")),
    );
  const outgoing = await db
    .select()
    .from(schema.friendRequests)
    .where(
      and(eq(schema.friendRequests.fromUserId, userId), eq(schema.friendRequests.status, "pending")),
    );

  async function enrich(rows: typeof incoming, peerKey: "fromUserId" | "toUserId") {
    const out = [];
    for (const row of rows) {
      const peer = (
        await db.select().from(schema.users).where(eq(schema.users.id, row[peerKey])).limit(1)
      )[0];
      if (!peer) continue;
      out.push({
        id: row.id,
        status: row.status,
        message: row.message,
        createdAt: row.createdAt,
        user: await publicUser(c.env, peer),
      });
    }
    return out;
  }

  return c.json({
    incoming: await enrich(incoming, "fromUserId"),
    outgoing: await enrich(outgoing, "toUserId"),
  });
});

/** Visible contacts from churches you belong to (org directory), plus accepted friends. */
friendsRoutes.get("/directory", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const userId = c.get("userId");
  const memberships = await db
    .select()
    .from(schema.churchMembers)
    .where(eq(schema.churchMembers.userId, userId));

  const byUser = new Map<
    string,
    {
      userId: string;
      uid: string | null;
      nickname: string | null;
      signature: string | null;
      roles: string[];
      groupNames: string[];
      churches: string[];
      source: "directory" | "friend";
    }
  >();

  for (const m of memberships) {
    try {
      const tree = await buildOrgTree(db, c.env, m.churchId, userId);
      const walk = (nodes: typeof tree.tree) => {
        for (const node of nodes) {
          for (const p of node.members) {
            const existing = byUser.get(p.userId);
            const groupNames = existing?.groupNames ?? [];
            if (!groupNames.includes(node.name)) groupNames.push(node.name);
            byUser.set(p.userId, {
              userId: p.userId,
              uid: p.uid,
              nickname: p.nickname,
              signature: (p as { signature?: string | null }).signature ?? existing?.signature ?? null,
              roles: [...new Set([...(existing?.roles ?? []), ...p.roles])],
              groupNames,
              churches: [...new Set([...(existing?.churches ?? []), tree.church.name])],
              source: "directory",
            });
          }
          walk(node.children);
        }
      };
      walk(tree.tree);
      for (const p of tree.leaders) {
        if (byUser.has(p.userId)) continue;
        byUser.set(p.userId, {
          userId: p.userId,
          uid: p.uid,
          nickname: p.nickname,
          signature: (p as { signature?: string | null }).signature ?? null,
          roles: p.roles,
          groupNames: [],
          churches: [tree.church.name],
          source: "directory",
        });
      }
    } catch {
      /* skip churches viewer cannot load */
    }
  }

  const friendRows = await db
    .select()
    .from(schema.friendships)
    .where(or(eq(schema.friendships.userAId, userId), eq(schema.friendships.userBId, userId)));
  for (const row of friendRows) {
    const peerId = row.userAId === userId ? row.userBId : row.userAId;
    if (byUser.has(peerId)) {
      byUser.get(peerId)!.source = "friend";
      continue;
    }
    const peer = (
      await db.select().from(schema.users).where(eq(schema.users.id, peerId)).limit(1)
    )[0];
    if (!peer || peer.tombstoned) continue;
    const pub = await publicUser(c.env, peer);
    byUser.set(peerId, {
      userId: pub.id,
      uid: pub.uid,
      nickname: pub.nickname,
      signature: pub.signature,
      roles: [],
      groupNames: [],
      churches: [],
      source: "friend",
    });
  }

  byUser.delete(userId);
  return c.json({ contacts: [...byUser.values()] });
});

const requestSchema = z.object({
  query: z.string().min(1).optional(),
  userId: z.string().min(1).optional(),
  /** Free-text intros are not stored (audit: plaintext on D1). Accepted then discarded. */
  message: z.string().max(280).optional(),
});

friendsRoutes.post("/request", async (c) => {
  const body = requestSchema.parse(await c.req.json());
  const db = drizzle(c.env.DB, { schema });
  const fromUserId = c.get("userId");
  const target =
    body.userId != null
      ? (
          await db.select().from(schema.users).where(eq(schema.users.id, body.userId)).limit(1)
        )[0] ?? null
      : await resolveUserByQuery(db, c.env, body.query ?? "");

  if (!target || target.tombstoned) return c.json({ error: "user_not_found" }, 404);
  if (target.id === fromUserId) return c.json({ error: "cannot_friend_self" }, 400);

  const targetPrivacy = readPrivacy(target.privacyJson);
  if (!targetPrivacy) return c.json({ error: "message_requests_closed" }, 403);
  const [fromMemberships, targetMemberships, requesterRows] = await Promise.all([
    db.select().from(schema.churchMembers).where(eq(schema.churchMembers.userId, fromUserId)),
    db.select().from(schema.churchMembers).where(eq(schema.churchMembers.userId, target.id)),
    db.select().from(schema.users).where(eq(schema.users.id, fromUserId)).limit(1),
  ]);
  const requester = requesterRows[0];
  const targetChurches = new Set(targetMemberships.map((m) => m.churchId));
  const shared = fromMemberships.filter((m) => targetChurches.has(m.churchId));
  const requesterIsAdmin =
    requester?.platformRole === "platform_admin" ||
    shared.some((m) => isChurchAdminRoles(parseRolesJson(m.rolesJson, m.role)));
  if (
    !messageRequestAllowed({
      privacy: targetPrivacy,
      sharesChurch: shared.length > 0,
      requesterIsAdmin,
    })
  ) {
    return c.json({ error: "message_requests_closed" }, 403);
  }

  const [a, b] = orderedPair(fromUserId, target.id);
  const existingFriend = (
    await db
      .select()
      .from(schema.friendships)
      .where(and(eq(schema.friendships.userAId, a), eq(schema.friendships.userBId, b)))
      .limit(1)
  )[0];
  if (existingFriend) return c.json({ error: "already_friends", friendshipId: existingFriend.id }, 409);

  const pendingEither = (
    await db
      .select()
      .from(schema.friendRequests)
      .where(
        and(
          eq(schema.friendRequests.status, "pending"),
          or(
            and(
              eq(schema.friendRequests.fromUserId, fromUserId),
              eq(schema.friendRequests.toUserId, target.id),
            ),
            and(
              eq(schema.friendRequests.fromUserId, target.id),
              eq(schema.friendRequests.toUserId, fromUserId),
            ),
          ),
        ),
      )
      .limit(1)
  )[0];
  if (pendingEither) {
    return c.json({ error: "request_pending", requestId: pendingEither.id }, 409);
  }

  const id = createId("frq");
  const now = Date.now();
  await db.insert(schema.friendRequests).values({
    id,
    fromUserId,
    toUserId: target.id,
    message: null,
    status: "pending",
    createdAt: now,
  });

  const fromLabel =
    (requester
      ? await openField(c.env, fromUserId, "nickname", requester.nicknameCt)
      : null) || requester?.uid || fromUserId;

  await pushInbox(db, {
    userId: target.id,
    kind: "friend_request",
    title: "好友申请",
    body: `${fromLabel} 请求添加你为好友`,
    relatedUserId: fromUserId,
    payload: { requestId: id },
  });

  return c.json({ id, toUserId: target.id }, 201);
});

friendsRoutes.post("/requests/:id/accept", async (c) => {
  const requestId = c.req.param("id");
  const db = drizzle(c.env.DB, { schema });
  const userId = c.get("userId");
  const row = (
    await db
      .select()
      .from(schema.friendRequests)
      .where(eq(schema.friendRequests.id, requestId))
      .limit(1)
  )[0];
  if (!row) return c.json({ error: "not_found" }, 404);
  if (row.toUserId !== userId) return c.json({ error: "forbidden" }, 403);
  if (row.status !== "pending") return c.json({ error: "not_pending" }, 409);

  const now = Date.now();
  await db
    .update(schema.friendRequests)
    .set({ status: "accepted", respondedAt: now })
    .where(eq(schema.friendRequests.id, requestId));

  const [a, b] = orderedPair(row.fromUserId, row.toUserId);
  const existing = (
    await db
      .select()
      .from(schema.friendships)
      .where(and(eq(schema.friendships.userAId, a), eq(schema.friendships.userBId, b)))
      .limit(1)
  )[0];
  let friendshipId = existing?.id;
  if (!existing) {
    friendshipId = createId("frn");
    await db.insert(schema.friendships).values({
      id: friendshipId,
      userAId: a,
      userBId: b,
      createdAt: now,
    });
  }

  const accepter = (
    await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1)
  )[0];
  const label =
    (accepter
      ? await openField(c.env, userId, "nickname", accepter.nicknameCt)
      : null) || accepter?.uid || userId;

  await pushInbox(db, {
    userId: row.fromUserId,
    kind: "friend_accepted",
    title: "好友已通过",
    body: `${label} 已同意你的好友申请`,
    relatedUserId: userId,
    payload: { friendshipId, requestId },
  });

  return c.json({ ok: true, friendshipId });
});

friendsRoutes.post("/requests/:id/decline", async (c) => {
  const requestId = c.req.param("id");
  const db = drizzle(c.env.DB, { schema });
  const userId = c.get("userId");
  const row = (
    await db
      .select()
      .from(schema.friendRequests)
      .where(eq(schema.friendRequests.id, requestId))
      .limit(1)
  )[0];
  if (!row) return c.json({ error: "not_found" }, 404);
  if (row.toUserId !== userId) return c.json({ error: "forbidden" }, 403);
  if (row.status !== "pending") return c.json({ error: "not_pending" }, 409);

  await db
    .update(schema.friendRequests)
    .set({ status: "declined", respondedAt: Date.now() })
    .where(eq(schema.friendRequests.id, requestId));

  return c.json({ ok: true });
});
