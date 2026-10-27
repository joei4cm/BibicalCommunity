/**
 * D1 corpus fallback when R2 MEDIA is unbound (temporary preview Workers).
 * Does not replace CORPUS_LIVE_R2 — production corpora stay on R2.
 */
import { and, asc, eq, gt, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import {
  buildDemoDownloadPack,
  parseR2ChapterJson,
  r2ChapterObjectKey,
} from "@logoshome/bible";
import * as schema from "../db/schema";

type Db = DrizzleD1Database<typeof schema>;

export type D1Chapter = {
  book: string;
  chapter: number;
  verses: { verse: number; text: string }[];
};

export async function countD1CorpusChapters(
  db: Db,
  translationId: string,
): Promise<number> {
  const row = await db
    .select({ n: sql<number>`count(*)` })
    .from(schema.corpusChapters)
    .where(eq(schema.corpusChapters.translationId, translationId));
  return Number(row[0]?.n ?? 0);
}

export async function listD1CorpusChapterKeys(
  db: Db,
  translationId: string,
): Promise<string[]> {
  const rows = await db
    .select({
      book: schema.corpusChapters.book,
      chapter: schema.corpusChapters.chapter,
    })
    .from(schema.corpusChapters)
    .where(eq(schema.corpusChapters.translationId, translationId))
    .orderBy(asc(schema.corpusChapters.book), asc(schema.corpusChapters.chapter));
  return rows.map((r) => r2ChapterObjectKey(translationId, r.book, r.chapter));
}

export async function getD1CorpusChapter(
  db: Db,
  translationId: string,
  book: string,
  chapter: number,
): Promise<D1Chapter | null> {
  const row = (
    await db
      .select()
      .from(schema.corpusChapters)
      .where(
        and(
          eq(schema.corpusChapters.translationId, translationId),
          eq(schema.corpusChapters.book, book),
          eq(schema.corpusChapters.chapter, chapter),
        ),
      )
      .limit(1)
  )[0];
  if (!row) return null;
  try {
    return parseR2ChapterJson(row.bodyJson);
  } catch {
    return null;
  }
}

export async function listD1CorpusChaptersPage(
  db: Db,
  translationId: string,
  opts: { afterKey?: string; limit?: number },
): Promise<{
  chapters: D1Chapter[];
  keys: string[];
  totalKeys: number;
  done: boolean;
  nextAfter: string | null;
}> {
  // One SELECT for the whole translation (preview Workers only; ~1k rows).
  // Avoids N+1 getD1CorpusChapter round-trips per page.
  const rows = await db
    .select({
      book: schema.corpusChapters.book,
      chapter: schema.corpusChapters.chapter,
      bodyJson: schema.corpusChapters.bodyJson,
    })
    .from(schema.corpusChapters)
    .where(eq(schema.corpusChapters.translationId, translationId))
    .orderBy(asc(schema.corpusChapters.book), asc(schema.corpusChapters.chapter));

  const keyed = rows.map((r) => ({
    key: r2ChapterObjectKey(translationId, r.book, r.chapter),
    row: r,
  }));
  let start = 0;
  if (opts.afterKey) {
    const idx = keyed.findIndex((k) => k.key > opts.afterKey!);
    start = idx === -1 ? keyed.length : idx;
  }
  const limit = opts.limit && opts.limit > 0 ? opts.limit : keyed.length;
  const page = keyed.slice(start, start + limit);
  const chapters: D1Chapter[] = [];
  const pageKeys: string[] = [];
  for (const item of page) {
    pageKeys.push(item.key);
    try {
      chapters.push(parseR2ChapterJson(item.row.bodyJson));
    } catch {
      /* skip invalid */
    }
  }
  const done = start + page.length >= keyed.length;
  return {
    chapters,
    keys: pageKeys,
    totalKeys: keyed.length,
    done,
    nextAfter: done || !pageKeys.length ? null : pageKeys[pageKeys.length - 1]!,
  };
}

/** Upsert demo/boot pack chapters into D1 (preview seed). */
export async function seedD1DemoCorpus(
  db: Db,
  translationId: string,
): Promise<{ inserted: number; translationId: string }> {
  const demo = buildDemoDownloadPack(translationId);
  const now = Date.now();
  let inserted = 0;
  for (const ch of demo.chapters) {
    const bodyJson = JSON.stringify({
      book: ch.book,
      chapter: ch.chapter,
      verses: ch.verses,
    });
    await db
      .insert(schema.corpusChapters)
      .values({
        translationId,
        book: ch.book,
        chapter: ch.chapter,
        bodyJson,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          schema.corpusChapters.translationId,
          schema.corpusChapters.book,
          schema.corpusChapters.chapter,
        ],
        set: { bodyJson, updatedAt: now },
      });
    inserted += 1;
  }
  return { inserted, translationId };
}

/** Seed boot tids (cuvs) into D1 for temporary Workers. */
export async function seedD1BootCorpus(db: Db): Promise<{ tids: string[]; total: number }> {
  const tids = ["cuvs"];
  let total = 0;
  for (const tid of tids) {
    const r = await seedD1DemoCorpus(db, tid);
    total += r.inserted;
  }
  return { tids, total };
}

export async function d1CorpusHasAny(db: Db): Promise<boolean> {
  const row = await db
    .select({ n: sql<number>`count(*)` })
    .from(schema.corpusChapters)
    .where(gt(schema.corpusChapters.updatedAt, 0))
    .limit(1);
  return Number(row[0]?.n ?? 0) > 0;
}
