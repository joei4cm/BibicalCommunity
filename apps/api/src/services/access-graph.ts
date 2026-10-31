import { and, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { isOwnedMediaKey } from "@logoshome/shared";
import * as schema from "../db/schema";

function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export async function areFriends(
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

/** True if both users share at least one church membership. */
export async function shareChurch(
  db: ReturnType<typeof drizzle>,
  a: string,
  b: string,
): Promise<boolean> {
  if (a === b) return true;
  const mine = await db
    .select({ churchId: schema.churchMembers.churchId })
    .from(schema.churchMembers)
    .where(eq(schema.churchMembers.userId, a));
  for (const { churchId } of mine) {
    const peer = (
      await db
        .select({ id: schema.churchMembers.id })
        .from(schema.churchMembers)
        .where(
          and(eq(schema.churchMembers.churchId, churchId), eq(schema.churchMembers.userId, b)),
        )
        .limit(1)
    )[0];
    if (peer) return true;
  }
  return false;
}

export async function isConversationMember(
  db: ReturnType<typeof drizzle>,
  conversationId: string,
  userId: string,
): Promise<boolean> {
  const row = (
    await db
      .select({ id: schema.conversationMembers.id })
      .from(schema.conversationMembers)
      .where(
        and(
          eq(schema.conversationMembers.conversationId, conversationId),
          eq(schema.conversationMembers.userId, userId),
        ),
      )
      .limit(1)
  )[0];
  return Boolean(row);
}

/** May fetch peer key bundles (and consume OPKs). */
export async function canFetchPeerKeys(
  db: ReturnType<typeof drizzle>,
  selfId: string,
  targetUserId: string,
): Promise<boolean> {
  if (selfId === targetUserId) return true;
  if (await areFriends(db, selfId, targetUserId)) return true;
  if (await shareChurch(db, selfId, targetUserId)) return true;

  const rows = await db
    .select({ conversationId: schema.conversationMembers.conversationId })
    .from(schema.conversationMembers)
    .where(eq(schema.conversationMembers.userId, selfId));
  for (const { conversationId } of rows.slice(0, 80)) {
    if (await isConversationMember(db, conversationId, targetUserId)) return true;
  }
  return false;
}

/** Parse `media/{ownerUserId}/…` owner; null if key shape is invalid. */
export function mediaKeyOwnerUserId(objectKey: string): string | null {
  const m = /^media\/([^/]+)\//.exec(objectKey);
  if (!m?.[1] || objectKey.includes("..")) return null;
  return m[1];
}

export async function mediaKeyReadableByUser(
  db: ReturnType<typeof drizzle>,
  userId: string,
  objectKey: string,
  conversationId?: string | null,
): Promise<boolean> {
  if (isOwnedMediaKey(objectKey, userId)) return true;

  // Conversation ACL: caller must be a member AND the object owner must also be
  // in that same conversation (prevents "any membership + arbitrary key" bypass).
  if (conversationId) {
    const ownerId = mediaKeyOwnerUserId(objectKey);
    if (
      ownerId &&
      (await isConversationMember(db, conversationId, userId)) &&
      (await isConversationMember(db, conversationId, ownerId))
    ) {
      return true;
    }
  }

  const forumPost = (
    await db
      .select()
      .from(schema.forumPosts)
      .where(and(eq(schema.forumPosts.mediaKey, objectKey), isNull(schema.forumPosts.deletedAt)))
      .limit(1)
  )[0];
  if (!forumPost) return false;

  const membership = (
    await db
      .select()
      .from(schema.churchMembers)
      .where(
        and(
          eq(schema.churchMembers.churchId, forumPost.churchId),
          eq(schema.churchMembers.userId, userId),
        ),
      )
      .limit(1)
  )[0];
  if (!membership) return false;

  if (forumPost.board === "group" && forumPost.groupId) {
    const gm = (
      await db
        .select()
        .from(schema.churchGroupMembers)
        .where(
          and(
            eq(schema.churchGroupMembers.groupId, forumPost.groupId),
            eq(schema.churchGroupMembers.userId, userId),
          ),
        )
        .limit(1)
    )[0];
    return Boolean(gm);
  }
  return true;
}
