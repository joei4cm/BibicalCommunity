import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { createId, wipeCommandSchema } from "@logoshome/shared";
import type { Env } from "../env";
import { requireMedia } from "../media-binding";
import * as schema from "../db/schema";
import { requireAuth, type AuthVars } from "../middleware/auth";
import { randomToken, sha256Hex } from "../services/crypto";
import { assertChurchAdmin, loadAdminAccess } from "../services/admin-access";
import { applyHostilePrivacyFloorsToChurch } from "../services/hostile-privacy";
import { deleteUserMediaObjects } from "../services/wipe-media";
import {
  countPdCorpusObjects,
  isPdSeedTranslationId,
  osisForBookNr,
  PD_SEED_TRANSLATION_IDS,
  seedPdBookToR2,
} from "../services/pd-corpus-seed";
import { countD1CorpusChapters, seedD1BootCorpus } from "../services/corpus-d1";
import { securityModeSchema } from "@logoshome/shared";

export const adminRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();

/**
 * Ack is intentionally unauthenticated: wipe deletes sessions immediately,
 * so clients must confirm with the one-time wipeToken from the wipe response
 * (or a still-valid Bearer session if present).
 */
adminRoutes.post("/wipe/:id/ack", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const id = c.req.param("id");
  const cmd = (
    await db.select().from(schema.wipeCommands).where(eq(schema.wipeCommands.id, id)).limit(1)
  )[0];
  if (!cmd) return c.json({ error: "not_found" }, 404);

  let authorized = false;
  const header = c.req.header("authorization");
  if (header?.startsWith("Bearer ")) {
    const tokenHash = await sha256Hex(header.slice(7));
    const session = (
      await db.select().from(schema.sessions).where(eq(schema.sessions.tokenHash, tokenHash)).limit(1)
    )[0];
    if (session && session.userId === cmd.userId && session.expiresAt >= Date.now()) {
      authorized = true;
    }
  }

  if (!authorized) {
    let body: { wipeToken?: string } = {};
    try {
      body = z.object({ wipeToken: z.string().optional() }).parse(await c.req.json());
    } catch {
      body = {};
    }
    if (body.wipeToken) {
      const hash = await sha256Hex(body.wipeToken);
      if (hash === cmd.tokenHash) authorized = true;
    }
  }

  if (!authorized) return c.json({ error: "unauthorized" }, 401);

  await db.update(schema.wipeCommands).set({ status: "completed" }).where(eq(schema.wipeCommands.id, id));
  return c.json({ ok: true });
});

adminRoutes.use("*", requireAuth);

adminRoutes.get("/access", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const access = await loadAdminAccess(db, c.get("userId"));
  return c.json(access);
});

/** Promote caller to platform_admin when bootstrap secret matches (local/dev). */
adminRoutes.post("/platform/bootstrap", async (c) => {
  const secret = c.env.PLATFORM_ADMIN_BOOTSTRAP_SECRET;
  if (!secret) return c.json({ error: "bootstrap_disabled" }, 403);
  const body = z.object({ secret: z.string().min(1) }).parse(await c.req.json());
  if (body.secret !== secret) return c.json({ error: "forbidden" }, 403);
  const db = drizzle(c.env.DB, { schema });
  await db
    .update(schema.users)
    .set({ platformRole: "platform_admin" })
    .where(eq(schema.users.id, c.get("userId")));
  return c.json({ ok: true, platformRole: "platform_admin" });
});

