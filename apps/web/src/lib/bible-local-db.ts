/**
 * Client local Bible corpus DB (IndexedDB `lh-bible`).
 * Translations are installed via download pack — not compiled into the bundle.
 */

import {
  LocalCorpusDb,
  type LocalChapterRecord,
  type LocalCorpusStore,
  type R2ChapterJson,
  buildDemoDownloadPack,
  BOOT_DEFAULT_TRANSLATION_IDS,
} from "@logoshome/bible";

const DB_NAME = "lh-bible";
const STORE = "chapters";
const DB_VERSION = 1;
/** Bump when boot quality rules change (reject sticky demo / incomplete chapters). */
const BOOT_FLAG = "lh.bible.bootSeeded.v11";
/** Re-seed even if flag is set when installed chapters look truncated. */
const BOOT_MIN_CHAPTERS = 1000;
/** Only seal boot when every default tid came from R2/D1 (not demo placeholders). */
const BOOT_QUALITY_KEY = "lh.bible.bootQuality.v11";
/** Throttle network refill while quality is still demo (ms). */
const BOOT_RETRY_AT_KEY = "lh.bible.bootRetryAt.v11";
const BOOT_RETRY_MIN_MS = 15 * 60 * 1000;

/** Preview/demo placeholder lines — treat as not installed for network refill. */
export function isPlaceholderVerseText(text: string): boolean {
  const s = text.trim();
  return (
    s.includes("全文尚未载入") ||
    s.includes("full text not loaded") ||
    s.includes("本文は未収録") ||
    s.includes("Preview)") ||
    s.startsWith("（预览）") ||
    s.startsWith("（プレビュー）") ||
    s.startsWith("(Preview)")
  );
}

/**
 * Local chapter is incomplete when it still looks like a demo/scaffold:
 * placeholders, sparse teaching samples with verse gaps, or tiny bracketed demos.
 */
export function isIncompleteLocalChapter(
  row: Pick<LocalChapterRecord, "verses"> | { verses: { verse: number; text: string }[] },
): boolean {
  const verses = row.verses ?? [];
  if (verses.length === 0) return true;
  if (verses.some((v) => isPlaceholderVerseText(v.text ?? ""))) return true;
  const nums = verses.map((v) => v.verse).filter((n) => Number.isFinite(n));
  if (nums.length === 0) return true;
  const maxV = Math.max(...nums);
  // Demo teaching samples often keep only a few verses with gaps (e.g. 1 + 14).
  if (verses.length <= 20 && maxV > verses.length + 2) return true;
  // Bracketed demo lines like `[NASB] In the beginning...`
  if (verses.length <= 3 && verses.some((v) => /^\[[^\]]+\]/.test((v.text ?? "").trim()))) {
    return true;
  }
  return false;
}

/** Prefer denser demo prose when a downloaded teaching chapter is still a thin scaffold. */
function enrichSparseChaptersFromDemo(
  translationId: string,
  chapters: R2ChapterJson[],
): R2ChapterJson[] {
  const demoByKey = new Map<string, R2ChapterJson>();
  for (const c of buildDemoDownloadPack(translationId).chapters) {
    demoByKey.set(`${c.book}.${c.chapter}`, c);
  }
  const seen = new Set<string>();
  const merged = chapters.map((ch) => {
    const key = `${ch.book}.${ch.chapter}`;
    seen.add(key);
    const demo = demoByKey.get(key);
    if (demo && demo.verses.length > (ch.verses?.length ?? 0)) {
      return demo;
    }
    return ch;
  });
  for (const [key, demo] of demoByKey) {
    if (!seen.has(key)) merged.push(demo);
  }
  return merged;
}

/** Single-chapter densify for live reader (R2/API scaffolds vs demo teaching prose). */
export function densifyChapterVerses(
  translationId: string,
  book: string,
  chapter: number,
  verses: { verse: number; text: string }[],
): { verse: number; text: string }[] {
  const demo = buildDemoDownloadPack(translationId).chapters.find(
    (c) => c.book === book && c.chapter === chapter,
  );
  if (demo && demo.verses.length > (verses?.length ?? 0)) {
    return demo.verses;
  }
  return verses;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: "id" });
        os.createIndex("translationId", "translationId", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("bible_idb_open_failed"));
  });
}

type IdbChapterRow = LocalChapterRecord & { id: string };

