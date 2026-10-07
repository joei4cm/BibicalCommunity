import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { createId, readingPlanSchema } from "@logoshome/shared";
import { parsePlanCsv } from "@logoshome/bible";
import type { Env } from "../env";
import * as schema from "../db/schema";
import { requireAuth, type AuthVars } from "../middleware/auth";

export const planRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();
planRoutes.use("*", requireAuth);

planRoutes.get("/", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const owned = await db
    .select()
    .from(schema.readingPlans)
    .where(eq(schema.readingPlans.ownerId, c.get("userId")));
  return c.json({
    plans: owned.map((p) => ({
      ...p,
      days: JSON.parse(p.daysJson),
    })),
  });
});

planRoutes.post("/", async (c) => {
  const body = readingPlanSchema.parse(await c.req.json());
  const db = drizzle(c.env.DB, { schema });
  const now = Date.now();
  const id = createId("plan");
  await db.insert(schema.readingPlans).values({
    id,
    ownerId: c.get("userId"),
    title: body.title,
    description: body.description,
    visibility: body.visibility,
    daysJson: JSON.stringify(body.days),
    createdAt: now,
    updatedAt: now,
  });
  return c.json({ id }, 201);
});

planRoutes.post("/import-csv", async (c) => {
  const form = await c.req.parseBody();
  const title = String(form.title ?? "Imported plan");
  const csv = String(form.csv ?? "");
  const days = parsePlanCsv(csv);
  const db = drizzle(c.env.DB, { schema });
  const now = Date.now();
  const id = createId("plan");
  await db.insert(schema.readingPlans).values({
    id,
    ownerId: c.get("userId"),
    title,
    description: "Imported from CSV",
    visibility: "private",
    daysJson: JSON.stringify(days),
    createdAt: now,
    updatedAt: now,
  });
  return c.json({ id, days: days.length }, 201);
});

planRoutes.post("/:id/subscribe", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const planId = c.req.param("id");
  const id = createId("psub");
  await db.insert(schema.planSubscriptions).values({
    id,
    planId,
    userId: c.get("userId"),
    progressDay: 0,
    createdAt: Date.now(),
  });
  return c.json({ id }, 201);
});

planRoutes.patch("/:id", async (c) => {
  const body = readingPlanSchema.partial().parse(await c.req.json());
  const db = drizzle(c.env.DB, { schema });
  const patch: Partial<typeof schema.readingPlans.$inferInsert> = { updatedAt: Date.now() };
  if (body.title) patch.title = body.title;
  if (body.description !== undefined) patch.description = body.description;
  if (body.visibility) patch.visibility = body.visibility;
  if (body.days) patch.daysJson = JSON.stringify(body.days);
  await db
    .update(schema.readingPlans)
    .set(patch)
    .where(eq(schema.readingPlans.id, c.req.param("id")));
  return c.json({ ok: true });
});
