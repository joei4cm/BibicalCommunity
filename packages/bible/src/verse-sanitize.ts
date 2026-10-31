/**
 * CrossWire / getbible ChiUns (cus → cuvs) and related PD dumps sometimes
 * export Latin footnote markers (`a`, `b`, …) as the entire verse text when
 * the real wording was merged into the previous verse (e.g. Esth.1:14 → "a").
 *
 * Drop those markers and extend the previous verse's display range so readers
 * see `13-14` instead of jumping from 13 to 15.
 */

const FOOTNOTE_MARKER_ONLY = /^[a-z]{1,3}$/i;

export function isFootnoteMarkerVerseText(text: string): boolean {
  return FOOTNOTE_MARKER_ONLY.test(String(text ?? "").trim());
}

export type CorpusVerseLike = {
  verse: number;
  text: string;
  /** Inclusive end when following marker-only verses were absorbed. */
  verseEnd?: number;
};

/** Display label: `13` or `13-14` when a range was absorbed. */
export function formatVerseNumLabel(verse: number, verseEnd?: number | null): string {
  const start = Number(verse);
  const end = verseEnd == null ? NaN : Number(verseEnd);
  if (!Number.isFinite(start) || start < 1) return "";
  if (Number.isFinite(end) && end > start) return `${start}-${end}`;
  return String(start);
}

/** Normalize whitespace, drop footnote-marker-only verses, and absorb their numbers. */
export function sanitizeCorpusVerses<T extends CorpusVerseLike>(verses: T[]): T[] {
  const out: T[] = [];
  for (const v of verses ?? []) {
    const verse = Number(v.verse);
    const text = String(v.text ?? "")
      .replace(/\s+/g, " ")
      .trim();
    if (!Number.isFinite(verse) || verse < 1) continue;

    if (!text || isFootnoteMarkerVerseText(text)) {
      const prev = out[out.length - 1];
      if (!prev) continue;
      const prevEnd = Number(prev.verseEnd ?? prev.verse);
      // Absorb following marker-only verse numbers into the prior real verse.
      if (verse > prevEnd) prev.verseEnd = verse;
      continue;
    }

    const incomingEnd = v.verseEnd != null ? Number(v.verseEnd) : undefined;
    const next: T = {
      ...v,
      verse,
      text,
    };
    if (incomingEnd != null && Number.isFinite(incomingEnd) && incomingEnd > verse) {
      next.verseEnd = incomingEnd;
    } else {
      delete (next as { verseEnd?: number }).verseEnd;
    }
    out.push(next);
  }
  return out;
}

export function sanitizeCorpusChapter<T extends { verses: CorpusVerseLike[] }>(chapter: T): T {
  return {
    ...chapter,
    verses: sanitizeCorpusVerses(chapter.verses),
  };
}
