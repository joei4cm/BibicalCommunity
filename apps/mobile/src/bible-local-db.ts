/**
 * Mobile local Bible corpus DB (AsyncStorage).
 * Same download→install model as web IndexedDB `lh-bible` — not TS densify.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  BOOT_DEFAULT_TRANSLATION_IDS,
  LocalCorpusDb,
  buildDemoDownloadPack,
  type LocalChapterRecord,
  type LocalCorpusStore,
  type R2ChapterJson,
} from "@logoshome/bible";

const INDEX_KEY = "lh.bible.index.v1";
/** Bump when boot set changes (cuvs+nasb whole-Bible / denser demo chapters). */
const BOOT_FLAG = "lh.bible.bootSeeded.v4";
const CHAPTER_PREFIX = "lh.bible.ch:";

function chapterStorageKey(translationId: string, book: string, chapter: number): string {
  return `${CHAPTER_PREFIX}${translationId}/${book}.${chapter}`;
}

class AsyncStorageCorpusStore implements LocalCorpusStore {
  async getChapter(
    translationId: string,
    book: string,
    chapter: number,
  ): Promise<LocalChapterRecord | null> {
    const raw = await AsyncStorage.getItem(chapterStorageKey(translationId, book, chapter));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as LocalChapterRecord;
    } catch {
      return null;
    }
  }

  async putChapter(record: LocalChapterRecord): Promise<void> {
    const key = chapterStorageKey(record.translationId, record.book, record.chapter);
    await AsyncStorage.setItem(key, JSON.stringify(record));
    const indexRaw = await AsyncStorage.getItem(INDEX_KEY);
    const index: string[] = indexRaw ? (JSON.parse(indexRaw) as string[]) : [];
    if (!index.includes(key)) {
      index.push(key);
      await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(index));
    }
  }

  async deleteTranslation(translationId: string): Promise<void> {
    const indexRaw = await AsyncStorage.getItem(INDEX_KEY);
    const index: string[] = indexRaw ? (JSON.parse(indexRaw) as string[]) : [];
    const prefix = `${CHAPTER_PREFIX}${translationId}/`;
    const keep: string[] = [];
    const remove: string[] = [];
    for (const key of index) {
      if (key.startsWith(prefix)) remove.push(key);
      else keep.push(key);
    }
    await Promise.all(remove.map((k) => AsyncStorage.removeItem(k)));
    await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(keep));
  }

  async listChapterKeys(translationId?: string) {
    const indexRaw = await AsyncStorage.getItem(INDEX_KEY);
    const index: string[] = indexRaw ? (JSON.parse(indexRaw) as string[]) : [];
    const out: Array<{
      translationId: string;
      book: string;
      chapter: number;
      installedAt: string;
    }> = [];
    for (const key of index) {
      const raw = await AsyncStorage.getItem(key);
      if (!raw) continue;
      try {
        const rec = JSON.parse(raw) as LocalChapterRecord;
        if (translationId && rec.translationId !== translationId) continue;
        out.push({
          translationId: rec.translationId,
          book: rec.book,
          chapter: rec.chapter,
          installedAt: rec.installedAt,
        });
      } catch {
        /* skip */
      }
    }
    return out;
  }

  async clear(): Promise<void> {
    const indexRaw = await AsyncStorage.getItem(INDEX_KEY);
    const index: string[] = indexRaw ? (JSON.parse(indexRaw) as string[]) : [];
    await Promise.all(index.map((k) => AsyncStorage.removeItem(k)));
    await AsyncStorage.removeItem(INDEX_KEY);
  }
}

const store = new AsyncStorageCorpusStore();
export const bibleLocalDb = new LocalCorpusDb(store);

export type BootSeedFetch = (translationId: string) => Promise<{
  chapters: R2ChapterJson[];
  source?: string;
} | null>;

export async function ensureBootCorpusSeeded(
  fetchPack?: BootSeedFetch,
): Promise<{ seeded: boolean; tids: string[]; sources: Record<string, string> }> {
  const sources: Record<string, string> = {};
  const flag = await AsyncStorage.getItem(BOOT_FLAG);
  if (flag === "1") {
    return { seeded: false, tids: [...BOOT_DEFAULT_TRANSLATION_IDS], sources };
  }
  for (const tid of BOOT_DEFAULT_TRANSLATION_IDS) {
    let chapters: R2ChapterJson[] | null = null;
    let source = "demo";
    if (fetchPack) {
      try {
        const pack = await fetchPack(tid);
        if (pack?.chapters?.length) {
          chapters = pack.chapters;
          source = pack.source ?? "download";
        }
      } catch {
        /* demo fallback */
      }
    }
    if (!chapters) {
      chapters = buildDemoDownloadPack(tid).chapters;
      source = "demo";
    }
    await bibleLocalDb.installPack(tid, chapters);
    sources[tid] = source;
  }
  await AsyncStorage.setItem(BOOT_FLAG, "1");
  return { seeded: true, tids: [...BOOT_DEFAULT_TRANSLATION_IDS], sources };
}

export async function installDownloadedPack(
  translationId: string,
  chapters: R2ChapterJson[],
): Promise<{ installed: number }> {
  return bibleLocalDb.installPack(translationId, chapters);
}

export async function readLocalChapter(
  translationId: string,
  book: string,
  chapter: number,
): Promise<LocalChapterRecord | null> {
  return bibleLocalDb.getChapter(translationId, book, chapter);
}

/** Clear downloaded/boot corpus from AsyncStorage (remote / Me wipe). */
export async function clearBibleLocalDb(): Promise<void> {
  await bibleLocalDb.clear();
  await AsyncStorage.removeItem(BOOT_FLAG);
  await AsyncStorage.removeItem(INDEX_KEY);
}
