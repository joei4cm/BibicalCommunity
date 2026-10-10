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
  panshiAudioUpstreamUrl,
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
import {
  getD1CorpusChapter,
  listD1CorpusChaptersPage,
} from "../services/corpus-d1";
import {
  ensurePdChapterInR2,
  isPdSeedTranslationId,
  seedPdBookToR2,
} from "../services/pd-corpus-seed";
import { sha256Hex } from "../services/crypto";

export const bibleRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();

bibleRoutes.get("/translations", (c) => {
  const language = c.req.query("language") as "zh" | "en" | "ja" | undefined;
  const availableOnly = c.req.query("availableOnly") === "1";
  const offlineCapableOnly = c.req.query("offlineCapableOnly") === "1";
  return c.json({
    translations: listTranslations({ language, availableOnly, offlineCapableOnly }),
    partners: {
      endaoSso: c.env.ENDAO_SSO_ENABLED === "true",
      wereadSso: c.env.WEREAD_SSO_ENABLED === "true",
    },
  });
});

/**
 * HTTPS proxy for 磐石有声圣经 chapter MP3 (upstream is HTTP-only).
 * GET /v1/bible/audio/panshi?book=John&chapter=1
 */
bibleRoutes.get("/audio/panshi", async (c) => {
  const book = String(c.req.query("book") ?? "").trim();
  const chapter = Number(c.req.query("chapter") ?? "0");
  const upstream = panshiAudioUpstreamUrl(book, chapter);
  if (!upstream) return c.json({ error: "invalid_ref" }, 400);
  try {
    const res = await fetch(upstream, {
      headers: { Accept: "audio/mpeg,*/*" },
    });
    if (!res.ok) return c.json({ error: "audio_upstream_failed", status: res.status }, 502);
    const headers = new Headers();
    headers.set("Content-Type", res.headers.get("Content-Type") ?? "audio/mpeg");
    headers.set("Cache-Control", "public, max-age=86400");
    headers.set("Access-Control-Allow-Origin", "*");
    const len = res.headers.get("Content-Length");
    if (len) headers.set("Content-Length", len);
    return new Response(res.body, { status: 200, headers });
  } catch {
    return c.json({ error: "audio_fetch_failed" }, 502);
  }
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

/** Corpus-pack catalog: R2 download/boot packs (no TypeScript verse modules). */
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
      downloadableCount: probe.downloadableCount,
      bootCount: probe.bootCount,
      noTsPacks: probe.noTsPacks,
      languages: probe.languages,
    },
  });
});

/**
 * Download-oriented corpus catalog.
 * Boot ships 和合本 (cuvs) + NASB as whole-Bible packs; rest are whole-Bible
 * download or external. Full verse text is NOT bundled in TypeScript —
 * clients install packs into a local DB (never per-chapter product UX).
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
 *
 * Product install unit is always the **whole Bible** (not per-chapter).
 * Query `scope=boot|full` both return the full translation pack under the
 * R2 prefix (transport may page with `limit`/`after` for large packs).
 *
 * Query `limit` / `after`: page chapter bodies for large packs.
 * - `limit` — max chapters in this page (1–200; omit/`0` = all, legacy)
 * - `after` — resume after this R2 object key from the previous page
 *
 * Not a TypeScript densify path.
 */
