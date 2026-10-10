import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import {
  canAssignChurchRoles,
  canConveneCoworkerAssembly,
  canCreateGroup,
  canVerifyMembers,
  churchRoleSchema,
  coworkerAssemblyConversationTitle,
  createId,
  forumAdminPatchSchema,
  forumPostSchema,
  forumRespondSchema,
  forumRiddlePayloadSchema,
  groupKindSchema,
  groupRoleSchema,
  isAllowedExternalMediaUrl,
  isOwnedMediaKey,
  isChurchAdminRoles,
  parseRolesJson,
  securityModeSchema,
  primaryChurchRole,
  type ChurchRole,
} from "@logoshome/shared";
import type { Env } from "../env";
import { requireMedia } from "../media-binding";
import * as schema from "../db/schema";
import { requireAuth, type AuthVars } from "../middleware/auth";
import {
  applyHostilePrivacyFloors,
  applyHostilePrivacyFloorsToChurch,
} from "../services/hostile-privacy";
import { openField } from "../services/field-crypto";
import { sha256Hex } from "../services/crypto";
import {
  assertCanManageGroupMembers,
  buildCoworkerAssembly,
  buildOrgTree,
  loadMembershipContext,
  loadPlatformAdmin,
  syncPrimaryRole,
} from "../services/church-access";