adminRoutes.get("/churches", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const access = await loadAdminAccess(db, c.get("userId"));
  if (!access.canAccessConsole) return c.json({ error: "forbidden" }, 403);

  if (access.platformAdmin) {
    const rows = await db.select().from(schema.churches).limit(200);
    const churches = [];
    for (const church of rows) {
      const members = await db
        .select()
        .from(schema.churchMembers)
        .where(eq(schema.churchMembers.churchId, church.id));
      const groups = await db
        .select()
        .from(schema.churchGroups)
        .where(eq(schema.churchGroups.churchId, church.id));
      churches.push({
        id: church.id,
        name: church.name,
        slug: church.slug,
        securityMode: church.securityMode,
        createdAt: church.createdAt,
        memberCount: members.length,
        groupCount: groups.length,
        role: access.churches.find((x) => x.churchId === church.id)?.role ?? "platform_admin",
      });
    }
    return c.json({ churches, platformAdmin: true });
  }

  const churches = [];
  for (const scoped of access.churches) {
    const members = await db
      .select()
      .from(schema.churchMembers)
      .where(eq(schema.churchMembers.churchId, scoped.churchId));
    const groups = await db
      .select()
      .from(schema.churchGroups)
      .where(eq(schema.churchGroups.churchId, scoped.churchId));
    churches.push({
      id: scoped.churchId,
      name: scoped.name,
      slug: scoped.slug,
      securityMode: scoped.securityMode,
      memberCount: members.length,
      groupCount: groups.length,
      role: scoped.role,
    });
  }
  return c.json({ churches, platformAdmin: false });
});

const patchChurchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  securityMode: securityModeSchema.optional(),
});

adminRoutes.patch("/churches/:churchId", async (c) => {
  const churchId = c.req.param("churchId");
  const db = drizzle(c.env.DB, { schema });
  try {
    await assertChurchAdmin(db, c.get("userId"), churchId);
  } catch {
    return c.json({ error: "forbidden" }, 403);
  }
  const body = patchChurchSchema.parse(await c.req.json());
  const patch: Partial<typeof schema.churches.$inferInsert> = {};
  if (body.name) patch.name = body.name;
  if (body.securityMode) patch.securityMode = body.securityMode;
  if (Object.keys(patch).length === 0) return c.json({ error: "empty_patch" }, 400);

  await db.update(schema.churches).set(patch).where(eq(schema.churches.id, churchId));
  if (body.securityMode === "hostile") {
    await applyHostilePrivacyFloorsToChurch(db, churchId);
  }
  const church = (
    await db.select().from(schema.churches).where(eq(schema.churches.id, churchId)).limit(1)
  )[0];
  return c.json({ ok: true, church });
});

adminRoutes.get("/churches/:churchId/members", async (c) => {
  const churchId = c.req.param("churchId");
  const db = drizzle(c.env.DB, { schema });
  try {
    await assertChurchAdmin(db, c.get("userId"), churchId);
  } catch {
    return c.json({ error: "forbidden" }, 403);
  }
  const members = await db
    .select()
    .from(schema.churchMembers)
    .where(eq(schema.churchMembers.churchId, churchId));
  const out = [];
  for (const m of members) {
    const user = (
      await db.select().from(schema.users).where(eq(schema.users.id, m.userId)).limit(1)
    )[0];
    out.push({
      membershipId: m.id,
      userId: m.userId,
      uid: user?.uid ?? null,
      role: m.role,
      verified: m.verified,
      tombstoned: Boolean(user?.tombstoned),
      platformRole: user?.platformRole ?? null,
      groups: JSON.parse(m.groupIdsJson || "[]") as string[],
      createdAt: m.createdAt,
    });
  }
  return c.json({ members: out });
});

const patchMemberSchema = z.object({
  role: z.enum(["member", "admin", "security_officer"]).optional(),
  verified: z.boolean().optional(),
  groupIds: z.array(z.string()).optional(),
});

