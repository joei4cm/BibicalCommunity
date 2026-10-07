import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { createId, forumPostSchema } from "@logoshome/shared";
import type { Env } from "../env";
import * as schema from "../db/schema";
import { requireAuth, type AuthVars } from "../middleware/auth";

export const homeRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();
homeRoutes.use("*", requireAuth);

const seedChurchSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

homeRoutes.get("/churches", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const memberships = await db
    .select()
    .from(schema.churchMembers)
    .where(eq(schema.churchMembers.userId, c.get("userId")));
  const churches = [];
  for (const m of memberships) {
    const church = (
      await db.select().from(schema.churches).where(eq(schema.churches.id, m.churchId)).limit(1)
    )[0];
    if (church) {
      churches.push({
        ...church,
        role: m.role,
        verified: m.verified,
        groups: JSON.parse(m.groupIdsJson || "[]"),
      });
    }
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
  await db.insert(schema.churches).values({
    id: churchId,
    name: body.name,
    slug: body.slug,
    securityMode: "standard",
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

  return c.json({ id: churchId, name: body.name, slug: body.slug, role: "admin" }, 201);
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