function parsePayloadJson(raw: string | null | undefined): Record<string, unknown> {
  try {
    const v = JSON.parse(raw || "{}") as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function publicPostPayload(kind: string, payload: Record<string, unknown>) {
  if (kind === "riddle") {
    const { answer: _a, ...rest } = payload;
    return rest;
  }
  return payload;
}

function canModeratePosts(
  roles: readonly ChurchRole[],
  platformAdmin: boolean,
): boolean {
  return platformAdmin || isChurchAdminRoles(roles) || roles.includes("elder");
}

function memberGroupIds(membership: { groupIdsJson: string }): string[] {
  try {
    const ids = JSON.parse(membership.groupIdsJson || "[]") as unknown;
    return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

async function syncLegacyGroupIds(
  db: ReturnType<typeof drizzle<typeof schema>>,
  membershipId: string,
  userId: string,
  churchId: string,
): Promise<void> {
  const groups = await db
    .select()
    .from(schema.churchGroups)
    .where(eq(schema.churchGroups.churchId, churchId));
  const allowed = new Set(groups.map((g) => g.id));
  const rows = await db
    .select()
    .from(schema.churchGroupMembers)
    .where(eq(schema.churchGroupMembers.userId, userId));
  const ids = rows.map((r) => r.groupId).filter((id) => allowed.has(id));
  await db
    .update(schema.churchMembers)
    .set({ groupIdsJson: JSON.stringify(ids) })
    .where(eq(schema.churchMembers.id, membershipId));
}

export const homeRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();
homeRoutes.use("*", requireAuth);

const seedChurchSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  securityMode: securityModeSchema.optional().default("standard"),
});

const patchSecuritySchema = z.object({
  securityMode: securityModeSchema,
});

homeRoutes.get("/churches", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const userId = c.get("userId");
  const platformAdmin = await loadPlatformAdmin(db, userId);
  const memberships = await db
    .select()
    .from(schema.churchMembers)
    .where(eq(schema.churchMembers.userId, userId));
  const churches = [];
  let inHostile = false;
  for (const m of memberships) {
    const church = (
      await db.select().from(schema.churches).where(eq(schema.churches.id, m.churchId)).limit(1)
    )[0];
    if (church) {
      if (church.securityMode === "hostile") inHostile = true;
      const roles = parseRolesJson(m.rolesJson, m.role);
      const ctx = await loadMembershipContext(db, userId, church.id);
      churches.push({
        ...church,
        role: primaryChurchRole(roles),
        roles,
        verified: m.verified,
        groups: JSON.parse(m.groupIdsJson || "[]"),
        capabilities: {
          platformAdmin,
          createGroup: canCreateGroup(roles, platformAdmin),
          verifyMembers: canVerifyMembers(roles, platformAdmin),
          manageChurch: platformAdmin,
          isGroupLeader: Boolean(ctx?.ledGroupIds.length),
          ledGroupIds: ctx?.ledGroupIds ?? [],
          conveneAssembly: canConveneCoworkerAssembly(roles, platformAdmin),
        },
      });
    }
  }
  if (inHostile) {
    await applyHostilePrivacyFloors(db, userId);
  }
  return c.json({ churches, platformAdmin });
});

/** Platform admin only: create a home (教会/家). */
homeRoutes.post("/churches", async (c) => {
  const body = seedChurchSchema.parse(await c.req.json());
  const db = drizzle(c.env.DB, { schema });
  const userId = c.get("userId");
  if (!(await loadPlatformAdmin(db, userId))) {
    return c.json({ error: "platform_admin_required" }, 403);
  }
  const existing = (
    await db.select().from(schema.churches).where(eq(schema.churches.slug, body.slug)).limit(1)
  )[0];
  if (existing) return c.json({ error: "slug_taken" }, 409);

  const churchId = createId("church");
  const memberId = createId("cmbr");
  const now = Date.now();
  const securityMode = body.securityMode ?? "standard";
  // Creator is 安全官; soft-recommend 长老 office on the same membership.
  const roles: ChurchRole[] = ["security_officer", "elder"];
  const synced = syncPrimaryRole(roles);
  await db.insert(schema.churches).values({
    id: churchId,
    name: body.name,
    slug: body.slug,
    securityMode,
    createdAt: now,
  });
  await db.insert(schema.churchMembers).values({
    id: memberId,
    churchId,
    userId,
    role: synced.role,
    rolesJson: synced.rolesJson,
    verified: true,
    groupIdsJson: "[]",
    createdAt: now,
  });

  if (securityMode === "hostile") {
    await applyHostilePrivacyFloors(db, userId);
  }

  return c.json(
    {
      id: churchId,
      name: body.name,
      slug: body.slug,
      role: synced.role,
      roles,
      securityMode,
    },
    201,
  );
});

async function joinChurch(
  db: ReturnType<typeof drizzle<typeof schema>>,
  userId: string,
  church: typeof schema.churches.$inferSelect,
): Promise<{
  id: string;
  churchId: string;
  role: string;
  roles: ChurchRole[];
  alreadyMember: boolean;
  name: string;
  slug: string;
}> {
  const churchId = church.id;
  const existing = (
    await db
      .select()
      .from(schema.churchMembers)
      .where(and(eq(schema.churchMembers.churchId, churchId), eq(schema.churchMembers.userId, userId)))
      .limit(1)
  )[0];
  if (existing) {
    if (church.securityMode === "hostile") {
      await applyHostilePrivacyFloors(db, userId);
    }
    const roles = parseRolesJson(existing.rolesJson, existing.role);
    return {
      id: existing.id,
      churchId,
      role: primaryChurchRole(roles),
      roles,
      alreadyMember: true,
      name: church.name,
      slug: church.slug,
    };
  }

  const memberId = createId("cmbr");
  const synced = syncPrimaryRole(["member"]);
  await db.insert(schema.churchMembers).values({
    id: memberId,
    churchId,
    userId,
    role: synced.role,
    rolesJson: synced.rolesJson,
    verified: false,
    groupIdsJson: "[]",
    createdAt: Date.now(),
  });

  if (church.securityMode === "hostile") {
    await applyHostilePrivacyFloors(db, userId);
  }

  return {
    id: memberId,
    churchId,
    role: "member",
    roles: ["member"],
    alreadyMember: false,
    name: church.name,
    slug: church.slug,
  };
}

const joinBySlugSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

homeRoutes.post("/churches/join", async (c) => {
  const body = joinBySlugSchema.parse(await c.req.json());
  const db = drizzle(c.env.DB, { schema });
  const church = (
    await db.select().from(schema.churches).where(eq(schema.churches.slug, body.slug)).limit(1)
  )[0];
  if (!church) return c.json({ error: "not_found" }, 404);
  const result = await joinChurch(db, c.get("userId"), church);
  return c.json(result, result.alreadyMember ? 200 : 201);
});

homeRoutes.post("/churches/:id/join", async (c) => {
  const churchId = c.req.param("id");
  const db = drizzle(c.env.DB, { schema });
  const church = (
    await db.select().from(schema.churches).where(eq(schema.churches.id, churchId)).limit(1)
  )[0];
  if (!church) return c.json({ error: "not_found" }, 404);
  const result = await joinChurch(db, c.get("userId"), church);
  return c.json(result, result.alreadyMember ? 200 : 201);
});

homeRoutes.patch("/churches/:id/security", async (c) => {
  const churchId = c.req.param("id");
  const body = patchSecuritySchema.parse(await c.req.json());
  const db = drizzle(c.env.DB, { schema });
  const userId = c.get("userId");
  if (!(await loadPlatformAdmin(db, userId))) {
    return c.json({ error: "platform_admin_required" }, 403);
  }

  const church = (
    await db.select().from(schema.churches).where(eq(schema.churches.id, churchId)).limit(1)
  )[0];
  if (!church) return c.json({ error: "not_found" }, 404);

  await db
    .update(schema.churches)
    .set({ securityMode: body.securityMode })
    .where(eq(schema.churches.id, churchId));

  if (body.securityMode === "hostile") {
    await applyHostilePrivacyFloorsToChurch(db, churchId);
  }

  return c.json({ id: churchId, securityMode: body.securityMode });
});

/** Org tree + visible people for the current home. */
homeRoutes.get("/:churchId/org-tree", async (c) => {
  const churchId = c.req.param("churchId");
  const db = drizzle(c.env.DB, { schema });
  try {
    const result = await buildOrgTree(db, c.env, churchId, c.get("userId"));
    return c.json(result);
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    if (status === 404) return c.json({ error: "not_found" }, 404);
    if (status === 403) return c.json({ error: "forbidden" }, 403);
    throw e;
  }
});

/**
 * 同工大会 — mailing-list / convene channel (derived membership; not an org-tree node).
 * Query: includeCoworkers=0 to exclude church-level coworker office.
 */
homeRoutes.get("/:churchId/coworker-assembly", async (c) => {
  const churchId = c.req.param("churchId");
  const includeRaw = c.req.query("includeCoworkers");
  const includeChurchCoworkers = includeRaw !== "0" && includeRaw !== "false";
  const db = drizzle(c.env.DB, { schema });
  try {
    const result = await buildCoworkerAssembly(db, c.env, churchId, c.get("userId"), {
      includeChurchCoworkers,
    });
    return c.json(result);
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    if (status === 403) return c.json({ error: "forbidden" }, 403);
    throw e;
  }
});

const assemblyNotifySchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().max(8000).optional().default(""),
});

