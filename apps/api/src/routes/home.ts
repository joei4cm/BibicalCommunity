import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { createId, forumPostSchema, securityModeSchema } from "@logoshome/shared";
import type { Env } from "../env";
import * as schema from "../db/schema";
import { requireAuth, type AuthVars } from "../middleware/auth";
import {
  applyHostilePrivacyFloors,
  applyHostilePrivacyFloorsToChurch,
} from "../services/hostile-privacy";

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
      churches.push({
        ...church,
        role: m.role,
        verified: m.verified,
        groups: JSON.parse(m.groupIdsJson || "[]"),
      });
    }
  }
  // Re-enforce hostile privacy floors for members of any hostile church.
  if (inHostile) {
    await applyHostilePrivacyFloors(db, userId);
  }
  return c.json({ churches });
});

/** Bootstrap: create a church and join the caller as admin. */
homeRoutes.post("/churches", async (c) => {
  const body = seedChurchSchema.parse(await c.req.json());
  const db = drizzle(c.env.DB, { schema });
  const existing = (
    await db.select().from(schema.churches).where(eq(schema.churches.slug, body.slug)).limit(1)
  )[0];
  if (existing) return c.json({ error: "slug_taken" }, 409);

  const churchId = createId("church");
  const memberId = createId("cmbr");
  const now = Date.now();
  const securityMode = body.securityMode ?? "standard";
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
    userId: c.get("userId"),
    role: "admin",
    verified: true,
    groupIdsJson: "[]",
    createdAt: now,
  });

  if (securityMode === "hostile") {
    await applyHostilePrivacyFloors(db, c.get("userId"));
  }

  return c.json(
    { id: churchId, name: body.name, slug: body.slug, role: "admin", securityMode },
    201,
  );
});

/** Join an existing church as member; hostile churches force privacy floors. */
homeRoutes.post("/churches/:id/join", async (c) => {
  const churchId = c.req.param("id");
  const db = drizzle(c.env.DB, { schema });
  const userId = c.get("userId");
  const church = (
    await db.select().from(schema.churches).where(eq(schema.churches.id, churchId)).limit(1)
  )[0];
  if (!church) return c.json({ error: "not_found" }, 404);

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
    return c.json({ id: existing.id, churchId, role: existing.role, alreadyMember: true });
  }

  const memberId = createId("cmbr");
  await db.insert(schema.churchMembers).values({
    id: memberId,
    churchId,
    userId,
    role: "member",
    verified: false,
    groupIdsJson: "[]",
    createdAt: Date.now(),
  });

  if (church.securityMode === "hostile") {
    await applyHostilePrivacyFloors(db, userId);
  }

  return c.json({ id: memberId, churchId, role: "member", alreadyMember: false }, 201);
});

/** Admin-only: switch church security mode. Hostile applies floors to all members. */
homeRoutes.patch("/churches/:id/security", async (c) => {
  const churchId = c.req.param("id");
  const body = patchSecuritySchema.parse(await c.req.json());
  const db = drizzle(c.env.DB, { schema });
  const actor = (
    await db
      .select()
      .from(schema.churchMembers)
      .where(
        and(eq(schema.churchMembers.churchId, churchId), eq(schema.churchMembers.userId, c.get("userId"))),
      )
      .limit(1)
  )[0];
  if (!actor || (actor.role !== "admin" && actor.role !== "security_officer")) {
    return c.json({ error: "forbidden" }, 403);
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
  return c.json({ posts });
});

homeRoutes.post("/posts", async (c) => {
  const body = forumPostSchema.parse(await c.req.json());
  const db = drizzle(c.env.DB, { schema });
  const membership = (
    await db
      .select()
      .from(schema.churchMembers)
      .where(
        and(
          eq(schema.churchMembers.churchId, body.churchId),
          eq(schema.churchMembers.userId, c.get("userId")),
        ),
      )
      .limit(1)
  )[0];
  if (!membership) return c.json({ error: "forbidden" }, 403);

  const id = createId("post");
  await db.insert(schema.forumPosts).values({
    id,
    churchId: body.churchId,
    groupId: body.groupId,
    authorId: c.get("userId"),
    board: body.board,
    title: body.title,
    body: body.body,
    externalMediaUrl: body.externalMediaUrl,
    createdAt: Date.now(),
  });
  return c.json({ id }, 201);
});

const createGroupSchema = z.object({
  churchId: z.string().min(1),
  name: z.string().min(1).max(200),
});

homeRoutes.post("/groups", async (c) => {
  const body = createGroupSchema.parse(await c.req.json());
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

  const id = createId("grp");
  const now = Date.now();
  await db.insert(schema.churchGroups).values({
    id,
    churchId: body.churchId,
    name: body.name,
    createdAt: now,
  });

  let groupIds: string[] = [];
  try {
    groupIds = JSON.parse(membership.groupIdsJson || "[]") as string[];
  } catch {
    groupIds = [];
  }
  if (!groupIds.includes(id)) groupIds.push(id);
  await db
    .update(schema.churchMembers)
    .set({ groupIdsJson: JSON.stringify(groupIds) })
    .where(eq(schema.churchMembers.id, membership.id));

  return c.json({ id, churchId: body.churchId, name: body.name }, 201);
});

/** Admin roster: list church members for verify UX (no raw paste required). */
homeRoutes.get("/:churchId/members", async (c) => {
  const churchId = c.req.param("churchId");
  const db = drizzle(c.env.DB, { schema });
  const actor = (
    await db
      .select()
      .from(schema.churchMembers)
      .where(
        and(
          eq(schema.churchMembers.churchId, churchId),
          eq(schema.churchMembers.userId, c.get("userId")),
        ),
      )
      .limit(1)
  )[0];
  if (!actor || (actor.role !== "admin" && actor.role !== "security_officer")) {
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
    members.push({
      userId: m.userId,
      uid: user?.uid ?? null,
      role: m.role,
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
  const actor = (
    await db
      .select()
      .from(schema.churchMembers)
      .where(
        and(
          eq(schema.churchMembers.churchId, body.churchId),
          eq(schema.churchMembers.userId, c.get("userId")),
        ),
      )
      .limit(1)
  )[0];
  if (!actor || (actor.role !== "admin" && actor.role !== "security_officer")) {
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
