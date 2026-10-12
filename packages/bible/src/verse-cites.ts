import { bookSlug, getBook } from "./books.js";
import { resolveBookId } from "./book-aliases.js";
import { canonicalBookId, normalizeBookKey } from "./provider.js";
import { parseRef, type VerseRef } from "./refs.js";

export type VerseCite = {
  raw: string;
  bookId: string;
  chapter: number;
  verseStart?: number;
  verseEnd?: number;
  href: string;
};

export type TextSegment =
  | { type: "text"; value: string }
  | { type: "cite"; value: string; href: string; cite: VerseCite };

/** Match `#约一1:2`, `#John3:16`, `#1John.1.2` inside free text. */
const CITE_RE =
  /#([1-3]?[A-Za-z\u4e00-\u9fff]+)\.?(\d+)(?:[:.](\d+)(?:-(\d+))?)?/g;

function bookIdFromToken(token: string): string | null {
  const resolved = resolveBookId(token);
  if (resolved && getBook(resolved)) return resolved;
  const key = normalizeBookKey(token);
  if (!key) return null;
  const id = canonicalBookId(key);
  return getBook(id) ? id : null;
}

/** Parse a single cite token (with or without leading `#`). */
export function parseVerseCite(
  input: string,
  translationId = "cuvs",
): VerseCite | null {
  const raw = input.trim();
  const body = raw.startsWith("#") ? raw.slice(1) : raw;
  const ref = parseRef(body);
  if (!ref) return null;
  const bookId = bookIdFromToken(ref.book);
  if (!bookId) return null;
  const href = bibleHrefForCite(bookId, ref, translationId);
  return {
    raw: raw.startsWith("#") ? raw : `#${raw}`,
    bookId,
    chapter: ref.chapter,
    verseStart: ref.verseStart,
    verseEnd: ref.verseEnd,
    href,
  };
}

export function bibleHrefForCite(
  bookId: string,
  ref: Pick<VerseRef, "chapter" | "verseStart">,
  translationId = "cuvs",
): string {
  const slug = bookSlug(bookId);
  const base = `/app/bible/${translationId}/${slug}/${ref.chapter}`;
  if (ref.verseStart) return `${base}?verse=${ref.verseStart}`;
  return base;
}

/** Split message text into plain runs and clickable verse cites. */
export function splitVerseCites(
  text: string,
  translationId = "cuvs",
): TextSegment[] {
  if (!text) return [];
  const out: TextSegment[] = [];
  let last = 0;
  CITE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CITE_RE.exec(text)) !== null) {
    if (m.index > last) {
      out.push({ type: "text", value: text.slice(last, m.index) });
    }
    const raw = m[0] ?? "";
    const cite = parseVerseCite(raw, translationId);
    if (cite) {
      out.push({ type: "cite", value: raw, href: cite.href, cite });
    } else {
      out.push({ type: "text", value: raw });
    }
    last = m.index + raw.length;
  }
  if (last < text.length) {
    out.push({ type: "text", value: text.slice(last) });
  }
  return out.length ? out : [{ type: "text", value: text }];
}