/** Post a notice board item addressed to 同工大会 (conveners only). */
homeRoutes.post("/:churchId/coworker-assembly/notify", async (c) => {
  const churchId = c.req.param("churchId");
  const body = assemblyNotifySchema.parse(await c.req.json());
  const db = drizzle(c.env.DB, { schema });
  const userId = c.get("userId");
  let assembly: Awaited<ReturnType<typeof buildCoworkerAssembly>>;
  try {
    assembly = await buildCoworkerAssembly(db, c.env, churchId, userId);
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    if (status === 403) return c.json({ error: "forbidden" }, 403);
    throw e;
  }
  if (!assembly.viewer.canNotify) return c.json({ error: "forbidden" }, 403);

  const id = createId("post");
  await db.insert(schema.forumPosts).values({
    id,
    churchId,
    groupId: null,
    authorId: userId,
    board: "notice",
    kind: "text",
    title: body.title,
    body: body.body ?? "",
    externalMediaUrl: null,
    mediaKey: null,
    payloadJson: JSON.stringify({
      assemblyNotify: true,
      audienceUserIds: assembly.members.map((m) => m.userId),
    }),
    answerHash: null,
    pinned: false,
    pinnedAt: null,
    readonly: false,
    expiresAt: null,
    deletedAt: null,
    createdAt: Date.now(),
  });
  return c.json(
    {
      id,
      board: "notice",
      audienceCount: assembly.members.length,
    },
    201,
  );
});

/** Open or create the 同工大会 group chat; sync current mailing-list members. */
homeRoutes.post("/:churchId/coworker-assembly/chat", async (c) => {
  const churchId = c.req.param("churchId");
  const db = drizzle(c.env.DB, { schema });
  const userId = c.get("userId");
  let assembly: Awaited<ReturnType<typeof buildCoworkerAssembly>>;
  try {
    assembly = await buildCoworkerAssembly(db, c.env, churchId, userId);
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    if (status === 403) return c.json({ error: "forbidden" }, 403);
    throw e;
  }
  if (!assembly.viewer.canOpenChat) return c.json({ error: "forbidden" }, 403);

  const title = coworkerAssemblyConversationTitle(churchId);
  const memberships = await db
    .select()
    .from(schema.conversationMembers)
    .where(eq(schema.conversationMembers.userId, userId));

  let conversationId: string | null = null;
  for (const m of memberships) {
    const convo = (
      await db
        .select()
        .from(schema.conversations)
        .where(eq(schema.conversations.id, m.conversationId))
        .limit(1)
    )[0];
    if (convo?.kind === "group" && convo.title === title) {
      conversationId = convo.id;
      break;
    }
  }

  const memberIds = new Set(assembly.members.map((m) => m.userId));
  memberIds.add(userId);

  if (!conversationId) {
    conversationId = createId("convo");
    await db.insert(schema.conversations).values({
      id: conversationId,
      kind: "group",
      title,
      disappearingTtlSec: null,
      createdBy: userId,
      createdAt: Date.now(),
    });
    for (const mid of memberIds) {
      await db.insert(schema.conversationMembers).values({
        id: createId("cm"),
        conversationId,
        userId: mid,
        role: mid === userId ? "owner" : "member",
      });
    }
    return c.json({ conversationId, created: true, memberCount: memberIds.size }, 201);
  }

  const existing = await db
    .select()
    .from(schema.conversationMembers)
    .where(eq(schema.conversationMembers.conversationId, conversationId));
  const existingIds = new Set(existing.map((e) => e.userId));
  for (const mid of memberIds) {
    if (existingIds.has(mid)) continue;
    await db.insert(schema.conversationMembers).values({
      id: createId("cm"),
      conversationId,
      userId: mid,
      role: "member",
    });
  }
  return c.json({ conversationId, created: false, memberCount: memberIds.size });
});

function serializeForumPost(p: typeof schema.forumPosts.$inferSelect) {
  const payload = publicPostPayload(p.kind, parsePayloadJson(p.payloadJson));
  return {
    id: p.id,
    churchId: p.churchId,
    groupId: p.groupId,
    authorId: p.authorId,
    board: p.board,
    kind: p.kind,
    title: p.title,
    body: p.body,
    externalMediaUrl: p.externalMediaUrl,
    mediaKey: p.mediaKey,
    payload,
    pinned: Boolean(p.pinned),
    pinnedAt: p.pinnedAt,
    readonly: Boolean(p.readonly),
    expiresAt: p.expiresAt,
    expired: Boolean(p.expiresAt && p.expiresAt <= Date.now()),
    createdAt: p.createdAt,
  };
}

