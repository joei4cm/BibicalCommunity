import { Hono } from "hono";
import { z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import { and, eq, isNull, or, gt } from "drizzle-orm";
import {
  BOOT_DEFAULT_TRANSLATION_IDS,
  buildDemoDownloadPack,
  buildDownloadPackPayloadJson,
  getTranslation,
  listCorpusPacks,
  listDevotionMaterials,
  listDownloadableCorpusCatalog,
  listStudyMaterials,
  listTranslations,
  loadChapter,
  parseDownloadPackPayload,
  parseR2ChapterJson,
  parseR2ChapterObjectKey,
  parseRef,
  probeCorpusPackPipeline,
  probeLocalCorpusPipeline,
  r2ChapterObjectKey,
  r2CorpusPrefix,
} from "@logoshome/bible";
import { createId } from "@logoshome/shared";
import type { Env } from "../env";
import * as schema from "../db/schema";
import { requireAuth, type AuthVars } from "../middleware/auth";
import { decideLicensedChapterAccess } from "../services/bible-entitlement";
import { sha256Hex } from "../services/crypto";

export const bibleRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();

bibleRoutes.get("/translations", (c) => {
  const language = c.req.query("language") as "zh" | "en" | "ja" | undefined;
  const availableOnly = c.req.query("availableOnly") === "1";
  return c.json({
    translations: listTranslations({ language, availableOnly }),
    partners: {
      endaoSso: c.env.ENDAO_SSO_ENABLED === "true",
      wereadSso: c.env.WEREAD_SSO_ENABLED === "true",
    },
  });
});

const studyLangSchema = z.enum(["zh", "en", "ja"]);

bibleRoutes.get("/study", (c) => {
  const languageRaw = c.req.query("language");
  const language = languageRaw ? studyLangSchema.parse(languageRaw) : undefined;
  return c.json({
    materials: listStudyMaterials(language ? { language } : undefined),
    devotion: listDevotionMaterials(),
  });
});

/** Corpus-pack catalog: local scaffolds + licensed R2 stubs. */
bibleRoutes.get("/corpus-packs", (c) => {
  const availableOnly = c.req.query("availableOnly") === "1";
  const provider = c.req.query("provider") as "local" | "r2" | undefined;
  const language = c.req.query("language") as "zh" | "en" | "ja" | undefined;
  const packs = listCorpusPacks({
    availableOnly: availableOnly || undefined,
    provider,
    language,
  });
  const probe = probeCorpusPackPipeline();
  return c.json({
    packs,
    probe: {
      ok: probe.ok,
      localCount: probe.localCount,
      licensedStubCount: probe.licensedStubCount,
      localChapterTotal: probe.localChapterTotal,
      languages: probe.languages,
    },
  });
});

/**
 * Download-oriented corpus catalog.
 * Boot ships only a few tids (和合本 / WEB / 新共同訳); rest are download or external.
 * Full verse text is NOT bundled in TypeScript — clients install packs into a local DB.
 */
bibleRoutes.get("/corpus-catalog", async (c) => {
  const catalog = listDownloadableCorpusCatalog();
  const probe = await probeLocalCorpusPipeline();
  return c.json({
    bootDefaults: [...BOOT_DEFAULT_TRANSLATION_IDS],
    catalog,
    probe: {
      ok: probe.ok,
      bootDefaults: probe.bootDefaults,
      downloadableCount: probe.downloadableCount,
      externalCount: probe.externalCount,
      installedAfterBoot: probe.installedAfterBoot,
      sampleR2Key: probe.sampleR2Key,
    },
  });
});

/**
 * Download a translation pack as JSON for install into the client local DB.
 * Lists all R2 objects under `bible/{tid}/` (full prefix pack), falling back
 * to catalog sample refs, then a small demo pack. Not a TypeScript densify path.
 */
bibleRoutes.get("/corpus-download/:translationId", async (c) => {
  const translationId = c.req.param("translationId");
  const meta = getTranslation(translationId);
  if (!meta) return c.json({ error: "unknown_translation" }, 404);
  if (meta.provider === "external") {
    return c.json(
      {
        error: "external_translation",
        hint: "Open via partner deep-link; cannot download into local DB",
        url: meta.externalUrlTemplate,
      },
      400,
    );
  }

  const fromR2: { book: string; chapter: number; verses: { verse: number; text: string }[] }[] =
    [];
  const seen = new Set<string>();

  // 1) Full prefix listing — every chapter object under bible/{tid}/
  const prefix = r2CorpusPrefix(translationId);
  let cursor: string | undefined;
  for (;;) {
    const listed = await c.env.MEDIA.list({ prefix, limit: 1000, cursor });
    for (const obj of listed.objects) {
      const parsedKey = parseR2ChapterObjectKey(obj.key);
      if (!parsedKey || parsedKey.translationId !== translationId) continue;
      const refKey = `${parsedKey.book}.${parsedKey.chapter}`;
      if (seen.has(refKey)) continue;
      const body = await c.env.MEDIA.get(obj.key);
      if (!body) continue;
      try {
        const chapter = parseR2ChapterJson(await body.text());
        fromR2.push(chapter);
        seen.add(refKey);
      } catch {
        /* skip invalid */
      }
    }
    if (!listed.truncated) break;
    cursor = listed.cursor;
  }

  // 2) Fallback: known catalog sample refs (when list empty / partial)
  if (fromR2.length === 0) {
    const catalogEntry = listDownloadableCorpusCatalog().find(
      (p) => p.translationId === translationId,
    );
    const refs = catalogEntry?.chapterRefs?.length
      ? catalogEntry.chapterRefs
      : ["John.1", "John.3", "Ps.23"];
    for (const ref of refs) {
      const parsed = parseRef(ref);
      if (!parsed) continue;
      const key = r2ChapterObjectKey(translationId, parsed.book, parsed.chapter);
      const obj = await c.env.MEDIA.get(key);
      if (!obj) continue;
      try {
        fromR2.push(parseR2ChapterJson(await obj.text()));
      } catch {
        /* skip invalid */
      }
    }
  }

  fromR2.sort((a, b) =>
    `${a.book}.${a.chapter}`.localeCompare(`${b.book}.${b.chapter}`, undefined, {
      numeric: true,
    }),
  );

  if (fromR2.length > 0) {
    return c.json({
      translationId,
      version: 1,
      chapters: fromR2,
      source: "r2" as const,
      r2Prefix: prefix,
      chapterCount: fromR2.length,
    });
  }

  const demo = buildDemoDownloadPack(translationId);
  return c.json({
    ...parseDownloadPackPayload(buildDownloadPackPayloadJson(demo)),
    source: "demo" as const,
    chapterCount: demo.chapters.length,
  });
});

async function resolveOptionalUserId(c: {
  req: { header: (name: string) => string | undefined };
  env: Env;
}): Promise<string | null> {
  const header = c.req.header("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const tokenHash = await sha256Hex(header.slice(7));
  const db = drizzle(c.env.DB, { schema });
  const session = (
    await db.select().from(schema.sessions).where(eq(schema.sessions.tokenHash, tokenHash)).limit(1)
  )[0];
  if (!session || session.expiresAt < Date.now()) return null;
  return session.userId;
}

async function hasEntitlement(
  env: Env,
  userId: string,
  translationId: string,
): Promise<boolean> {
  const db = drizzle(env.DB, { schema });
  const now = Date.now();
  const row = (
    await db
      .select()
      .from(schema.translationEntitlements)
      .where(
        and(
          eq(schema.translationEntitlements.userId, userId),
          eq(schema.translationEntitlements.translationId, translationId),
          or(
            isNull(schema.translationEntitlements.expiresAt),
            gt(schema.translationEntitlements.expiresAt, now),
          ),
        ),
      )
      .limit(1)
  )[0];
  return Boolean(row);
}

bibleRoutes.get("/chapter", async (c) => {
  const translationId = c.req.query("translation") ?? "web";
  const refRaw = c.req.query("ref") ?? "John.1";
  const ref = parseRef(refRaw);
  if (!ref) return c.json({ error: "invalid_ref" }, 400);

  const meta = getTranslation(translationId);
  if (!meta) return c.json({ error: "unknown_translation" }, 404);

  if (meta.provider === "r2") {
    const userId = await resolveOptionalUserId(c);
    const entitled = userId ? await hasEntitlement(c.env, userId, translationId) : false;
    const access = decideLicensedChapterAccess({
      license: meta.license,
      environment: c.env.ENVIRONMENT,
      userId,
      entitled,
    });
    if (!access.ok) {
      return c.json(
        {
          error: access.error,
          ...(access.error === "entitlement_required"
            ? {
                hint: `Grant entitlement via POST /v1/bible/entitlements with translationId=${translationId}`,
              }
            : {}),
        },
        access.status,
      );
    }

    const key = r2ChapterObjectKey(translationId, ref.book, ref.chapter);
    const obj = await c.env.MEDIA.get(key);
    if (obj) {
      let parsed;
      try {
        parsed = parseR2ChapterJson(await obj.text());
      } catch {
        return c.json({ error: "invalid_r2_chapter_json", key }, 500);
      }

      return c.json({
        translationId,
        book: parsed.book,
        chapter: parsed.chapter,
        verses: parsed.verses,
        source: "r2" as const,
      });
    }

    // Dev / scaffold fallback: local John packs (cuvs/cuvt/kougo/…) when R2 empty.
    const local = await loadChapter(translationId, ref, {
      endao: c.env.ENDAO_SSO_ENABLED === "true",
      weread: c.env.WEREAD_SSO_ENABLED === "true",
    });
    if ("external" in local) return c.json(local);
    if (local.verses.length > 0 && !local.verses[0]?.text.startsWith(`[${meta.abbreviation}] Sample`)) {
      return c.json(local);
    }

    return c.json(
      {
        error: "chapter_not_in_r2",
        hint: `Upload JSON to MEDIA key "${key}" (see scripts/seed-r2-sample.md)`,
      },
      404,
    );
  }

  const result = await loadChapter(translationId, ref, {
    endao: c.env.ENDAO_SSO_ENABLED === "true",
    weread: c.env.WEREAD_SSO_ENABLED === "true",
  });
  return c.json(result);
});

const entitlementBody = z.object({
  translationId: z.string().min(1),
});

bibleRoutes.post("/entitlements", requireAuth, async (c) => {
  const body = entitlementBody.parse(await c.req.json());
  const meta = getTranslation(body.translationId);
  if (!meta) return c.json({ error: "unknown_translation" }, 404);

  const db = drizzle(c.env.DB, { schema });
  const userId = c.get("userId");
  const existing = (
    await db
      .select()
      .from(schema.translationEntitlements)
      .where(
        and(
          eq(schema.translationEntitlements.userId, userId),
          eq(schema.translationEntitlements.translationId, body.translationId),
        ),
      )
      .limit(1)
  )[0];

  if (existing) {
    return c.json({
      id: existing.id,
      translationId: existing.translationId,
      grantedAt: existing.grantedAt,
      expiresAt: existing.expiresAt,
      alreadyGranted: true,
    });
  }

  const id = createId("ent");
  const grantedAt = Date.now();
  await db.insert(schema.translationEntitlements).values({
    id,
    userId,
    translationId: body.translationId,
    grantedAt,
    expiresAt: null,
  });

  return c.json(
    {
      id,
      translationId: body.translationId,
      grantedAt,
      expiresAt: null,
    },
    201,
  );
});

bibleRoutes.get("/entitlements", requireAuth, async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const rows = await db
    .select()
    .from(schema.translationEntitlements)
    .where(eq(schema.translationEntitlements.userId, c.get("userId")));
  return c.json({
    entitlements: rows.map((r) => ({
      id: r.id,
      translationId: r.translationId,
      grantedAt: r.grantedAt,
      expiresAt: r.expiresAt,
    })),
  });
});
