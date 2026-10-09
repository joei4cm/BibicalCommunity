/**
 * Seed public-domain Bible corpora into R2 from getbible.net.
 * Never licensed zh/ja dumps; never TypeScript packs.
 * One book per call keeps Workers CPU/subrequest budgets safe.
 */
import { BOOK_LIST, r2ChapterObjectKey, r2CorpusPrefix } from "@logoshome/bible";

export const PD_SEED_TRANSLATION_IDS = ["web", "kjv", "asv"] as const;
export type PdSeedTranslationId = (typeof PD_SEED_TRANSLATION_IDS)[number];

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

type GetbibleVerse = { verse?: number | string; text?: string };
type GetbibleChapter = {
  chapter?: number | string;
  verses?: GetbibleVerse[];
};
type GetbibleBook = {
  chapters?: GetbibleChapter[];
};

/**
 * Fetch one Protestant book from getbible and write chapter objects to MEDIA.
 */
export async function seedPdBookToR2(
  media: R2Bucket,
  tid: PdSeedTranslationId,
  bookNr: number,
): Promise<{ book: string; chaptersPut: number; keys: string[] }> {
  if (bookNr < 1 || bookNr > 66) {
    throw new Error(`invalid_book_nr:${bookNr}`);
  }
  const osis = osisForBookNr(bookNr);
  if (!osis) throw new Error(`unknown_book_nr:${bookNr}`);

  const url = `https://api.getbible.net/v2/${tid}/${bookNr}.json`;
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

  return { book: osis, chaptersPut: keys.length, keys };
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