homeRoutes.get("/:churchId/posts", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const churchId = c.req.param("churchId");
  const board = c.req.query("board");
  const membership = (
    await db
      .select()
      .from(schema.churchMembers)
      .where(
        and(eq(schema.churchMembers.churchId, churchId), eq(schema.churchMembers.userId, c.get("userId"))),
      )
      .limit(1)
  )[0];
  if (!membership) return c.json({ error: "forbidden" }, 403);

  let posts = await db
    .select()
    .from(schema.forumPosts)
    .where(
      board
        ? and(eq(schema.forumPosts.churchId, churchId), eq(schema.forumPosts.board, board))
        : eq(schema.forumPosts.churchId, churchId),
    );

  posts = posts.filter((p) => !p.deletedAt);

  if (board === "group") {
    const ctx = await loadMembershipContext(db, c.get("userId"), churchId);
    const allowed = new Set(ctx?.groupIds.length ? ctx.groupIds : memberGroupIds(membership));
    posts = posts.filter((p) => p.groupId && allowed.has(p.groupId));
  }

  posts.sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    const ap = a.pinnedAt ?? 0;
    const bp = b.pinnedAt ?? 0;
    if (ap !== bp) return bp - ap;
    return b.createdAt - a.createdAt;
  });

  return c.json({ posts: posts.map(serializeForumPost) });
});

/** Board index for 大道 L1 navigation. */
homeRoutes.get("/:churchId/boards", async (c) => {
  const churchId = c.req.param("churchId");
  const db = drizzle(c.env.DB, { schema });
  const membership = (
    await db
      .select()
      .from(schema.churchMembers)
      .where(
        and(eq(schema.churchMembers.churchId, churchId), eq(schema.churchMembers.userId, c.get("userId"))),
      )
      .limit(1)
  )[0];
  if (!membership) return c.json({ error: "forbidden" }, 403);

  const posts = (
    await db.select().from(schema.forumPosts).where(eq(schema.forumPosts.churchId, churchId))
  ).filter((p) => !p.deletedAt);

  const ctx = await loadMembershipContext(db, c.get("userId"), churchId);
  const allowedGroups = new Set(ctx?.groupIds ?? memberGroupIds(membership));

  const boards = (["notice", "general", "group"] as const).map((id) => {
    const boardPosts =
      id === "group"
        ? posts.filter((p) => p.board === "group" && p.groupId && allowedGroups.has(p.groupId))
        : posts.filter((p) => p.board === id);
    return {
      id,
      postCount: boardPosts.length,
      latestAt: boardPosts.reduce((max, p) => Math.max(max, p.createdAt), 0) || null,
    };
  });

  return c.json({ churchId, boards });
});

homeRoutes.post("/posts", async (c) => {
  const body = forumPostSchema.parse(await c.req.json());
  const db = drizzle(c.env.DB, { schema });
  const userId = c.get("userId");
  const membership = (
    await db
      .select()
      .from(schema.churchMembers)
      .where(
        and(eq(schema.churchMembers.churchId, body.churchId), eq(schema.churchMembers.userId, userId)),
      )
      .limit(1)
  )[0];
  if (!membership) return c.json({ error: "forbidden" }, 403);

  if (body.board === "group") {
    const ctx = await loadMembershipContext(db, userId, body.churchId);
    const allowed = ctx?.groupIds ?? memberGroupIds(membership);
    if (!body.groupId || !allowed.includes(body.groupId)) {
      return c.json({ error: "group_membership_required" }, 403);
    }
  }

  if (body.externalMediaUrl && !isAllowedExternalMediaUrl(body.externalMediaUrl)) {
    return c.json({ error: "external_media_not_allowed" }, 400);
  }
  if (body.mediaKey && !isOwnedMediaKey(body.mediaKey, userId)) {
    return c.json({ error: "media_key_forbidden" }, 403);
  }
  if (body.mediaKey) {
    const media = requireMedia(c);
    if (media instanceof Response) return media;
    const obj = await media.head(body.mediaKey);
    if (!obj) return c.json({ error: "media_key_not_found" }, 400);
  }

  const payload = { ...(body.payload ?? {}) };
  let answerHash: string | null = null;
  if (body.kind === "riddle") {
    const r = forumRiddlePayloadSchema.parse(payload);
    answerHash = await sha256Hex(r.answer.trim().toLowerCase());
    delete payload.answer;
    if (r.hint) payload.hint = r.hint;
  }
  const expiresAt =
    body.expiresAt ??
    (typeof payload.expiresAt === "number" ? payload.expiresAt : null);
  if (body.kind === "timed" && expiresAt) {
    payload.expiresAt = expiresAt;
  }

  const id = createId("post");
  await db.insert(schema.forumPosts).values({
    id,
    churchId: body.churchId,
    groupId: body.groupId,
    authorId: userId,
    board: body.board,
    kind: body.kind,
    title: body.title,
    body: body.body ?? "",
    externalMediaUrl: body.externalMediaUrl,
    mediaKey: body.mediaKey,
    payloadJson: JSON.stringify(payload),
    answerHash,
    pinned: false,
    pinnedAt: null,
    readonly: false,
    expiresAt: body.kind === "timed" ? expiresAt : expiresAt,
    deletedAt: null,
    createdAt: Date.now(),
  });
  return c.json({ id, mediaKey: body.mediaKey ?? null, kind: body.kind }, 201);
});