bibleRoutes.get("/corpus-download/:translationId", async (c) => {
  const translationId = c.req.param("translationId");
  const scopeRaw = (c.req.query("scope") ?? "full").toLowerCase();
  const scope = scopeRaw === "boot" ? "boot" : "full";
  const after = c.req.query("after") ?? "";
  const limitRaw = Number(c.req.query("limit") ?? "0");
  const pageLimit =
    Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(200, Math.floor(limitRaw)) : 0;
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
  const prefix = r2CorpusPrefix(translationId);
  let nextAfter: string | null = null;
  let done = true;
  let totalKeys = 0;

  // Product install unit is whole-Bible. `scope=boot` still returns the full
  // translation pack for boot tids (和合本/NASB) — never a teaching-set subset.
  // Temporary preview Workers omit MEDIA — fall through to demo pack.
  const media = c.env.MEDIA;
  if (media && (scope === "boot" || scope === "full")) {
    // Collect sorted chapter object keys under the prefix.
    const keys: string[] = [];
    let listCursor: string | undefined;
    for (;;) {
      const listed = await media.list({ prefix, limit: 1000, cursor: listCursor });
      for (const obj of listed.objects) {
        const parsedKey = parseR2ChapterObjectKey(obj.key);
        if (!parsedKey || parsedKey.translationId !== translationId) continue;
        keys.push(obj.key);
      }
      if (!listed.truncated) break;
      listCursor = listed.cursor;
    }
    keys.sort((a, b) => a.localeCompare(b));
    totalKeys = keys.length;

    let start = 0;
    if (after) {
      const idx = keys.findIndex((k) => k > after);
      start = idx === -1 ? keys.length : idx;
    }
    const pageKeys = pageLimit > 0 ? keys.slice(start, start + pageLimit) : keys.slice(start);
    done = start + pageKeys.length >= keys.length;
    nextAfter = pageKeys.length ? pageKeys[pageKeys.length - 1]! : null;

    for (const key of pageKeys) {
      const body = await media.get(key);
      if (!body) continue;
      try {
        fromR2.push(parseR2ChapterJson(await body.text()));
      } catch {
        /* skip invalid */
      }
    }

    // Fallback: known catalog sample refs (when list empty)
    if (fromR2.length === 0 && totalKeys === 0 && !after) {
      const catalogEntry = listDownloadableCorpusCatalog().find(
        (p) => p.translationId === translationId,
      );
      const refs = catalogEntry?.chapterRefs?.length
        ? catalogEntry.chapterRefs.slice(0, 32)
        : ["John.1", "John.3", "Ps.23"];
      for (const ref of refs) {
        const parsed = parseRef(ref);
        if (!parsed) continue;
        const key = r2ChapterObjectKey(translationId, parsed.book, parsed.chapter);
        const obj = await media.get(key);
        if (!obj) continue;
        try {
          fromR2.push(parseR2ChapterJson(await obj.text()));
        } catch {
          /* skip invalid */
        }
      }
      done = true;
      nextAfter = null;
    }
  }

  fromR2.sort((a, b) =>
    `${a.book}.${a.chapter}`.localeCompare(`${b.book}.${b.chapter}`, undefined, {
      numeric: true,
    }),
  );

  if (fromR2.length > 0 || totalKeys > 0) {
    return c.json({
      translationId,
      version: 1,
      chapters: fromR2,
      source: "r2" as const,
      scope,
      packKind: "whole-bible" as const,
      r2Prefix: prefix,
      chapterCount: fromR2.length,
      totalChapterKeys: totalKeys || fromR2.length,
      done,
      nextAfter: done ? null : nextAfter,
    });
  }

  // When R2 MEDIA is missing or empty for this tid, serve D1-seeded chapters.
  {
    const db = drizzle(c.env.DB, { schema });
    const page = await listD1CorpusChaptersPage(db, translationId, {
      afterKey: after || undefined,
      limit: pageLimit || undefined,
    });
    if (page.totalKeys > 0 || page.chapters.length > 0) {
      return c.json({
        translationId,
        version: 1,
        chapters: page.chapters,
        source: "d1" as const,
        scope,
        packKind: "whole-bible" as const,
        chapterCount: page.chapters.length,
        totalChapterKeys: page.totalKeys,
        done: page.done,
        nextAfter: page.nextAfter,
        hint: "D1 corpus fallback (preview / empty R2 prefix); CORPUS_LIVE_R2 still needs production R2",
      });
    }
  }

  const demo = buildDemoDownloadPack(translationId);
  return c.json({
    ...parseDownloadPackPayload(buildDownloadPackPayloadJson(demo)),
    source: "demo" as const,
    scope,
    chapterCount: demo.chapters.length,
    totalChapterKeys: demo.chapters.length,
    done: true,
    nextAfter: null,
    bootTeachingOnly: scope === "boot",
  });
});

