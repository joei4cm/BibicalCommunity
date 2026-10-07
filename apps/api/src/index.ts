import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./env";
import { authRoutes } from "./routes/auth";
import { bibleRoutes } from "./routes/bible";
import { meRoutes } from "./routes/me";
import { annotationRoutes } from "./routes/annotations";
import { planRoutes } from "./routes/plans";
import { homeRoutes } from "./routes/home";
import { chatRoutes } from "./routes/chat";
import { adminRoutes } from "./routes/admin";
import { CallRoomDO } from "./durable/CallRoomDO";

const app = new Hono<{ Bindings: Env }>();

app.use(
  "*",
  cors({
    origin: (origin) => origin || "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  }),
);

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
app.route("/v1/admin", adminRoutes);

async function scheduled(_event: ScheduledEvent, env: Env) {
  await env.DB.prepare(
    `UPDATE messages SET tombstoned = 1, ciphertext = '', ratchet_header = ''
     WHERE expires_at IS NOT NULL AND expires_at < ? AND tombstoned = 0`,
  )
    .bind(Date.now())
    .run();
}

export default {
  fetch: app.fetch.bind(app),
  scheduled,
};

export { CallRoomDO };