/** Single post + interaction summary. */
homeRoutes.get("/posts/:postId", async (c) => {
  const postId = c.req.param("postId");
  const db = drizzle(c.env.DB, { schema });
  const userId = c.get("userId");
  const post = (
    await db.select().from(schema.forumPosts).where(eq(schema.forumPosts.id, postId)).limit(1)
  )[0];
  if (!post || post.deletedAt) return c.json({ error: "not_found" }, 404);

  const ctx = await loadMembershipContext(db, userId, post.churchId);
  if (!ctx) return c.json({ error: "forbidden" }, 403);
  if (post.board === "group" && post.groupId && !ctx.groupIds.includes(post.groupId)) {
    return c.json({ error: "forbidden" }, 403);
  }

  const responses = await db
    .select()
    .from(schema.forumPostResponses)
    .where(eq(schema.forumPostResponses.postId, postId));

  const mine = responses.filter((r) => r.userId === userId);
  const stats: Record<string, unknown> = { responseCount: responses.length };

  if (post.kind === "poll") {
    const counts: Record<string, number> = {};
    for (const r of responses.filter((x) => x.action === "vote")) {
      const opt = String(parsePayloadJson(r.payloadJson).optionIndex ?? "");
      counts[opt] = (counts[opt] ?? 0) + 1;
    }
    stats.voteCounts = counts;
    stats.myVote = mine.find((m) => m.action === "vote")
      ? parsePayloadJson(mine.find((m) => m.action === "vote")!.payloadJson)
      : null;
  } else if (post.kind === "chain") {
    stats.entries = responses
      .filter((r) => r.action === "chain")
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((r) => ({
        id: r.id,
        userId: r.userId,
        text: String(parsePayloadJson(r.payloadJson).text ?? ""),
        createdAt: r.createdAt,
      }));
  } else if (post.kind === "survey") {
    stats.submissionCount = responses.filter((r) => r.action === "survey").length;
    stats.submitted = mine.some((m) => m.action === "survey");
  } else if (post.kind === "riddle") {
    const solved = responses.some((r) => r.action === "riddle" && parsePayloadJson(r.payloadJson).correct);
    stats.solvedCount = responses.filter(
      (r) => r.action === "riddle" && parsePayloadJson(r.payloadJson).correct,
    ).length;
    stats.iSolved = mine.some((m) => m.action === "riddle" && parsePayloadJson(m.payloadJson).correct);
    stats.anySolved = solved;
  }

  return c.json({
    post: serializeForumPost(post),
    stats,
    canModerate: canModeratePosts(ctx.roles, ctx.platformAdmin),
  });
});

/** Interact with a collectable / playful post. */
homeRoutes.post("/posts/:postId/respond", async (c) => {
  const postId = c.req.param("postId");
  const body = forumRespondSchema.parse(await c.req.json());
  const db = drizzle(c.env.DB, { schema });
  const userId = c.get("userId");
  const post = (
    await db.select().from(schema.forumPosts).where(eq(schema.forumPosts.id, postId)).limit(1)
  )[0];
  if (!post || post.deletedAt) return c.json({ error: "not_found" }, 404);
  if (post.readonly) return c.json({ error: "readonly" }, 403);
  if (post.expiresAt && post.expiresAt <= Date.now()) return c.json({ error: "expired" }, 403);

  const ctx = await loadMembershipContext(db, userId, post.churchId);
  if (!ctx) return c.json({ error: "forbidden" }, 403);

  const existing = await db
    .select()
    .from(schema.forumPostResponses)
    .where(
      and(eq(schema.forumPostResponses.postId, postId), eq(schema.forumPostResponses.userId, userId)),
    );

  if (body.action === "vote") {
    if (post.kind !== "poll") return c.json({ error: "wrong_kind" }, 400);
    const optionIndex = Number(body.payload.optionIndex);
    const options = (parsePayloadJson(post.payloadJson).options as string[] | undefined) ?? [];
    if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= options.length) {
      return c.json({ error: "bad_option" }, 400);
    }
    const prev = existing.find((e) => e.action === "vote");
    if (prev) {
      await db
        .update(schema.forumPostResponses)
        .set({ payloadJson: JSON.stringify({ optionIndex }) })
        .where(eq(schema.forumPostResponses.id, prev.id));
    } else {
      await db.insert(schema.forumPostResponses).values({
        id: createId("fpr"),
        postId,
        userId,
        action: "vote",
        payloadJson: JSON.stringify({ optionIndex }),
        createdAt: Date.now(),
      });
    }
    return c.json({ ok: true });
  }

  if (body.action === "chain") {
    if (post.kind !== "chain" && post.kind !== "text") return c.json({ error: "wrong_kind" }, 400);
    const text = String(body.payload.text ?? "").trim();
    if (!text || text.length > 500) return c.json({ error: "bad_text" }, 400);
    const max = Number(parsePayloadJson(post.payloadJson).maxEntries ?? 0);
    const chainCount = (
      await db
        .select()
        .from(schema.forumPostResponses)
        .where(
          and(eq(schema.forumPostResponses.postId, postId), eq(schema.forumPostResponses.action, "chain")),
        )
    ).length;
    if (max > 0 && chainCount >= max) return c.json({ error: "chain_full" }, 400);
    await db.insert(schema.forumPostResponses).values({
      id: createId("fpr"),
      postId,
      userId,
      action: "chain",
      payloadJson: JSON.stringify({ text }),
      createdAt: Date.now(),
    });
    return c.json({ ok: true });
  }

  if (body.action === "survey") {
    if (post.kind !== "survey") return c.json({ error: "wrong_kind" }, 400);
    if (existing.some((e) => e.action === "survey")) return c.json({ error: "already_submitted" }, 409);
    await db.insert(schema.forumPostResponses).values({
      id: createId("fpr"),
      postId,
      userId,
      action: "survey",
      payloadJson: JSON.stringify({ answers: body.payload.answers ?? {} }),
      createdAt: Date.now(),
    });
    return c.json({ ok: true });
  }

  if (body.action === "riddle") {
    if (post.kind !== "riddle") return c.json({ error: "wrong_kind" }, 400);
    const guess = String(body.payload.guess ?? "").trim().toLowerCase();
    if (!guess) return c.json({ error: "bad_guess" }, 400);
    const correct = post.answerHash ? (await sha256Hex(guess)) === post.answerHash : false;
    await db.insert(schema.forumPostResponses).values({
      id: createId("fpr"),
      postId,
      userId,
      action: "riddle",
      payloadJson: JSON.stringify({ correct, guess: correct ? guess : undefined }),
      createdAt: Date.now(),
    });
    return c.json({ ok: true, correct });
  }

  return c.json({ error: "bad_action" }, 400);
});

