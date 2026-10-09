/**
 * Import Bible chapters from JSON fixtures / download packs into LocalCorpusDb.
 * This is the product path for corpora — not TypeScript densify packs.
 *
 * On disk layout (repo fixtures or publisher drop):
 *   fixtures/corpus/{translationId}/{Book}.{chapter}.json
 *
 * Each file is R2ChapterJson. A translation directory becomes one installable pack.
 */

import {
  buildR2ChapterJson,
  parseR2ChapterJson,
  r2ChapterObjectKey,
  type R2ChapterJson,
} from "./r2-format.js";
import {
  LocalCorpusDb,
  MemoryLocalCorpusStore,
  type DownloadPackPayload,
  type LocalCorpusStore,
} from "./local-corpus-db.js";

export type CorpusFixtureChapterFile = {
  translationId: string;
  fileName: string;
  chapter: R2ChapterJson;
  r2Key: string;
};

export type CorpusFixtureInventory = {
  translationId: string;
  chapters: CorpusFixtureChapterFile[];
};

/** Parse a single chapter JSON string (fixture or R2 object body). */
export function parseCorpusFixtureChapter(raw: string): R2ChapterJson {
  return parseR2ChapterJson(raw);
}

/** Build inventory entries from in-memory chapter map (tests / Node seed). */
export function inventoryFromChapterMap(
  translationId: string,
  chapters: R2ChapterJson[],
): CorpusFixtureInventory {
  const files: CorpusFixtureChapterFile[] = chapters.map((ch) => ({
    translationId,
    fileName: `${ch.book}.${ch.chapter}.json`,
    chapter: ch,
    r2Key: r2ChapterObjectKey(translationId, ch.book, ch.chapter),
  }));
  files.sort((a, b) => a.fileName.localeCompare(b.fileName));
  return { translationId, chapters: files };
}

export function fixtureInventoryToDownloadPack(
  inventory: CorpusFixtureInventory,
): DownloadPackPayload {
  return {
    translationId: inventory.translationId,
    version: 1,
    chapters: inventory.chapters.map((c) => c.chapter),
  };
}

/** Install fixture inventory into a local corpus DB. */
export async function importFixturesIntoLocalDb(
  inventory: CorpusFixtureInventory,
  store: LocalCorpusStore = new MemoryLocalCorpusStore(),
): Promise<{ translationId: string; installed: number; r2Keys: string[] }> {
  const db = new LocalCorpusDb(store);
  const pack = fixtureInventoryToDownloadPack(inventory);
  const result = await db.installPack(inventory.translationId, pack.chapters);
  return {
    translationId: result.translationId,
    installed: result.installed,
    r2Keys: inventory.chapters.map((c) => c.r2Key),
  };
}

export type CorpusJsonImportProbe = {
  ok: boolean;
  translationIds: string[];
  totalChapters: number;
  sampleKeys: string[];
  roundtripOk: boolean;
};

/**
 * Prove JSON→local-DB import without loading TS densify packs.
 * Callers supply already-parsed fixture chapters (from disk in scripts).
 */
export async function probeCorpusJsonImport(
  byTid: Record<string, R2ChapterJson[]>,
): Promise<CorpusJsonImportProbe> {
  const store = new MemoryLocalCorpusStore();
  const db = new LocalCorpusDb(store);
  const translationIds = Object.keys(byTid).sort();
  let totalChapters = 0;
  const sampleKeys: string[] = [];

  for (const tid of translationIds) {
    const chapters = byTid[tid] ?? [];
    const inv = inventoryFromChapterMap(tid, chapters);
    await importFixturesIntoLocalDb(inv, store);
    totalChapters += chapters.length;
    if (inv.chapters[0]) sampleKeys.push(inv.chapters[0].r2Key);
  }

  const cuvs = await db.getChapter("cuvs", "John", 1);
  const web = await db.getChapter("web", "John", 1);
  const roundtripRaw = cuvs
    ? buildR2ChapterJson({ book: cuvs.book, chapter: cuvs.chapter, verses: cuvs.verses })
    : "";
  const roundtripOk = Boolean(cuvs && parseCorpusFixtureChapter(roundtripRaw).verses.length >= 1);

  // cuvs stays sample fixtures; web may be denser public-domain full-chapter text.
  const webOk =
    Boolean(web?.verses[0]?.text) &&
    ((web?.verses[0]?.text.includes("fixture") ?? false) || (web?.verses.length ?? 0) >= 40);

  const ok =
    translationIds.includes("cuvs") &&
    translationIds.includes("web") &&
    totalChapters >= 6 &&
    (cuvs?.verses[0]?.text.includes("fixture") ?? false) &&
    webOk &&
    roundtripOk;

  return {
    ok,
    translationIds,
    totalChapters,
    sampleKeys: sampleKeys.slice(0, 6),
    roundtripOk,
  };
}
