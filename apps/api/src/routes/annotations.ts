import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { and, eq } from "drizzle-orm";
import { annotationSchema, createId } from "@logoshome/shared";
import type { Env } from "../env";
import * as schema from "../db/schema";
import { requireAuth, type AuthVars } from "../middleware/auth";

export const annotationRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();
annotationRoutes.use("*", requireAuth);

annotationRoutes.get("/", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const translationId = c.req.query("translation");
  const rows = await db
    .select()
    .from(schema.annotations)
    .where(
      translationId
        ? and(eq(schema.annotations.userId, c.get("userId")), eq(schema.annotations.translationId, translationId))
        : eq(schema.annotations.userId, c.get("userId")),
    );
  return c.json({ annotations: rows });
});

annotationRoutes.post("/", async (c) => {
  const body = annotationSchema.parse(await c.req.json());
  const db = drizzle(c.env.DB, { schema });
  const now = Date.now();
  const id = createId("ann");
  await db.insert(schema.annotations).values({
    id,
    userId: c.get("userId"),
    translationId: body.translationId,
    book: body.ref.book,
    chapter: body.ref.chapter,
    verseStart: body.ref.verseStart,
    verseEnd: body.ref.verseEnd,
    kind: body.kind,
    color: body.color,
    ciphertext: body.ciphertext,
    iv: body.iv,
    createdAt: now,
    updatedAt: now,
  });
  return c.json({ id }, 201);
});

annotationRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const db = drizzle(c.env.DB, { schema });
  const deleted = await db
    .delete(schema.annotations)
    .where(and(eq(schema.annotations.id, id), eq(schema.annotations.userId, c.get("userId"))))
    .returning({ id: schema.annotations.id });
  if (deleted.length === 0) {
    return c.json({ error: "not_found" }, 404);
  }
  return c.json({ ok: true, id });
});