/** Pin / readonly / soft-delete (moderators). */
homeRoutes.patch("/posts/:postId", async (c) => {
  const postId = c.req.param("postId");
  const body = forumAdminPatchSchema.parse(await c.req.json());
  const db = drizzle(c.env.DB, { schema });
  const userId = c.get("userId");
  const post = (
    await db.select().from(schema.forumPosts).where(eq(schema.forumPosts.id, postId)).limit(1)
  )[0];
  if (!post || post.deletedAt) return c.json({ error: "not_found" }, 404);
  const ctx = await loadMembershipContext(db, userId, post.churchId);
  if (!ctx || !canModeratePosts(ctx.roles, ctx.platformAdmin)) {
    return c.json({ error: "forbidden" }, 403);
  }
  const patch: Partial<typeof schema.forumPosts.$inferInsert> = {};
  if (body.pinned !== undefined) {
    patch.pinned = body.pinned;
    patch.pinnedAt = body.pinned ? Date.now() : null;
  }
  if (body.readonly !== undefined) patch.readonly = body.readonly;
  if (body.deleted === true) patch.deletedAt = Date.now();
  if (Object.keys(patch).length === 0) return c.json({ error: "empty_patch" }, 400);
  await db.update(schema.forumPosts).set(patch).where(eq(schema.forumPosts.id, postId));
  return c.json({ ok: true });
});

/** Export collectable responses (poll / chain / survey) as JSON for moderators. */
homeRoutes.get("/posts/:postId/export", async (c) => {
  const postId = c.req.param("postId");
  const db = drizzle(c.env.DB, { schema });
  const userId = c.get("userId");
  const post = (
    await db.select().from(schema.forumPosts).where(eq(schema.forumPosts.id, postId)).limit(1)
  )[0];
  if (!post || post.deletedAt) return c.json({ error: "not_found" }, 404);
  const ctx = await loadMembershipContext(db, userId, post.churchId);
  if (!ctx || !canModeratePosts(ctx.roles, ctx.platformAdmin)) {
    return c.json({ error: "forbidden" }, 403);
  }
  if (!["poll", "chain", "survey"].includes(post.kind)) {
    return c.json({ error: "not_exportable" }, 400);
  }
  const responses = await db
    .select()
    .from(schema.forumPostResponses)
    .where(eq(schema.forumPostResponses.postId, postId));
  const rows = responses.map((r) => ({
    id: r.id,
    userId: r.userId,
    action: r.action,
    payload: parsePayloadJson(r.payloadJson),
    createdAt: r.createdAt,
  }));
  return c.json({
    postId: post.id,
    kind: post.kind,
    title: post.title,
    exportedAt: Date.now(),
    rows,
  });
});

const createGroupSchema = z.object({
  churchId: z.string().min(1),
  name: z.string().min(1).max(200),
  kind: groupKindSchema.optional().default("small_group"),
  parentId: z.string().optional(),
});

