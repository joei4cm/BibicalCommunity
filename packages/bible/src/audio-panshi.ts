/**
 * 磐石有声圣经 (god66 / 55bible) chapter audio.
 * Playlist paths: panshi/{bookNr}-{chapter}.mp3 (Protestant 1–66).
 * Upstream is HTTP-only; clients should load via the API HTTPS proxy.
 */

import { BOOK_LIST } from "./books.js";

/** Public HTTP origin used by god66.cn 磐石 player (CORS: *). */
export const PANSHI_MP3_BASE = "http://112.84.125.239:1230/55bible/";

/** Protestant canon index (1–66) for OSIS book id. */
export function protestantBookNumber(bookId: string): number | null {
  const i = BOOK_LIST.findIndex((b) => b.id === bookId);
  return i >= 0 ? i + 1 : null;
}

/** Relative path under PANSHI_MP3_BASE, e.g. `panshi/43-1.mp3`. */
export function panshiAudioRelativePath(bookId: string, chapter: number): string | null {
  const n = protestantBookNumber(bookId);
  if (n == null || !Number.isFinite(chapter) || chapter < 1) return null;
  const bookPad = String(n).padStart(2, "0");
  return `panshi/${bookPad}-${Math.floor(chapter)}.mp3`;
}

/** Direct upstream URL (HTTP). Prefer API proxy on HTTPS pages. */
export function panshiAudioUpstreamUrl(bookId: string, chapter: number): string | null {
  const rel = panshiAudioRelativePath(bookId, chapter);
  if (!rel) return null;
  return `${PANSHI_MP3_BASE}${rel}`;
}
