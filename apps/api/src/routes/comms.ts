import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { and, count, eq, isNull } from "drizzle-orm";
import type { Env } from "../env";
import * as schema from "../db/schema";
import { requireAuth, type AuthVars } from "../middleware/auth";

/**
 * Comms badge summary — chat unread + inbox unread + pending calendar invites
 * (+ pending friend requests for the contacts tab).
 */
export const commsRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();
commsRoutes.use("*", requireAuth);

async function countChatUnread(env: Env, userId: string): Promise<number> {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS n
     FROM messages m
     INNER JOIN conversation_members cm
       ON cm.conversation_id = m.conversation_id AND cm.user_id = ?
     LEFT JOIN devices d ON d.id = m.sender_device_id
     WHERE IFNULL(cm.archived, 0) = 0
       AND IFNULL(m.tombstoned, 0) = 0
       AND m.content_type = 'msg'
       AND m.created_at > IFNULL(cm.last_read_at, 0)
       AND (d.user_id IS NULL OR d.user_id != ?)`,
  )
    .bind(userId, userId)
    .first<{ n: number }>();
  return Number(row?.n ?? 0);
}

commsRoutes.get("/badges", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const userId = c.get("userId");

  const [inboxRow, friendRow, calendarRow, chatUnread] = await Promise.all([
    db
      .select({ n: count() })
      .from(schema.inboxMessages)
      .where(and(eq(schema.inboxMessages.userId, userId), isNull(schema.inboxMessages.readAt))),
    db
      .select({ n: count() })
      .from(schema.friendRequests)
      .where(
        and(eq(schema.friendRequests.toUserId, userId), eq(schema.friendRequests.status, "pending")),
      ),
    db
      .select({ n: count() })
      .from(schema.calendarInvites)
      .where(
        and(
          eq(schema.calendarInvites.inviteeUserId, userId),
          eq(schema.calendarInvites.status, "pending"),
        ),
      ),
    countChatUnread(c.env, userId),
  ]);

  const inboxUnread = Number(inboxRow[0]?.n ?? 0);
  const friendRequestsPending = Number(friendRow[0]?.n ?? 0);
  const calendarPending = Number(calendarRow[0]?.n ?? 0);
  const total = chatUnread + inboxUnread + calendarPending + friendRequestsPending;

  return c.json({
    chatUnread,
    inboxUnread,
    calendarPending,
    friendRequestsPending,
    total,
  });
});