/** Church admin (or platform admin) creates groups/departments. */
homeRoutes.post("/groups", async (c) => {
  const body = createGroupSchema.parse(await c.req.json());
  const db = drizzle(c.env.DB, { schema });
  const userId = c.get("userId");
  const ctx = await loadMembershipContext(db, userId, body.churchId);
  if (!ctx || !canCreateGroup(ctx.roles, ctx.platformAdmin)) {
    return c.json({ error: "church_admin_required" }, 403);
  }

  if (body.parentId) {
    const parent = (
      await db
        .select()
        .from(schema.churchGroups)
        .where(
          and(eq(schema.churchGroups.id, body.parentId), eq(schema.churchGroups.churchId, body.churchId)),
        )
        .limit(1)
    )[0];
    if (!parent) return c.json({ error: "parent_not_found" }, 404);
  }

  const id = createId("grp");
  const now = Date.now();
  await db.insert(schema.churchGroups).values({
    id,
    churchId: body.churchId,
    name: body.name,
    parentId: body.parentId ?? null,
    kind: body.kind,
    sortOrder: 0,
    createdAt: now,
  });

  // Creator becomes group leader for small groups they create.
  await db.insert(schema.churchGroupMembers).values({
    id: createId("cgm"),
    groupId: id,
    userId,
    role: "leader",
    createdAt: now,
  });
  await syncLegacyGroupIds(db, ctx.membership.id, userId, body.churchId);

  return c.json(
    { id, churchId: body.churchId, name: body.name, kind: body.kind, parentId: body.parentId ?? null },
    201,
  );
});

