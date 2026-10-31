/**
 * CrossWire / getbible ChiUns (cus → cuvs) and related PD dumps sometimes
 * export Latin footnote markers (`a`, `b`, …) as the entire verse text when
 * the real wording was merged into the previous verse (e.g. Esth.1:14 → "a").
 * Drop those markers so readers never see orphan letters between verse numbers.
 */

const FOOTNOTE_MARKER_ONLY = /^[a-z]{1,3}$/i;

export function isFootnoteMarkerVerseText(text: string): boolean {
  return FOOTNOTE_MARKER_ONLY.test(String(text ?? "").trim());
}

export type CorpusVerseLike = { verse: number; text: string };

/** Normalize whitespace and drop empty / footnote-marker-only verses. */
export function sanitizeCorpusVerses<T extends CorpusVerseLike>(verses: T[]): T[] {
  const out: T[] = [];
  for (const v of verses ?? []) {
    const verse = Number(v.verse);
    const text = String(v.text ?? "")
      .replace(/\s+/g, " ")
      .trim();
    if (!Number.isFinite(verse) || verse < 1) continue;
    if (!text || isFootnoteMarkerVerseText(text)) continue;
    out.push({ ...v, verse, text });
  }
  return out;
}

export function sanitizeCorpusChapter<T extends { verses: CorpusVerseLike[] }>(chapter: T): T {
  return {
    ...chapter,
    verses: sanitizeCorpusVerses(chapter.verses),
  };
}
