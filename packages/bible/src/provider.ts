import { buildExternalUrl, getTranslation, type TranslationMeta } from "./translations.js";
import { formatRef, type VerseRef } from "./refs.js";
import { WEB_JOHN_1 } from "./sample-web-john1.js";
import { KJV_JOHN_1 } from "./sample-kjv-john1.js";
import { ASV_JOHN_1 } from "./sample-asv-john1.js";
import { BUNGO_JOHN_1 } from "./sample-bungo-john1.js";
import { WEB_JOHN_3 } from "./packs/web-john3.js";

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

function isJohn(book: string): boolean {
  const b = book.toLowerCase();
  return b === "john" || book === "ヨハネ";
}

const LOCAL_JOHN_SAMPLES: Record<string, Record<number, { verse: number; text: string }[]>> = {
  web: { 1: WEB_JOHN_1, 3: WEB_JOHN_3 },
  kjv: { 1: KJV_JOHN_1 },
  asv: { 1: ASV_JOHN_1 },
  "kougoyaku-pd": { 1: BUNGO_JOHN_1 },
  kougo: { 1: BUNGO_JOHN_1 },
};

export async function loadChapter(
  translationId: string,
  ref: VerseRef,
  sso: PartnerSsoFlags = { endao: false, weread: false },
): Promise<ChapterPayload | { external: true; url: string; meta: TranslationMeta }> {
  const meta = getTranslation(translationId);
  if (!meta) throw new Error(`Unknown translation: ${translationId}`);

  if (meta.provider === "external") {
    const url = buildExternalUrl(meta, formatRef(ref));
    if (!url) throw new Error("Missing external URL template");
    // SSO: when partner supports cross-login, callers attach tokens; else plain deep link.
    if (meta.ssoFlag && sso[meta.ssoFlag]) {
      return { external: true, url: `${url}&sso=1`, meta };
    }
    return { external: true, url, meta };
  }

  if (meta.provider === "r2") {
    // R2 corpus is loaded by the API Worker (MEDIA binding). Package-level
    // callers get a stub until they fetch via /v1/bible/chapter.
    if (!meta.available) {
      throw new Error(`Translation ${translationId} not provisioned in R2 yet`);
    }
    return {
      translationId: meta.id,
      book: ref.book,
      chapter: ref.chapter,
      verses: [],
      source: "r2",
    };
  }

  // Local PD samples (John chapters for dual-pane / scaffold reading)
  if (isJohn(ref.book)) {
    const verses = LOCAL_JOHN_SAMPLES[meta.id]?.[ref.chapter];
    if (verses) {
      return {
        translationId: meta.id,
        book: "John",
        chapter: ref.chapter,
        verses,
        source: "local",
      };
    }
  }

  return {
    translationId: meta.id,
    book: ref.book,
    chapter: ref.chapter,
    verses: [
      {
        verse: 1,
        text: `[${meta.abbreviation}] Sample placeholder for ${formatRef(ref)}. Full corpus loads from local pack or R2.`,
      },
    ],
    source: "local",
  };
}
