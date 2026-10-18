export type VerseRange = { start: number; end: number };

export function normalizeVerseRange(a: number, b: number): VerseRange {
  return a <= b ? { start: a, end: b } : { start: b, end: a };
}

/**
 * First tap selects one verse. A later tap grows the range from the anchor.
 * Tapping the only selected verse clears the selection.
 */
export function applyVerseTap(
  selection: VerseRange | null,
  anchor: number | null,
  verse: number,
): { selection: VerseRange | null; anchor: number | null } {
  if (selection && selection.start === selection.end && selection.start === verse) {
    return { selection: null, anchor: null };
  }
  if (!selection || anchor == null) {
    return { selection: { start: verse, end: verse }, anchor: verse };
  }
  return { selection: normalizeVerseRange(anchor, verse), anchor };
}

/** One annotation can paint several verses; delete each id once. */
export function highlightIdsInRange(
  idsByVerse: Record<number, string | undefined>,
  range: VerseRange,
): string[] {
  const ids = new Set<string>();
  for (let v = range.start; v <= range.end; v += 1) {
    const id = idsByVerse[v];
    if (id) ids.add(id);
  }
  return [...ids];
}