/** List groups the viewer can manage (or belongs to). */
homeRoutes.get("/:churchId/groups", async (c) => {
  const churchId = c.req.param("churchId");
  const db = drizzle(c.env.DB, { schema });
  const ctx = await loadMembershipContext(db, c.get("userId"), churchId);
  if (!ctx) return c.json({ error: "forbidden" }, 403);

  const all = await db
    .select()
    .from(schema.churchGroups)
    .where(eq(schema.churchGroups.churchId, churchId));

  const canSeeAll =
    ctx.platformAdmin ||
    isChurchAdminRoles(ctx.roles) ||
    ctx.roles.includes("deacon") ||
    ctx.roles.includes("elder");

  const groups = all
    .filter((g) => {
      if (canSeeAll) return true;
      if (ctx.ledGroupIds.includes(g.id) || ctx.groupIds.includes(g.id)) return true;
      return false;
    })
    .map((g) => ({
      id: g.id,
      name: g.name,
      kind: g.kind,
      parentId: g.parentId,
      sortOrder: g.sortOrder,
      canManage:
        ctx.platformAdmin ||
        isChurchAdminRoles(ctx.roles) ||
        ctx.ledGroupIds.includes(g.id) ||
        (ctx.roles.includes("deacon") && g.kind === "department"),
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  return c.json({ churchId, groups });
});

/** List members of a group (managers see full roster). */
homeRoutes.get("/groups/:groupId/members", async (c) => {
  const groupId = c.req.param("groupId");
  const db = drizzle(c.env.DB, { schema });
  try {
    const { group } = await assertCanManageGroupMembers(db, c.get("userId"), groupId);
    const rows = await db
      .select()
      .from(schema.churchGroupMembers)
      .where(eq(schema.churchGroupMembers.groupId, groupId));
    const members = [];
    for (const row of rows) {
      const user = (
        await db.select().from(schema.users).where(eq(schema.users.id, row.userId)).limit(1)
      )[0];
      members.push({
        userId: row.userId,
        uid: user?.uid ?? null,
        nickname: user ? await openField(c.env, row.userId, "nickname", user.nicknameCt) : null,
        role: row.role,
      });
    }
    return c.json({
      groupId,
      churchId: group.churchId,
      name: group.name,
      kind: group.kind,
      members,
    });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    if (status === 404) return c.json({ error: "not_found" }, 404);
    if (status === 403) return c.json({ error: "forbidden" }, 403);
    throw e;
  }
});

const patchGroupMemberSchema = z.object({
  userId: z.string().min(1),
  role: groupRoleSchema.optional().default("member"),
});

/** Group leader (or church admin / deacon on departments) adds a member. */
homeRoutes.post("/groups/:groupId/members", async (c) => {
  const groupId = c.req.param("groupId");
  const body = patchGroupMemberSchema.parse(await c.req.json());
  const db = drizzle(c.env.DB, { schema });
  try {
    const { group } = await assertCanManageGroupMembers(db, c.get("userId"), groupId);
    const targetMembership = (
      await db
        .select()
        .from(schema.churchMembers)
        .where(
          and(
            eq(schema.churchMembers.churchId, group.churchId),
            eq(schema.churchMembers.userId, body.userId),
          ),
        )
        .limit(1)
    )[0];
    if (!targetMembership) return c.json({ error: "not_church_member" }, 400);

    const existing = (
      await db
        .select()
        .from(schema.churchGroupMembers)
        .where(
          and(
            eq(schema.churchGroupMembers.groupId, groupId),
            eq(schema.churchGroupMembers.userId, body.userId),
          ),
        )
        .limit(1)
    )[0];
    if (existing) {
      await db
        .update(schema.churchGroupMembers)
        .set({ role: body.role })
        .where(eq(schema.churchGroupMembers.id, existing.id));
    } else {
      await db.insert(schema.churchGroupMembers).values({
        id: createId("cgm"),
        groupId,
        userId: body.userId,
        role: body.role,
        createdAt: Date.now(),
      });
    }
    await syncLegacyGroupIds(db, targetMembership.id, body.userId, group.churchId);
    return c.json({ ok: true, groupId, userId: body.userId, role: body.role });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    if (status === 404) return c.json({ error: "not_found" }, 404);
    if (status === 403) return c.json({ error: "forbidden" }, 403);
    throw e;
  }
});

homeRoutes.delete("/groups/:groupId/members/:userId", async (c) => {
  const groupId = c.req.param("groupId");
  const targetUserId = c.req.param("userId");
  const db = drizzle(c.env.DB, { schema });
  try {
    const { group } = await assertCanManageGroupMembers(db, c.get("userId"), groupId);
    await db
      .delete(schema.churchGroupMembers)
      .where(
        and(
          eq(schema.churchGroupMembers.groupId, groupId),
          eq(schema.churchGroupMembers.userId, targetUserId),
        ),
      );
    const targetMembership = (
      await db
        .select()
        .from(schema.churchMembers)
        .where(
          and(
            eq(schema.churchMembers.churchId, group.churchId),
            eq(schema.churchMembers.userId, targetUserId),
          ),
        )
        .limit(1)
    )[0];
    if (targetMembership) {
      await syncLegacyGroupIds(db, targetMembership.id, targetUserId, group.churchId);
    }
    return c.json({ ok: true });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    if (status === 404) return c.json({ error: "not_found" }, 404);
    if (status === 403) return c.json({ error: "forbidden" }, 403);
    throw e;
  }
});

/** Roster for verify / management (church admin+) or group-leader add-member picker. */
homeRoutes.get("/:churchId/members", async (c) => {
  const churchId = c.req.param("churchId");
  const db = drizzle(c.env.DB, { schema });
  const ctx = await loadMembershipContext(db, c.get("userId"), churchId);
  if (!ctx) return c.json({ error: "forbidden" }, 403);

  const canManage = canVerifyMembers(ctx.roles, ctx.platformAdmin);
  const isGroupLeader = ctx.ledGroupIds.length > 0;
  if (!canManage && !ctx.platformAdmin && !isGroupLeader) {
    // Non-managers use org-tree for directory.
    return c.json({ error: "forbidden" }, 403);
  }

  const rows = await db
    .select()
    .from(schema.churchMembers)
    .where(eq(schema.churchMembers.churchId, churchId));

  const members = [];
  for (const m of rows) {
    // Group leaders only need verified people for the add-member picker.
    if (!canManage && !ctx.platformAdmin && !m.verified) continue;
    const user = (
      await db.select().from(schema.users).where(eq(schema.users.id, m.userId)).limit(1)
    )[0];
    const roles = parseRolesJson(m.rolesJson, m.role);
    members.push({
      userId: m.userId,
      uid: user?.uid ?? null,
      nickname: user ? await openField(c.env, m.userId, "nickname", user.nicknameCt) : null,
      role: primaryChurchRole(roles),
      roles,
      verified: m.verified,
    });
  }
  return c.json({ churchId, members });
});

const verifyMemberSchema = z.object({
  churchId: z.string().min(1),
  userId: z.string().min(1),
});

homeRoutes.post("/members/verify", async (c) => {
  const body = verifyMemberSchema.parse(await c.req.json());
  const db = drizzle(c.env.DB, { schema });
  const ctx = await loadMembershipContext(db, c.get("userId"), body.churchId);
  if (!ctx || !canVerifyMembers(ctx.roles, ctx.platformAdmin)) {
    return c.json({ error: "forbidden" }, 403);
  }

  const target = (
    await db
      .select()
      .from(schema.churchMembers)
      .where(
        and(
          eq(schema.churchMembers.churchId, body.churchId),
          eq(schema.churchMembers.userId, body.userId),
        ),
      )
      .limit(1)
  )[0];
  if (!target) return c.json({ error: "not_found" }, 404);

  await db
    .update(schema.churchMembers)
    .set({ verified: true })
    .where(eq(schema.churchMembers.id, target.id));

  const church = (
    await db.select().from(schema.churches).where(eq(schema.churches.id, body.churchId)).limit(1)
  )[0];
  if (church?.securityMode === "hostile") {
    await applyHostilePrivacyFloors(db, body.userId);
  }

  return c.json({ ok: true, churchId: body.churchId, userId: body.userId, verified: true });
});

const patchRolesSchema = z.object({
  churchId: z.string().min(1),
  userId: z.string().min(1),
  roles: z.array(churchRoleSchema).min(1),
});

/** 安全官 / platform admin assigns multi-roles (职分 + 安全官). */
homeRoutes.post("/members/roles", async (c) => {
  const body = patchRolesSchema.parse(await c.req.json());
  const db = drizzle(c.env.DB, { schema });
  const ctx = await loadMembershipContext(db, c.get("userId"), body.churchId);
  if (!ctx || !canAssignChurchRoles(ctx.roles, ctx.platformAdmin)) {
    return c.json({ error: "forbidden" }, 403);
  }
  const target = (
    await db
      .select()
      .from(schema.churchMembers)
      .where(
        and(
          eq(schema.churchMembers.churchId, body.churchId),
          eq(schema.churchMembers.userId, body.userId),
        ),
      )
      .limit(1)
  )[0];
  if (!target) return c.json({ error: "not_found" }, 404);
  const synced = syncPrimaryRole(body.roles);
  await db
    .update(schema.churchMembers)
    .set({ role: synced.role, rolesJson: synced.rolesJson })
    .where(eq(schema.churchMembers.id, target.id));
  return c.json({ ok: true, userId: body.userId, role: synced.role, roles: body.roles });
});