adminRoutes.patch("/churches/:churchId/members/:userId", async (c) => {
  const churchId = c.req.param("churchId");
  const targetUserId = c.req.param("userId");
  const db = drizzle(c.env.DB, { schema });
  try {
    await assertChurchAdmin(db, c.get("userId"), churchId);
  } catch {
    return c.json({ error: "forbidden" }, 403);
  }
  const body = patchMemberSchema.parse(await c.req.json());
  const member = (
    await db
      .select()
      .from(schema.churchMembers)
      .where(
        and(
          eq(schema.churchMembers.churchId, churchId),
          eq(schema.churchMembers.userId, targetUserId),
        ),
      )
      .limit(1)
  )[0];
  if (!member) return c.json({ error: "not_found" }, 404);

  const patch: Partial<typeof schema.churchMembers.$inferInsert> = {};
  if (body.role) patch.role = body.role;
  if (body.verified !== undefined) patch.verified = body.verified;
  if (body.groupIds) patch.groupIdsJson = JSON.stringify(body.groupIds);
  await db.update(schema.churchMembers).set(patch).where(eq(schema.churchMembers.id, member.id));
  return c.json({ ok: true });
});

adminRoutes.delete("/churches/:churchId/members/:userId", async (c) => {
  const churchId = c.req.param("churchId");
  const targetUserId = c.req.param("userId");
  const db = drizzle(c.env.DB, { schema });
  try {
    await assertChurchAdmin(db, c.get("userId"), churchId);
  } catch {
    return c.json({ error: "forbidden" }, 403);
  }
  if (targetUserId === c.get("userId")) {
    return c.json({ error: "cannot_remove_self" }, 400);
  }
  await db
    .delete(schema.churchMembers)
    .where(
      and(
        eq(schema.churchMembers.churchId, churchId),
        eq(schema.churchMembers.userId, targetUserId),
      ),
    );
  return c.json({ ok: true });
});

adminRoutes.get("/churches/:churchId/groups", async (c) => {
  const churchId = c.req.param("churchId");
  const db = drizzle(c.env.DB, { schema });
  try {
    await assertChurchAdmin(db, c.get("userId"), churchId);
  } catch {
    return c.json({ error: "forbidden" }, 403);
  }
  const groups = await db
    .select()
    .from(schema.churchGroups)
    .where(eq(schema.churchGroups.churchId, churchId));
  return c.json({
    groups: groups.map((g) => ({
      id: g.id,
      churchId: g.churchId,
      name: g.name,
      createdAt: g.createdAt,
    })),
  });
});

adminRoutes.post("/churches/:churchId/groups", async (c) => {
  const churchId = c.req.param("churchId");
  const db = drizzle(c.env.DB, { schema });
  try {
    await assertChurchAdmin(db, c.get("userId"), churchId);
  } catch {
    return c.json({ error: "forbidden" }, 403);
  }
  const body = z.object({ name: z.string().min(1).max(120) }).parse(await c.req.json());
  const id = createId("cgrp");
  await db.insert(schema.churchGroups).values({
    id,
    churchId,
    name: body.name,
    createdAt: Date.now(),
  });
  return c.json({ id, name: body.name, churchId }, 201);
});

adminRoutes.patch("/groups/:groupId", async (c) => {
  const groupId = c.req.param("groupId");
  const db = drizzle(c.env.DB, { schema });
  const group = (
    await db.select().from(schema.churchGroups).where(eq(schema.churchGroups.id, groupId)).limit(1)
  )[0];
  if (!group) return c.json({ error: "not_found" }, 404);
  try {
    await assertChurchAdmin(db, c.get("userId"), group.churchId);
  } catch {
    return c.json({ error: "forbidden" }, 403);
  }
  const body = z.object({ name: z.string().min(1).max(120) }).parse(await c.req.json());
  await db
    .update(schema.churchGroups)
    .set({ name: body.name })
    .where(eq(schema.churchGroups.id, groupId));
  return c.json({ ok: true, id: groupId, name: body.name });
});

