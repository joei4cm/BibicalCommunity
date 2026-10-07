/**
 * R2 bible chapter object format
 *
 * Object key: `bible/{translationId}/{book}.{chapter}.json`
 * Example: `bible/cuvs/John.1.json`
 *
 * JSON body shape:
 * ```json
 * {
 *   "book": "John",
 *   "chapter": 1,
 *   "verses": [{ "verse": 1, "text": "…" }]
 * }
 * ```
 */

export interface R2ChapterJson {
  book: string;
  chapter: number;
  verses: { verse: number; text: string }[];
}

export function r2ChapterObjectKey(
  translationId: string,
  book: string,
  chapter: number,
): string {
  return `bible/${translationId}/${book}.${chapter}.json`;
}

/** Build a chapter payload suitable for MEDIA.put (UTF-8 JSON). */
export function buildR2ChapterJson(input: R2ChapterJson): string {
  if (!input.book || !Number.isFinite(input.chapter) || !Array.isArray(input.verses)) {
    throw new Error("invalid_r2_chapter_shape");
  }
  const payload: R2ChapterJson = {
    book: input.book,
    chapter: input.chapter,
    verses: input.verses.map((v) => ({ verse: v.verse, text: v.text })),
  };
  return JSON.stringify(payload);
}

export function parseR2ChapterJson(raw: string): R2ChapterJson {
  const data = JSON.parse(raw) as Partial<R2ChapterJson>;
  if (
    typeof data.book !== "string" ||
    typeof data.chapter !== "number" ||
    !Array.isArray(data.verses)
  ) {
    throw new Error("invalid_r2_chapter_shape");
  }
  return {
    book: data.book,
    chapter: data.chapter,
    verses: data.verses.map((v) => ({
      verse: Number((v as { verse: number }).verse),
      text: String((v as { text: string }).text),
    })),
  };
}

/** Sample CUVS John 1 (abbreviated scaffold text for local R2 seeding). */
export function sampleCuvsJohn1(): R2ChapterJson {
  return {
    book: "John",
    chapter: 1,
    verses: [
      { verse: 1, text: "太初有道，道与神同在，道就是神。" },
      { verse: 2, text: "这道太初与神同在。" },
      { verse: 3, text: "万物是借着他造的；凡被造的，没有一样不是借着他造的。" },
      { verse: 14, text: "道成了肉身，住在我们中间，充充满满地有恩典有真理。" },
    ],
  };
}

/** Traditional CUV scaffold for R2 seeding demos. */
export function sampleCuvtJohn1(): R2ChapterJson {
  return {
    book: "John",
    chapter: 1,
    verses: [
      { verse: 1, text: "太初有道，道與神同在，道就是神。" },
      { verse: 2, text: "這道太初與神同在。" },
      { verse: 14, text: "道成了肉身，住在我們中間，充充滿滿地有恩典有真理。" },
    ],
  };
}

/** Japanese colloquial-style scaffold for R2 seeding demos. */
export function sampleKougoJohn1(): R2ChapterJson {
  return {
    book: "John",
    chapter: 1,
    verses: [
      { verse: 1, text: "初めに言があった。言は神と共にあった。言は神であった。" },
      { verse: 14, text: "そして言は肉体となり、わたしたちのうちに宿った。" },
    ],
  };
}
