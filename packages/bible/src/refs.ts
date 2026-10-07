export interface VerseRef {
  book: string;
  chapter: number;
  verseStart?: number;
  verseEnd?: number;
}

/** Parse simple refs: "John.3.16", "John.3.16-18", "John 3:16" */
export function parseRef(input: string): VerseRef | null {
  const normalized = input.trim().replace(/\s+/g, " ");
  const m =
    normalized.match(/^([1-3]?\s?[A-Za-z\u4e00-\u9fff]+)\.?(\d+)(?:[:.](\d+)(?:-(\d+))?)?$/) ??
    normalized.match(/^([1-3]?[A-Za-z]+)\.(\d+)(?:\.(\d+)(?:-(\d+))?)?$/);
  if (!m) return null;
  const book = (m[1] ?? "").replace(/\s+/g, "");
  const chapter = Number(m[2]);
  const verseStart = m[3] ? Number(m[3]) : undefined;
  const verseEnd = m[4] ? Number(m[4]) : undefined;
  if (!book || !Number.isFinite(chapter)) return null;
  return { book, chapter, verseStart, verseEnd };
}

export function formatRef(ref: VerseRef): string {
  let s = `${ref.book}.${ref.chapter}`;
  if (ref.verseStart) {
    s += `.${ref.verseStart}`;
    if (ref.verseEnd && ref.verseEnd !== ref.verseStart) s += `-${ref.verseEnd}`;
  }
  return s;
}