/**
 * Authenticated warm of one PD book into R2 (getbible → MEDIA).
 * Clients call bookNr 1..66 after login so 和合本/WEB/KJV/ASV become full text
 * without requiring platform_admin for the initial public-domain fill.
 */
bibleRoutes.post("/corpus-warm/:translationId", requireAuth, async (c) => {
  const translationId = c.req.param("translationId");
  if (!isPdSeedTranslationId(translationId)) {
    return c.json(
      { error: "not_pd_seedable", hint: "Only public-domain tids can be warmed this way" },
      400,
    );
  }
  const bookNr = Number(c.req.query("bookNr") ?? "0");
  if (!Number.isFinite(bookNr) || bookNr < 1 || bookNr > 66) {
    return c.json({ error: "invalid_book_nr" }, 400);
  }
  const media = c.env.MEDIA;
  if (!media) return c.json({ error: "media_unbound" }, 503);
  try {
    const result = await seedPdBookToR2(media, translationId, bookNr);
    return c.json({
      ok: true,
      translationId,
      bookNr,
      book: result.book,
      chaptersPut: result.chaptersPut,
      source: result.source,
      nextBookNr: bookNr < 66 ? bookNr + 1 : null,
      done: bookNr >= 66,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "warm_failed";
    return c.json({ error: "corpus_warm_failed", detail }, 502);
  }
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
    const bootDefault = (BOOT_DEFAULT_TRANSLATION_IDS as readonly string[]).includes(
      translationId,
    );
    const access = decideLicensedChapterAccess({
      license: meta.license,
      environment: c.env.ENVIRONMENT,
      userId,
      entitled,
      bootDefault,
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
    if (c.env.MEDIA) {
      const media = c.env.MEDIA;
      const obj = await media.get(key);
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
    }

    // Preview / empty R2: D1, then lazy PD getbible→R2 fill, then demo pack.
    {
      const db = drizzle(c.env.DB, { schema });
      const d1ch = await getD1CorpusChapter(db, translationId, ref.book, ref.chapter);
      if (d1ch) {
        return c.json({
          translationId,
          book: d1ch.book,
          chapter: d1ch.chapter,
          verses: d1ch.verses,
          source: "d1" as const,
        });
      }
    }

    if (c.env.MEDIA && isPdSeedTranslationId(translationId)) {
      try {
        const filled = await ensurePdChapterInR2(
          c.env.MEDIA,
          translationId,
          ref.book,
          ref.chapter,
        );
        if (filled) {
          return c.json({
            translationId,
            book: filled.book,
            chapter: filled.chapter,
            verses: filled.verses,
            source: "r2" as const,
            filledFrom: "getbible" as const,
          });
        }
      } catch {
        /* fall through to demo */
      }
    }

    const demoCh = buildDemoDownloadPack(translationId).chapters.find(
      (ch) => ch.book === ref.book && ch.chapter === ref.chapter,
    );
    if (demoCh) {
      return c.json({
        translationId,
        book: demoCh.book,
        chapter: demoCh.chapter,
        verses: demoCh.verses,
        source: "demo" as const,
        hint: `R2 key missing (${key}); serving demo/boot pack until corpus is uploaded`,
      });
    }

    return c.json(
      {
        error: "chapter_not_in_r2",
        hint: `Upload JSON to MEDIA key "${key}" (fixtures/corpus + seed-r2-from-json-fixtures.mjs)`,
      },
      404,
    );
  }

  // Non-r2/external already handled above; remaining providers resolve via package.
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
