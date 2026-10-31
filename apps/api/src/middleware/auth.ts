import { createMiddleware } from "hono/factory";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import type { Env } from "../env";
import * as schema from "../db/schema";
import { sha256Hex } from "../services/crypto";

export type AuthVars = {
  userId: string;
  deviceId: string;
  sessionId: string;
};

export const requireAuth = createMiddleware<{ Bindings: Env; Variables: AuthVars }>(
  async (c, next) => {
    const header = c.req.header("authorization");
    if (!header?.startsWith("Bearer ")) {
      return c.json({ error: "unauthorized" }, 401);
    }
    const token = header.slice(7);
    const tokenHash = await sha256Hex(token);
    const db = drizzle(c.env.DB, { schema });
    const rows = await db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.tokenHash, tokenHash))
      .limit(1);
    const session = rows[0];
    if (!session || session.expiresAt < Date.now()) {
      return c.json({ error: "unauthorized" }, 401);
    }
    const user = (
      await db
        .select({ tombstoned: schema.users.tombstoned })
        .from(schema.users)
        .where(eq(schema.users.id, session.userId))
        .limit(1)
    )[0];
    if (!user || user.tombstoned) {
      return c.json({ error: "unauthorized" }, 401);
    }
    c.set("userId", session.userId);
    c.set("deviceId", session.deviceId);
    c.set("sessionId", session.id);
    await next();
  },
);
