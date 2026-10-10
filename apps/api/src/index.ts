import { Hono } from "hono";
import { cors } from "hono/cors";
import { ZodError } from "zod";
import type { Env } from "./env";
import { authRoutes } from "./routes/auth";
import { bibleRoutes } from "./routes/bible";
import { meRoutes } from "./routes/me";
import { annotationRoutes } from "./routes/annotations";
import { planRoutes } from "./routes/plans";
import { homeRoutes } from "./routes/home";
import { chatRoutes } from "./routes/chat";
import { friendsRoutes } from "./routes/friends";
import { calendarRoutes } from "./routes/calendar";
import { inboxRoutes } from "./routes/inbox";
import { adminRoutes } from "./routes/admin";
import { mediaRoutes } from "./routes/media";
import { keysRoutes } from "./routes/keys";
import { callRoutes } from "./routes/calls";
import { partnerRoutes } from "./routes/partners";
import { CallRoomDO } from "./durable/CallRoomDO";

const app = new Hono<{ Bindings: Env }>();

app.use(
  "*",
  cors({
    origin: (origin) => origin || "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);

app.onError((err, c) => {
  if (err instanceof ZodError) {
    return c.json(
      {
        error: "validation_error",
        issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
      400,
    );
  }
  console.error(err);
  return c.json({ error: "internal_error" }, 500);
});

app.get("/health", (c) =>
  c.json({
    ok: true,
    app: c.env.APP_NAME,
    env: c.env.ENVIRONMENT,
  }),
);

app.route("/v1/auth", authRoutes);
app.route("/v1/bible", bibleRoutes);
app.route("/v1/me", meRoutes);
app.route("/v1/annotations", annotationRoutes);
app.route("/v1/plans", planRoutes);
app.route("/v1/home", homeRoutes);
app.route("/v1/chat", chatRoutes);
app.route("/v1/friends", friendsRoutes);
app.route("/v1/calendar", calendarRoutes);
app.route("/v1/inbox", inboxRoutes);
app.route("/v1/admin", adminRoutes);
app.route("/v1/media", mediaRoutes);
app.route("/v1/keys", keysRoutes);
app.route("/v1/calls", callRoutes);
app.route("/v1/partners", partnerRoutes);

async function scheduled(_event: ScheduledEvent, env: Env) {
  const now = Date.now();
  // TTL tombstone for disappearing messages.
  await env.DB.prepare(
    `UPDATE messages SET tombstoned = 1, ciphertext = '', ratchet_header = ''
     WHERE expires_at IS NOT NULL AND expires_at < ? AND tombstoned = 0`,
  )
    .bind(now)
    .run();

  // Expire stale wipe commands that were never acked (SECURITY.md §7 sweep).
  await env.DB.prepare(
    `UPDATE wipe_commands SET status = 'expired'
     WHERE status = 'pending' AND expires_at < ?`,
  )
    .bind(now)
    .run();
}

export default {
  fetch: app.fetch.bind(app),
  scheduled,
};

export { CallRoomDO };