adminRoutes.delete("/groups/:groupId", async (c) => {
  const groupId = c.req.param("groupId");
  const db = drizzle(c.env.DB, { schema });
  const group = (
    await db.select().from(schema.churchGroups).where(eq(schema.churchGroups.id, groupId)).limit(1)
  )[0];
  if (!group) return c.json({ error: "not_found" }, 404);
  try {
    await assertChurchAdmin(db, c.get("userId"), group.churchId);
  } catch {
    return c.json({ error: "forbidden" }, 403);
  }
  // Drop group id from member groupIdsJson arrays
  const members = await db
    .select()
    .from(schema.churchMembers)
    .where(eq(schema.churchMembers.churchId, group.churchId));
  for (const m of members) {
    const ids = (JSON.parse(m.groupIdsJson || "[]") as string[]).filter((id) => id !== groupId);
    if (ids.length !== JSON.parse(m.groupIdsJson || "[]").length) {
      await db
        .update(schema.churchMembers)
        .set({ groupIdsJson: JSON.stringify(ids) })
        .where(eq(schema.churchMembers.id, m.id));
    }
  }
  await db.delete(schema.churchGroups).where(eq(schema.churchGroups.id, groupId));
  return c.json({ ok: true });
});

/** Users visible to console: members of admin-scoped churches, or all if platform admin. */
adminRoutes.get("/users", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const access = await loadAdminAccess(db, c.get("userId"));
  if (!access.canAccessConsole) return c.json({ error: "forbidden" }, 403);

  const churchFilter = c.req.query("churchId");
  let churchIds: string[];
  if (access.platformAdmin) {
    if (churchFilter) {
      churchIds = [churchFilter];
    } else {
      churchIds = (await db.select({ id: schema.churches.id }).from(schema.churches)).map((r) => r.id);
    }
  } else {
    churchIds = access.churches.map((cScope) => cScope.churchId);
    if (churchFilter) {
      if (!churchIds.includes(churchFilter)) return c.json({ error: "forbidden" }, 403);
      churchIds = [churchFilter];
    }
  }

  const byUser = new Map<
    string,
    {
      userId: string;
      uid: string | null;
      tombstoned: boolean;
      platformRole: string | null;
      createdAt: number;
      memberships: Array<{ churchId: string; role: string; verified: boolean }>;
    }
  >();

  for (const churchId of churchIds) {
    const members = await db
      .select()
      .from(schema.churchMembers)
      .where(eq(schema.churchMembers.churchId, churchId));
    for (const m of members) {
      const user = (
        await db.select().from(schema.users).where(eq(schema.users.id, m.userId)).limit(1)
      )[0];
      if (!user) continue;
      const row = byUser.get(user.id) ?? {
        userId: user.id,
        uid: user.uid,
        tombstoned: Boolean(user.tombstoned),
        platformRole: user.platformRole ?? null,
        createdAt: user.createdAt,
        memberships: [],
      };
      row.memberships.push({ churchId, role: m.role, verified: m.verified });
      byUser.set(user.id, row);
    }
  }

  // Platform admins also see users with no church membership
  if (access.platformAdmin && !churchFilter) {
    const allUsers = await db.select().from(schema.users).limit(500);
    for (const user of allUsers) {
      if (byUser.has(user.id)) continue;
      byUser.set(user.id, {
        userId: user.id,
        uid: user.uid,
        tombstoned: Boolean(user.tombstoned),
        platformRole: user.platformRole ?? null,
        createdAt: user.createdAt,
        memberships: [],
      });
    }
  }

  return c.json({ users: [...byUser.values()] });
});

adminRoutes.get("/wipe/commands", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const access = await loadAdminAccess(db, c.get("userId"));
  if (!access.canAccessConsole) return c.json({ error: "forbidden" }, 403);

  const rows = await db.select().from(schema.wipeCommands).limit(200);
  const scopedUserIds = new Set<string>();
  if (!access.platformAdmin) {
    for (const scoped of access.churches) {
      const members = await db
        .select()
        .from(schema.churchMembers)
        .where(eq(schema.churchMembers.churchId, scoped.churchId));
      for (const m of members) scopedUserIds.add(m.userId);
    }
  }

  const commands = rows
    .filter((r) => access.platformAdmin || scopedUserIds.has(r.userId) || r.issuedBy === c.get("userId"))
    .map((r) => ({
      id: r.id,
      userId: r.userId,
      deviceId: r.deviceId,
      issuedBy: r.issuedBy,
      reasonCode: r.reasonCode,
      status: r.status,
      issuedAt: r.issuedAt,
      expiresAt: r.expiresAt,
    }));
  return c.json({ commands });
});

