/**
 * Local reading history (recent chapter pointers).
 * Cloud sync lives in reader-vault.ts (encrypted /v1/me/vault).
 */

import { parseReaderPlace, saveReaderPlace, type ReaderPlace } from "./reader-place";

const HISTORY_KEY = "lh.reader.history";
export const READER_HISTORY_MAX = 40;

export type ReaderHistoryEntry = ReaderPlace & { updatedAt: number };

function placeKey(p: Pick<ReaderPlace, "tid" | "bookSlug" | "chapter">): string {
  return `${p.tid}/${p.bookSlug}/${p.chapter}`;
}

export function parseReaderHistory(raw: string | null | undefined): ReaderHistoryEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: ReaderHistoryEntry[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== "object") continue;
      const place = parseReaderPlace(
        JSON.stringify({
          tid: (row as ReaderHistoryEntry).tid,
          bookSlug: (row as ReaderHistoryEntry).bookSlug,
          chapter: (row as ReaderHistoryEntry).chapter,
        }),
      );
      if (!place) continue;
      const updatedAt = Number((row as ReaderHistoryEntry).updatedAt);
      out.push({
        ...place,
        updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : Date.now(),
      });
    }
    return out;
  } catch {
    return [];
  }
}

export function sortCapHistory(entries: ReaderHistoryEntry[]): ReaderHistoryEntry[] {
  const byKey = new Map<string, ReaderHistoryEntry>();
  for (const e of entries) {
    const k = placeKey(e);
    const prev = byKey.get(k);
    if (!prev || e.updatedAt >= prev.updatedAt) byKey.set(k, e);
  }
  return [...byKey.values()]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, READER_HISTORY_MAX);
}

export function loadReaderHistory(): ReaderHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  return sortCapHistory(parseReaderHistory(localStorage.getItem(HISTORY_KEY)));
}

export function persistReaderHistory(entries: ReaderHistoryEntry[]): ReaderHistoryEntry[] {
  const next = sortCapHistory(entries);
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  }
  return next;
}

/** Save current place + prepend history locally. */
export function recordReaderVisitLocal(place: ReaderPlace): ReaderHistoryEntry[] {
  const parsed = parseReaderPlace(JSON.stringify(place));
  if (!parsed) return loadReaderHistory();
  saveReaderPlace(parsed);
  const now = Date.now();
  return persistReaderHistory([{ ...parsed, updatedAt: now }, ...loadReaderHistory()]);
}
