import { buildExternalUrl, getTranslation, type TranslationMeta } from "./translations.js";
import { formatRef, type VerseRef } from "./refs.js";
import { WEB_JOHN_1 } from "./sample-web-john1.js";

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

  if (meta.provider === "r2" && !meta.available) {
    throw new Error(`Translation ${translationId} not provisioned in R2 yet`);
  }

  // Local PD sample scaffold
  if (meta.id === "web" && ref.book.toLowerCase() === "john" && ref.chapter === 1) {
    return {
      translationId: meta.id,
      book: "John",
      chapter: 1,
      verses: WEB_JOHN_1,
      source: "local",
    };
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
