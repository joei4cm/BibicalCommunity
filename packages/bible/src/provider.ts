/**
 * Translation chapter resolve path.
 *
 * Verse text is NOT embedded here. Boot ships whole-Bible defaults
 * (和合本 cuvs + NASB); everything else is R2 → local DB (whole-Bible download)
 * or external.
 * Package-level `loadChapter` returns deep-links for external ids and empty
 * R2 stubs for downloadable ids — Workers fill verses from MEDIA.
 */

import { osisFromZhToken } from "./book-aliases.js";
import { getBook } from "./books.js";
import { assertAllowedContentSource } from "./content-policy.js";
import { buildExternalUrl, getTranslation, type TranslationMeta } from "./translations.js";
import { formatRef, type VerseRef } from "./refs.js";

export interface ChapterPayload {
  translationId: string;
  book: string;
  chapter: number;
  verses: { verse: number; text: string }[];
  source: "local" | "r2" | "external";
  externalUrl?: string;
}

export interface PartnerSsoFlags {
  endao: boolean;
  weread: boolean;
}

/** Normalize book aliases used by dual-pane / plans / smoke refs. */
export function normalizeBookKey(book: string): string | null {
  const zhOsis = osisFromZhToken(book);
  if (zhOsis) return zhOsis.toLowerCase();
  const b = book.toLowerCase().replace(/\s+/g, "");
  if (b === "john" || book === "ヨハネ") return "john";
  if (b === "gen" || b === "genesis" || book === "创世记" || book === "創世記") return "gen";
  if (b === "matt" || b === "matthew" || b === "mt" || book === "马太福音" || book === "マタイ") {
    return "matt";
  }
  if (b === "ps" || b === "psalm" || b === "psalms" || book === "诗篇" || book === "詩篇") {
    return "ps";
  }
  if (b === "prov" || b === "proverbs" || book === "箴言") {
    return "prov";
  }
  if (b === "rom" || b === "romans" || book === "罗马书" || book === "ローマ") {
    return "rom";
  }
  if (b === "heb" || b === "hebrews" || book === "希伯来书" || book === "ヘブル") {
    return "heb";
  }
  if (b === "isa" || b === "isaiah" || book === "以赛亚书" || book === "イザヤ") {
    return "isa";
  }
  if (b === "acts" || book === "使徒行传" || book === "使徒行伝" || book === "使徒の働き") {
    return "acts";
  }
  if (b === "mark" || b === "mk" || book === "马可福音" || book === "マルコ") {
    return "mark";
  }
  if (
    b === "exod" ||
    b === "ex" ||
    b === "exodus" ||
    book === "出埃及记" ||
    book === "出エジプト記"
  ) {
    return "exod";
  }
  if (b === "luke" || b === "lk" || book === "路加福音" || book === "ルカ") {
    return "luke";
  }
  if (
    b === "deut" ||
    b === "dt" ||
    b === "deuteronomy" ||
    book === "申命记" ||
    book === "申命記"
  ) {
    return "deut";
  }
  if (b === "gal" || b === "galatians" || book === "加拉太书" || book === "ガラテヤ") {
    return "gal";
  }
  if (
    b === "phil" ||
    b === "php" ||
    b === "philippians" ||
    book === "腓立比书" ||
    book === "ピリピ"
  ) {
    return "phil";
  }
  if (
    b === "1cor" ||
    b === "1co" ||
    b === "1corinthians" ||
    book === "哥林多前书" ||
    book === "コリント人への第一の手紙" ||
    book === "コリント第一"
  ) {
    return "1cor";
  }
  if (
    b === "rev" ||
    b === "re" ||
    b === "revelation" ||
    book === "启示录" ||
    book === "啟示錄" ||
    book === "ヨハネの黙示録"
  ) {
    return "rev";
  }
  if (b === "jas" || b === "james" || book === "雅各书" || book === "ヤコブ") {
    return "jas";
  }
  if (b === "col" || b === "colossians" || book === "歌罗西书" || book === "コロサイ") {
    return "col";
  }
  if (b === "eph" || b === "ephesians" || book === "以弗所书" || book === "エペソ") {
    return "eph";
  }
  if (
    b === "1john" ||
    b === "1jn" ||
    b === "1jo" ||
    book === "约翰一书" ||
    book === "約翰一書" ||
    book === "ヨハネの第一の手紙"
  ) {
    return "1john";
  }
  return null;
}

export function canonicalBookId(key: string): string {
  const known = getBook(key);
  if (known) return known.id;
  switch (key) {
    case "john":
      return "John";
    case "gen":
      return "Gen";
    case "matt":
      return "Matt";
    case "ps":
      return "Ps";
    case "prov":
      return "Prov";
    case "rom":
      return "Rom";
    case "heb":
      return "Heb";
    case "isa":
      return "Isa";
    case "acts":
      return "Acts";
    case "mark":
      return "Mark";
    case "exod":
      return "Exod";
    case "luke":
      return "Luke";
    case "deut":
      return "Deut";
    case "gal":
      return "Gal";
    case "phil":
      return "Phil";
    case "1cor":
      return "1Cor";
    case "rev":
      return "Rev";
    case "jas":
      return "Jas";
    case "col":
      return "Col";
    case "eph":
      return "Eph";
    case "1john":
      return "1John";
    default:
      return key;
  }
}

export type ExternalChapterPayload = {
  external: true;
  url: string;
  meta: TranslationMeta;
  sso: boolean;
};

/**
 * Resolve a chapter without reading TypeScript verse packs.
 * - external → partner/BibleGateway deep-link
 * - r2 (and legacy local) → empty verses; API Worker loads MEDIA / client uses local DB
 */
export async function loadChapter(
  translationId: string,
  ref: VerseRef,
  sso: PartnerSsoFlags = { endao: false, weread: false },
): Promise<ChapterPayload | ExternalChapterPayload> {
  assertAllowedContentSource(translationId);
  const meta = getTranslation(translationId);
  if (!meta) throw new Error(`Unknown translation: ${translationId}`);

  if (meta.provider === "external") {
    const url = buildExternalUrl(meta, formatRef(ref));
    if (!url) throw new Error("Missing external URL template");
    const ssoOn = Boolean(meta.ssoFlag && sso[meta.ssoFlag]);
    if (ssoOn) {
      return { external: true, url: `${url}&sso=1`, meta, sso: true as const };
    }
    return { external: true, url, meta, sso: false as const };
  }

  const bookKey = normalizeBookKey(ref.book);
  const book = bookKey ? canonicalBookId(bookKey) : ref.book;

  // Downloadable corpora live in R2 / client local DB — never in this package.
  return {
    translationId: meta.id,
    book,
    chapter: ref.chapter,
    verses: [],
    source: "r2",
  };
}

export type LocalScaffoldRef = {
  translationId: string;
  book: string;
  chapter: number;
  ref: string;
};

/**
 * @deprecated Verse text is no longer embedded in TypeScript.
 * Returns empty; use `fixtures/corpus/` + corpus-catalog / local DB instead.
 */
export function listLocalScaffoldInventory(): LocalScaffoldRef[] {
  return [];
}
