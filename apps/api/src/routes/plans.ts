import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
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

planRoutes.get("/subscriptions", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const userId = c.get("userId");
  const subs = await db
    .select()
    .from(schema.planSubscriptions)
    .where(eq(schema.planSubscriptions.userId, userId));

  const plans = [];
  for (const sub of subs) {
    const plan = (
      await db.select().from(schema.readingPlans).where(eq(schema.readingPlans.id, sub.planId)).limit(1)
    )[0];
    if (!plan) continue;
    plans.push({
      subscriptionId: sub.id,
      planId: plan.id,
      title: plan.title,
      description: plan.description,
      visibility: plan.visibility,
      days: JSON.parse(plan.daysJson),
      progressDay: sub.progressDay,
      devotionStep: sub.devotionStep ?? "pause",
      devotionMaterialId: sub.devotionMaterialId ?? null,
      subscribedAt: sub.createdAt,
    });
  }
  return c.json({ subscriptions: plans });
});

planRoutes.get("/public", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const rows = await db
    .select()
    .from(schema.readingPlans)
    .where(eq(schema.readingPlans.visibility, "public"))
    .limit(50);
  return c.json({
    plans: rows.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      visibility: p.visibility,
      days: JSON.parse(p.daysJson),
      ownerId: p.ownerId,
      createdAt: p.createdAt,
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
    devotionStep: "pause",
    createdAt: Date.now(),
  });
  return c.json({ id }, 201);
});

const progressSchema = z.object({
  day: z.number().int().nonnegative(),
});

const DEVOTION_STEPS = ["pause", "read", "reflect", "pray", "act"] as const;

const devotionSchema = z.object({
  step: z.enum(DEVOTION_STEPS),
  materialId: z.string().min(1).max(128).optional().nullable(),
});

planRoutes.post("/:id/progress", async (c) => {
  const body = progressSchema.parse(await c.req.json());
  const db = drizzle(c.env.DB, { schema });
  const planId = c.req.param("id");
  const userId = c.get("userId");
  const sub = (
    await db
      .select()
      .from(schema.planSubscriptions)
      .where(
        and(eq(schema.planSubscriptions.planId, planId), eq(schema.planSubscriptions.userId, userId)),
      )
      .limit(1)
  )[0];
  if (!sub) return c.json({ error: "not_subscribed" }, 404);

  await db
    .update(schema.planSubscriptions)
    .set({ progressDay: body.day })
    .where(eq(schema.planSubscriptions.id, sub.id));

  return c.json({ ok: true, planId, progressDay: body.day });
});

planRoutes.post("/:id/devotion", async (c) => {
  const body = devotionSchema.parse(await c.req.json());
  const db = drizzle(c.env.DB, { schema });
  const planId = c.req.param("id");
  const userId = c.get("userId");
  const sub = (
    await db
      .select()
      .from(schema.planSubscriptions)
      .where(
        and(eq(schema.planSubscriptions.planId, planId), eq(schema.planSubscriptions.userId, userId)),
      )
      .limit(1)
  )[0];
  if (!sub) return c.json({ error: "not_subscribed" }, 404);

  const patch: Partial<typeof schema.planSubscriptions.$inferInsert> = {
    devotionStep: body.step,
  };
  if (body.materialId !== undefined) {
    patch.devotionMaterialId = body.materialId;
  }

  await db
    .update(schema.planSubscriptions)
    .set(patch)
    .where(eq(schema.planSubscriptions.id, sub.id));

  return c.json({
    ok: true,
    planId,
    devotionStep: body.step,
    devotionMaterialId: body.materialId === undefined ? (sub.devotionMaterialId ?? null) : body.materialId,
  });
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