adminRoutes.post("/wipe", async (c) => {
  const body = wipeCommandSchema.parse(await c.req.json());
  const db = drizzle(c.env.DB, { schema });
  const actorId = c.get("userId");
  // Self-wipe always allowed; cross-user wipe requires church admin or platform admin.
  if (body.userId !== actorId) {
    const access = await loadAdminAccess(db, actorId);
    if (!access.canAccessConsole) return c.json({ error: "forbidden" }, 403);
    if (!access.platformAdmin) {
      const memberships = await db
        .select()
        .from(schema.churchMembers)
        .where(eq(schema.churchMembers.userId, body.userId));
      const targetChurchIds = new Set(memberships.map((m) => m.churchId));
      const overlap = access.churches.some((ch) => targetChurchIds.has(ch.churchId));
      if (!overlap) return c.json({ error: "forbidden" }, 403);
    }
  }

  const token = randomToken();
  const id = createId("wipe");
  const now = Date.now();
  await db.insert(schema.wipeCommands).values({
    id,
    userId: body.userId,
    deviceId: body.deviceId,
    issuedBy: actorId,
    reasonCode: body.reasonCode,
    tokenHash: await sha256Hex(token),
    status: "pending",
    issuedAt: now,
    expiresAt: now + 24 * 60 * 60 * 1000,
  });

  await db.update(schema.users).set({ tombstoned: true }).where(eq(schema.users.id, body.userId));
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, body.userId));

  const convoMemberships = await db
    .select({ conversationId: schema.conversationMembers.conversationId })
    .from(schema.conversationMembers)
    .where(eq(schema.conversationMembers.userId, body.userId));
  const conversationIds = convoMemberships.map((m) => m.conversationId);
  if (conversationIds.length > 0) {
    await db
      .update(schema.messages)
      .set({ tombstoned: true, ciphertext: "", ratchetHeader: "" })
      .where(inArray(schema.messages.conversationId, conversationIds));
  }

  // Zero private note/highlight ciphertext (P3) — destruction, not archival.
  await db
    .update(schema.annotations)
    .set({ ciphertext: "", iv: "", updatedAt: now })
    .where(eq(schema.annotations.userId, body.userId));

  await db.update(schema.devices).set({ revoked: true }).where(eq(schema.devices.userId, body.userId));

  // Destroy user R2 media blobs (P5) under media/{userId}/.
  const r2 = await deleteUserMediaObjects(c.env.MEDIA, body.userId);

  return c.json(
    {
      id,
      wipeToken: token,
      status: "pending",
      r2Deleted: r2.deleted,
      r2Prefix: r2.prefix,
      annotationsZeroed: true,
    },
    201,
  );
});

adminRoutes.get("/wipe/pending", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const rows = await db
    .select()
    .from(schema.wipeCommands)
    .where(eq(schema.wipeCommands.userId, c.get("userId")));
  return c.json({
    commands: rows
      .filter((r) => r.status === "pending")
      .map((r) => ({
        id: r.id,
        deviceId: r.deviceId,
        reasonCode: r.reasonCode,
        expiresAt: r.expiresAt,
      })),
  });
});

/**
 * Public-domain corpus inventory in R2 (platform_admin only).
 * Corpora live on R2 / client local DB — never TypeScript packs.
 */