function rowId(translationId: string, book: string, chapter: number): string {
  return `${translationId}/${book}.${chapter}`;
}

class IndexedDbCorpusStore implements LocalCorpusStore {
  async getChapter(
    translationId: string,
    book: string,
    chapter: number,
  ): Promise<LocalChapterRecord | null> {
    if (typeof indexedDB === "undefined") return null;
    const db = await openDb();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).get(rowId(translationId, book, chapter));
        req.onsuccess = () => {
          const row = req.result as IdbChapterRow | undefined;
          if (!row) {
            resolve(null);
            return;
          }
          const { id: _id, ...rest } = row;
          resolve(rest);
        };
        req.onerror = () => reject(req.error ?? new Error("bible_idb_get_failed"));
      });
    } finally {
      db.close();
    }
  }

  async putChapter(record: LocalChapterRecord): Promise<void> {
    if (typeof indexedDB === "undefined") return;
    const db = await openDb();
    try {
      const row: IdbChapterRow = {
        id: rowId(record.translationId, record.book, record.chapter),
        ...record,
      };
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(row);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error("bible_idb_put_failed"));
      });
    } finally {
      db.close();
    }
  }

  async deleteTranslation(translationId: string): Promise<void> {
    if (typeof indexedDB === "undefined") return;
    const db = await openDb();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        const index = tx.objectStore(STORE).index("translationId");
        const req = index.openCursor(IDBKeyRange.only(translationId));
        req.onsuccess = () => {
          const cursor = req.result;
          if (!cursor) return;
          cursor.delete();
          cursor.continue();
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error("bible_idb_del_failed"));
      });
    } finally {
      db.close();
    }
  }

  async listChapterKeys(translationId?: string) {
    if (typeof indexedDB === "undefined") return [];
    const db = await openDb();
    try {
      return await new Promise<
        Array<{ translationId: string; book: string; chapter: number; installedAt: string }>
      >((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).getAll();
        req.onsuccess = () => {
          const rows = (req.result as IdbChapterRow[]) ?? [];
          resolve(
            rows
              .filter((r) => !translationId || r.translationId === translationId)
              .map((r) => ({
                translationId: r.translationId,
                book: r.book,
                chapter: r.chapter,
                installedAt: r.installedAt,
              })),
          );
        };
        req.onerror = () => reject(req.error ?? new Error("bible_idb_list_failed"));
      });
    } finally {
      db.close();
    }
  }

  async clear(): Promise<void> {
    if (typeof indexedDB === "undefined") return;
    const db = await openDb();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error("bible_idb_clear_failed"));
      });
    } finally {
      db.close();
    }
  }
}

const store = new IndexedDbCorpusStore();
export const bibleLocalDb = new LocalCorpusDb(store);

export type BootSeedFetch = (translationId: string) => Promise<{
  chapters: R2ChapterJson[];
  source?: string;
} | null>;

function bootQualityOk(sources: Record<string, string>): boolean {
  return BOOT_DEFAULT_TRANSLATION_IDS.every((tid) => {
    const src = sources[tid];
    return src === "r2" || src === "d1" || src === "download";
  });
}

/**
 * First launch: seed only boot-default translations into IndexedDB.
 * Prefer `/v1/bible/corpus-download/:tid` (R2/fixture JSON) over inline demo packs.
 * Demo packs are installed for offline navigation but do NOT seal the boot flag,
 * so the next visit can still pull real R2/D1 corpora.
 */
