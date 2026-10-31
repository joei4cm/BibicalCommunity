import { Hono } from "hono";
import { z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import { and, eq, isNull } from "drizzle-orm";
import { createId } from "@logoshome/shared";
import type { Env } from "../env";
import * as schema from "../db/schema";
import { requireAuth, type AuthVars } from "../middleware/auth";
import { canFetchPeerKeys } from "../services/access-graph";
import { enforceRateLimit } from "../services/rate-limit";

export const keysRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();

keysRoutes.use("*", requireAuth);

const bundleBody = z.object({
  identityKeyPub: z.string().min(1),
  signedPrekeyPub: z.string().min(1),
  signedPrekeySig: z.string().min(1),
  signedPrekeyId: z.number().int().nonnegative(),
  registrationId: z.number().int().nonnegative(),
});

keysRoutes.put("/bundle", async (c) => {
  const body = bundleBody.parse(await c.req.json());
  const db = drizzle(c.env.DB, { schema });
  const deviceId = c.get("deviceId");
  const userId = c.get("userId");

  const device = (
    await db.select().from(schema.devices).where(eq(schema.devices.id, deviceId)).limit(1)
  )[0];
  if (!device || device.userId !== userId || device.revoked) {
    return c.json({ error: "device_not_found" }, 404);
  }

  await db
    .update(schema.devices)
    .set({
      identityKeyPub: body.identityKeyPub,
      signedPrekeyPub: body.signedPrekeyPub,
      signedPrekeySig: body.signedPrekeySig,
      signedPrekeyId: body.signedPrekeyId,
      registrationId: body.registrationId,
    })
    .where(eq(schema.devices.id, deviceId));

  return c.json({ ok: true, deviceId });
});

const prekeysBody = z.object({
  prekeys: z
    .array(
      z.object({
        id: z.number().int().nonnegative(),
        pub: z.string().min(1),
      }),
    )
    .min(1)
    .max(100),
});

keysRoutes.put("/prekeys", async (c) => {
  const body = prekeysBody.parse(await c.req.json());
  const db = drizzle(c.env.DB, { schema });
  const userId = c.get("userId");
  const deviceId = c.get("deviceId");

  const device = (
    await db.select().from(schema.devices).where(eq(schema.devices.id, deviceId)).limit(1)
  )[0];
  if (!device || device.userId !== userId || device.revoked) {
    return c.json({ error: "device_not_found" }, 404);
  }

  const values = body.prekeys.map((pk) => ({
    id: createId("opk"),
    userId,
    deviceId,
    prekeyId: pk.id,
    prekeyPub: pk.pub,
    consumedAt: null as number | null,
  }));

  await db.insert(schema.oneTimePrekeys).values(values);

  return c.json({ ok: true, inserted: values.length });
});

keysRoutes.get("/:userId", async (c) => {
  const rl = await enforceRateLimit(c.env.DB, `keys:get:${c.get("userId")}`, 60, 60_000);
  if (!rl.ok) {
    return c.json({ error: "rate_limited", retryAfterSec: rl.retryAfterSec }, 429);
  }
  const targetUserId = c.req.param("userId");
  const db = drizzle(c.env.DB, { schema });
  const selfId = c.get("userId");
  if (!(await canFetchPeerKeys(db, selfId, targetUserId))) {
    return c.json({ error: "forbidden" }, 403);
  }

  const deviceRows = await db
    .select()
    .from(schema.devices)
    .where(and(eq(schema.devices.userId, targetUserId), eq(schema.devices.revoked, false)));

  const devices = [];
  for (const device of deviceRows) {
    if (!device.identityKeyPub || !device.signedPrekeyPub) {
      devices.push({
        deviceId: device.id,
        platform: device.platform,
        identityKeyPub: device.identityKeyPub,
        signedPrekeyPub: device.signedPrekeyPub,
        signedPrekeySig: device.signedPrekeySig,
        signedPrekeyId: device.signedPrekeyId,
        registrationId: device.registrationId,
        oneTimePrekey: null,
      });
      continue;
    }

    const opk = (
      await db
        .select()
        .from(schema.oneTimePrekeys)
        .where(
          and(
            eq(schema.oneTimePrekeys.deviceId, device.id),
            isNull(schema.oneTimePrekeys.consumedAt),
          ),
        )
        .limit(1)
    )[0];

    let oneTimePrekey: { id: number; pub: string } | null = null;
    if (opk) {
      const now = Date.now();
      await db
        .update(schema.oneTimePrekeys)
        .set({ consumedAt: now })
        .where(eq(schema.oneTimePrekeys.id, opk.id));
      oneTimePrekey = { id: opk.prekeyId, pub: opk.prekeyPub };
    }

    devices.push({
      deviceId: device.id,
      platform: device.platform,
      identityKeyPub: device.identityKeyPub,
      signedPrekeyPub: device.signedPrekeyPub,
      signedPrekeySig: device.signedPrekeySig,
      signedPrekeyId: device.signedPrekeyId,
      registrationId: device.registrationId,
      oneTimePrekey,
    });
  }

  return c.json({ userId: targetUserId, devices });
});