adminRoutes.get("/corpus/pd-status/:tid", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const access = await loadAdminAccess(db, c.get("userId"));
  if (!access.platformAdmin) return c.json({ error: "forbidden" }, 403);

  const tid = c.req.param("tid");
  if (!isPdSeedTranslationId(tid)) {
    return c.json(
      { error: "invalid_tid", allowed: [...PD_SEED_TRANSLATION_IDS] },
      400,
    );
  }
  const media = requireMedia(c);
  if (media instanceof Response) return media;
  const status = await countPdCorpusObjects(media, tid);
  return c.json({
    tid,
    ...status,
    /** Protestant canon ≈ 1189 chapters; allow small variance. */
    fullPackLikely: status.objectCount >= 1100,
    allowedTids: [...PD_SEED_TRANSLATION_IDS],
  });
});

/**
 * Seed boot corpora (cuvs+nasb demo packs) into D1 — for temporary Workers without R2.
 * platform_admin only. Does not close CORPUS_LIVE_R2 (production still needs R2).
 */
adminRoutes.post("/corpus/d1-seed-boot", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const access = await loadAdminAccess(db, c.get("userId"));
  if (!access.platformAdmin) return c.json({ error: "forbidden" }, 403);

  const result = await seedD1BootCorpus(db);
  const counts: Record<string, number> = {};
  for (const tid of result.tids) {
    counts[tid] = await countD1CorpusChapters(db, tid);
  }
  return c.json({
    ok: true,
    source: "d1" as const,
    ...result,
    counts,
    hint: "Preview fallback only; CORPUS_LIVE_R2_OK still requires production R2",
  });
});

adminRoutes.get("/corpus/d1-status", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const access = await loadAdminAccess(db, c.get("userId"));
  if (!access.platformAdmin) return c.json({ error: "forbidden" }, 403);
  const tids = ["cuvs", "nasb", "web", "kjv", "asv"];
  const counts: Record<string, number> = {};
  for (const tid of tids) {
    counts[tid] = await countD1CorpusChapters(db, tid);
  }
  return c.json({
    source: "d1" as const,
    counts,
    mediaBound: Boolean(c.env.MEDIA),
  });
});

/**
 * Seed one PD book (getbible → R2). Call bookNr 1..66 in a loop for full canon.
 * platform_admin only; never licensed zh/ja.
 */
adminRoutes.post("/corpus/pd-seed", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const access = await loadAdminAccess(db, c.get("userId"));
  if (!access.platformAdmin) return c.json({ error: "forbidden" }, 403);

  const body = z
    .object({
      tid: z.enum(["web", "kjv", "asv"]),
      bookNr: z.number().int().min(1).max(66),
    })
    .parse(await c.req.json());

  const media = requireMedia(c);
  if (media instanceof Response) return media;

  try {
    const result = await seedPdBookToR2(media, body.tid, body.bookNr);
    const nextBookNr = body.bookNr < 66 ? body.bookNr + 1 : null;
    return c.json({
      ok: true,
      tid: body.tid,
      bookNr: body.bookNr,
      book: result.book,
      chaptersPut: result.chaptersPut,
      nextBookNr,
      done: nextBookNr === null,
      source: "getbible" as const,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "seed_failed";
    return c.json({ error: "pd_seed_failed", detail: message }, 502);
  }
});

/** List allowed PD seed tids + book map (platform_admin). */
adminRoutes.get("/corpus/pd-seed", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const access = await loadAdminAccess(db, c.get("userId"));
  if (!access.platformAdmin) return c.json({ error: "forbidden" }, 403);

  const books = [];
  for (let nr = 1; nr <= 66; nr += 1) {
    const osis = osisForBookNr(nr);
    if (osis) books.push({ bookNr: nr, book: osis });
  }
  return c.json({
    allowedTids: [...PD_SEED_TRANSLATION_IDS],
    books,
    hint: "POST /v1/admin/corpus/pd-seed { tid, bookNr } once per book; loop 1..66 for full Protestant canon. Text stays on R2 — never TypeScript packs.",
  });
});