export async function ensureBootCorpusSeeded(
  fetchPack?: BootSeedFetch,
): Promise<{ seeded: boolean; tids: string[]; sources: Record<string, string> }> {
  const sources: Record<string, string> = {};
  if (typeof indexedDB === "undefined") {
    return { seeded: false, tids: [], sources };
  }

  const flagSet = localStorage.getItem(BOOT_FLAG) === "1";
  const qualityOk = localStorage.getItem(BOOT_QUALITY_KEY) === "1";

  if (flagSet && qualityOk) {
    try {
      const installed = await bibleLocalDb.listInstalled();
      const incomplete = BOOT_DEFAULT_TRANSLATION_IDS.some((tid) => {
        const row = installed.find((r) => r.translationId === tid);
        return !row || row.chapterCount < BOOT_MIN_CHAPTERS;
      });
      if (!incomplete) {
        return { seeded: false, tids: [...BOOT_DEFAULT_TRANSLATION_IDS], sources };
      }
    } catch {
      /* fall through and re-seed */
    }
  }

  // Flag set but quality not sealed (demo leftover): try network refill only —
  // never wipe a prior install with another demo pack on every reload.
  if (flagSet && !qualityOk && fetchPack) {
    const lastRetry = Number(localStorage.getItem(BOOT_RETRY_AT_KEY) || "0");
    if (Number.isFinite(lastRetry) && Date.now() - lastRetry < BOOT_RETRY_MIN_MS) {
      return { seeded: false, tids: [...BOOT_DEFAULT_TRANSLATION_IDS], sources };
    }
    localStorage.setItem(BOOT_RETRY_AT_KEY, String(Date.now()));
    await Promise.all(
      BOOT_DEFAULT_TRANSLATION_IDS.map(async (tid) => {
        try {
          const pack = await fetchPack(tid);
          if (!pack?.chapters?.length) return;
          const source = pack.source ?? "download";
          if (source === "demo") {
            sources[tid] = "demo";
            return;
          }
          const chapters = enrichSparseChaptersFromDemo(tid, pack.chapters);
          await bibleLocalDb.installPack(tid, chapters);
          sources[tid] = source;
        } catch {
          sources[tid] = "demo";
        }
      }),
    );
    if (bootQualityOk(sources)) {
      localStorage.setItem(BOOT_QUALITY_KEY, "1");
      localStorage.removeItem(BOOT_RETRY_AT_KEY);
    }
    return {
      seeded: Object.values(sources).some((s) => s !== "demo"),
      tids: [...BOOT_DEFAULT_TRANSLATION_IDS],
      sources,
    };
  }

  // Parallel pack fetch for boot defaults (paged fetch lives in the caller).
  await Promise.all(
    BOOT_DEFAULT_TRANSLATION_IDS.map(async (tid) => {
      let chapters: R2ChapterJson[] | null = null;
      let source = "demo";
      if (fetchPack) {
        try {
          const pack = await fetchPack(tid);
          if (pack?.chapters?.length) {
            chapters = enrichSparseChaptersFromDemo(tid, pack.chapters);
            source = pack.source ?? "download";
          }
        } catch {
          /* fall through to demo */
        }
      }
      if (!chapters) {
        chapters = buildDemoDownloadPack(tid).chapters;
        source = "demo";
      } else if (source !== "demo") {
        chapters = enrichSparseChaptersFromDemo(tid, chapters);
      }
      await bibleLocalDb.installPack(tid, chapters);
      sources[tid] = source;
    }),
  );

  // Mark seeded so we do not reinstall demo packs every reload,
  // but only seal quality when real corpora landed.
  localStorage.setItem(BOOT_FLAG, "1");
  if (bootQualityOk(sources)) {
    localStorage.setItem(BOOT_QUALITY_KEY, "1");
  } else {
    localStorage.removeItem(BOOT_QUALITY_KEY);
  }
  return { seeded: true, tids: [...BOOT_DEFAULT_TRANSLATION_IDS], sources };
}

export async function installDownloadedPack(
  translationId: string,
  chapters: R2ChapterJson[],
): Promise<{ installed: number }> {
  return bibleLocalDb.installPack(translationId, chapters);
}

/** Cache a network chapter into IndexedDB when it looks like real corpus text. */
export async function cacheNetworkChapter(
  translationId: string,
  book: string,
  chapter: number,
  verses: { verse: number; text: string }[],
  source?: string,
): Promise<void> {
  if (!verses?.length) return;
  if (source === "demo" || source === "local-demo") return;
  if (isIncompleteLocalChapter({ verses })) return;
  await bibleLocalDb.installChapter(translationId, { book, chapter, verses });
}

export async function readLocalChapter(
  translationId: string,
  book: string,
  chapter: number,
): Promise<LocalChapterRecord | null> {
  const row = await bibleLocalDb.getChapter(translationId, book, chapter);
  if (!row) return null;
  if (isIncompleteLocalChapter(row)) return null;
  return row;
}

/** Peek raw local chapter (including incomplete demo) for instant paint while refetching. */
export async function peekLocalChapter(
  translationId: string,
  book: string,
  chapter: number,
): Promise<LocalChapterRecord | null> {
  return bibleLocalDb.getChapter(translationId, book, chapter);
}
