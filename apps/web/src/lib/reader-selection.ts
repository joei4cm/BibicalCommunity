export type VerseRange = { start: number; end: number };

export function normalizeVerseRange(a: number, b: number): VerseRange {
  return a <= b ? { start: a, end: b } : { start: b, end: a };
}

/**
 * Horizontal chapter turn vs verse range drag.
 * Inline verses sit left→right, so short sideways moves may still select;
 * a clear horizontal swipe (matching chapter-turn intent) must not.
 */
export function isChapterSwipeGesture(
  dx: number,
  dy: number,
  thresholdPx = 40,
  dominance = 1.25,
): boolean {
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  return absDx >= thresholdPx && absDx > absDy * dominance;
}

/**
 * First tap selects one verse. A later tap grows the range from the anchor.
 * Tapping the only selected verse clears the selection.
 * When idle, tapping a painted highlight selects that whole annotation range.
 */
export function applyVerseTap(
  selection: VerseRange | null,
  anchor: number | null,
  verse: number,
  highlightRangeForVerse?: VerseRange | null,
): { selection: VerseRange | null; anchor: number | null } {
  if (selection && selection.start === selection.end && selection.start === verse) {
    return { selection: null, anchor: null };
  }
  if (!selection || anchor == null) {
    if (highlightRangeForVerse) {
      return {
        selection: highlightRangeForVerse,
        anchor: highlightRangeForVerse.start,
      };
    }
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

/** Full verse span covered by the annotation id that paints this verse. */
export function rangeForHighlightAt(
  idsByVerse: Record<number, string | undefined>,
  verse: number,
): VerseRange | null {
  const id = idsByVerse[verse];
  if (!id) return null;
  let start = verse;
  let end = verse;
  for (const [raw, hid] of Object.entries(idsByVerse)) {
    if (hid !== id) continue;
    const v = Number(raw);
    if (!Number.isFinite(v)) continue;
    if (v < start) start = v;
    if (v > end) end = v;
  }
  return { start, end };
}
