import { Hono } from "hono";
import { z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import { and, eq, isNull, or, gt } from "drizzle-orm";
import {
  getTranslation,
  listCorpusPacks,
  listDevotionMaterials,
  listStudyMaterials,
  listTranslations,
  loadChapter,
  parseR2ChapterJson,
  parseRef,
  probeCorpusPackPipeline,
  r2ChapterObjectKey,
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
