import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import {
  canCreateGroup,
  canVerifyMembers,
  churchRoleSchema,
  createId,
  forumPostSchema,
  groupKindSchema,
  groupRoleSchema,
  isAllowedExternalMediaUrl,
  isOwnedMediaKey,
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
import {
  assertCanManageGroupMembers,
  buildOrgTree,
  loadMembershipContext,
  loadPlatformAdmin,
  syncPrimaryRole,
} from "../services/church-access";

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
  const roles: ChurchRole[] = ["admin"];
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

  const posts = await db
    .select()
    .from(schema.forumPosts)
    .where(
      board
        ? and(eq(schema.forumPosts.churchId, churchId), eq(schema.forumPosts.board, board))
        : eq(schema.forumPosts.churchId, churchId),
    );

  if (board === "group") {
    const ctx = await loadMembershipContext(db, c.get("userId"), churchId);
    const allowed = new Set(ctx?.groupIds.length ? ctx.groupIds : memberGroupIds(membership));
    return c.json({ posts: posts.filter((p) => p.groupId && allowed.has(p.groupId)) });
  }

  return c.json({ posts });
});

/** Board index for community L1 navigation. */
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

  const posts = await db
    .select()
    .from(schema.forumPosts)
    .where(eq(schema.forumPosts.churchId, churchId));

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

  const id = createId("post");
  await db.insert(schema.forumPosts).values({
    id,
    churchId: body.churchId,
    groupId: body.groupId,
    authorId: userId,
    board: body.board,
    title: body.title,
    body: body.body,
    externalMediaUrl: body.externalMediaUrl,
    mediaKey: body.mediaKey,
    createdAt: Date.now(),
  });
  return c.json({ id, mediaKey: body.mediaKey ?? null }, 201);
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

/** Roster for verify / management (church admin+) or visibility-filtered directory. */
homeRoutes.get("/:churchId/members", async (c) => {
  const churchId = c.req.param("churchId");
  const db = drizzle(c.env.DB, { schema });
  const ctx = await loadMembershipContext(db, c.get("userId"), churchId);
  if (!ctx) return c.json({ error: "forbidden" }, 403);

  const canManage = canVerifyMembers(ctx.roles, ctx.platformAdmin);
  if (!canManage && !ctx.platformAdmin) {
    // Non-admins use org-tree for directory; keep this for admin verify UX.
    return c.json({ error: "forbidden" }, 403);
  }

  const rows = await db
    .select()
    .from(schema.churchMembers)
    .where(eq(schema.churchMembers.churchId, churchId));

  const members = [];
  for (const m of rows) {
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

/** Church admin / platform admin assigns multi-roles. */
homeRoutes.post("/members/roles", async (c) => {
  const body = patchRolesSchema.parse(await c.req.json());
  const db = drizzle(c.env.DB, { schema });
  const ctx = await loadMembershipContext(db, c.get("userId"), body.churchId);
  if (!ctx || !(ctx.platformAdmin || ctx.roles.includes("admin"))) {
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
