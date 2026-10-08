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
/** Bump when boot seed source changes (demo → download/R2 fixtures). */
/** Bump when boot set changes (cuvs+nasb whole-Bible / denser demo chapters). */
const BOOT_FLAG = "lh.bible.bootSeeded.v4";

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

/**
 * First launch: seed only boot-default translations into IndexedDB.
 * Prefer `/v1/bible/corpus-download/:tid` (R2/fixture JSON) over inline demo packs.
 */
export async function ensureBootCorpusSeeded(
  fetchPack?: BootSeedFetch,
): Promise<{ seeded: boolean; tids: string[]; sources: Record<string, string> }> {
  const sources: Record<string, string> = {};
  if (typeof indexedDB === "undefined") {
    return { seeded: false, tids: [], sources };
  }
  if (localStorage.getItem(BOOT_FLAG) === "1") {
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
        /* fall through to demo */
      }
    }
    if (!chapters) {
      chapters = buildDemoDownloadPack(tid).chapters;
      source = "demo";
    }
    await bibleLocalDb.installPack(tid, chapters);
    sources[tid] = source;
  }
  localStorage.setItem(BOOT_FLAG, "1");
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
