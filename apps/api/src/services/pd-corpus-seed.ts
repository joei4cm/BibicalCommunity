/**
 * Seed public-domain Bible corpora into R2 from getbible.net.
 * Never licensed proprietary dumps; never TypeScript packs.
 * One book per call keeps Workers CPU/subrequest budgets safe.
 *
 * Product tids may map to a different getbible abbreviation
 * (e.g. cuvs ← cus 和合本简体公版).
 */
import { BOOK_LIST, r2ChapterObjectKey, r2CorpusPrefix } from "@logoshome/bible";

/** Product translation ids that may be seeded from a public-domain getbible source. */
export const PD_SEED_TRANSLATION_IDS = ["web", "kjv", "asv", "cuvs"] as const;
export type PdSeedTranslationId = (typeof PD_SEED_TRANSLATION_IDS)[number];

/** getbible.net translation abbreviation for each product tid. */
export const PD_GETBIBLE_SOURCE: Record<PdSeedTranslationId, string> = {
  web: "web",
  kjv: "kjv",
  asv: "asv",
  /** CrossWire / getbible mark 和合本简体 (cus) as Public Domain. */
  cuvs: "cus",
};

const PD_ALLOWED = new Set<string>(PD_SEED_TRANSLATION_IDS);

/** getbible book nr (1–66) → OSIS id (Protestant order matches BOOK_LIST). */
const NR_TO_OSIS = Object.fromEntries(BOOK_LIST.map((b, i) => [i + 1, b.id])) as Record<
  number,
  string
>;

export function isPdSeedTranslationId(tid: string): tid is PdSeedTranslationId {
  return PD_ALLOWED.has(tid);
}

export function osisForBookNr(bookNr: number): string | undefined {
  return NR_TO_OSIS[bookNr];
}

export function getbibleSourceForTid(tid: PdSeedTranslationId): string {
  return PD_GETBIBLE_SOURCE[tid];
}

type GetbibleVerse = { verse?: number | string; text?: string };
type GetbibleChapter = {
  chapter?: number | string;
  verses?: GetbibleVerse[];
};
type GetbibleBook = {
  chapters?: GetbibleChapter[];
};

/**
 * Fetch one Protestant book from getbible and write chapter objects to MEDIA
 * under the product translation id (not the getbible abbreviation).
 */
export async function seedPdBookToR2(
  media: R2Bucket,
  tid: PdSeedTranslationId,
  bookNr: number,
): Promise<{ book: string; chaptersPut: number; keys: string[]; source: string }> {
  if (bookNr < 1 || bookNr > 66) {
    throw new Error(`invalid_book_nr:${bookNr}`);
  }
  const osis = osisForBookNr(bookNr);
  if (!osis) throw new Error(`unknown_book_nr:${bookNr}`);

  const source = getbibleSourceForTid(tid);
  const url = `https://api.getbible.net/v2/${source}/${bookNr}.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`getbible_fetch_failed:${res.status}`);
  const book = (await res.json()) as GetbibleBook;
  const chapters = book.chapters ?? [];
  const keys: string[] = [];

  for (const ch of chapters) {
    const chapter = Number(ch.chapter);
    if (!Number.isFinite(chapter) || chapter < 1) continue;
    const verses = (ch.verses ?? [])
      .map((v) => ({
        verse: Number(v.verse),
        text: String(v.text ?? "")
          .replace(/\s+/g, " ")
          .trim(),
      }))
      .filter((v) => Number.isFinite(v.verse) && v.verse > 0 && v.text.length > 0);
    if (!verses.length) continue;

    const key = r2ChapterObjectKey(tid, osis, chapter);
    const body = JSON.stringify({ book: osis, chapter, verses });
    await media.put(key, body, {
      httpMetadata: { contentType: "application/json" },
    });
    keys.push(key);
  }

  return { book: osis, chaptersPut: keys.length, keys, source };
}

/** Count R2 objects under bible/{tid}/ (paginated). */
export async function countPdCorpusObjects(
  media: R2Bucket,
  tid: string,
): Promise<{ objectCount: number; prefix: string; sampleKeys: string[] }> {
  const prefix = r2CorpusPrefix(tid);
  let objectCount = 0;
  const sampleKeys: string[] = [];
  let cursor: string | undefined;
  for (;;) {
    const listed = await media.list({ prefix, limit: 1000, cursor });
    objectCount += listed.objects.length;
    for (const obj of listed.objects) {
      if (sampleKeys.length < 5) sampleKeys.push(obj.key);
    }
    if (!listed.truncated) break;
    cursor = listed.cursor;
  }
  return { objectCount, prefix, sampleKeys };
}

/**
 * Lazy-fill one missing chapter: fetch its book from getbible, write all
 * chapters of that book to R2, return the requested chapter JSON (or null).
 */
export async function ensurePdChapterInR2(
  media: R2Bucket,
  tid: string,
  book: string,
  chapter: number,
): Promise<{ book: string; chapter: number; verses: { verse: number; text: string }[] } | null> {
  if (!isPdSeedTranslationId(tid)) return null;
  const bookNr = BOOK_LIST.findIndex((b) => b.id === book) + 1;
  if (bookNr < 1) return null;
  const seeded = await seedPdBookToR2(media, tid, bookNr);
  if (!seeded.chaptersPut) return null;
  const key = r2ChapterObjectKey(tid, book, chapter);
  const obj = await media.get(key);
  if (!obj) return null;
  try {
    const parsed = JSON.parse(await obj.text()) as {
      book: string;
      chapter: number;
      verses: { verse: number; text: string }[];
    };
    if (!parsed?.verses?.length) return null;
    return parsed;
  } catch {
    return null;
  }
}
