import { buildExternalUrl, getTranslation, type TranslationMeta } from "./translations.js";
import { formatRef, type VerseRef } from "./refs.js";
import { WEB_JOHN_1 } from "./sample-web-john1.js";
import { KJV_JOHN_1 } from "./sample-kjv-john1.js";
import { ASV_JOHN_1 } from "./sample-asv-john1.js";
import { BUNGO_JOHN_1 } from "./sample-bungo-john1.js";
import { WEB_JOHN_2 } from "./packs/web-john2.js";
import { WEB_JOHN_3 } from "./packs/web-john3.js";
import { KJV_JOHN_3 } from "./packs/kjv-john3.js";
import { ASV_JOHN_3 } from "./packs/asv-john3.js";
import { WEB_PSALM_23 } from "./sample-web-ps23.js";
import { KOUGO_JOHN_1 } from "./packs/kougo-john1.js";
import { CUVT_JOHN_1 } from "./packs/cuvt-john1.js";
import { CUVS_JOHN_1 } from "./packs/cuvs-john1.js";
import { CUVS_JOHN_2 } from "./packs/cuvs-john2.js";
import { RCUV_JOHN_1 } from "./packs/rcuv-john1.js";
import { SHINKAIYAKU_JOHN_1 } from "./packs/shinkaiyaku-john1.js";
import { SHIN_KYOUDOU_JOHN_1 } from "./packs/shin-kyoudou-john1.js";
import { CCB_JOHN_1 } from "./packs/ccb-john1.js";
import { LZZ_JOHN_1 } from "./packs/lzz-john1.js";
import { KOUGO_JOHN_2 } from "./packs/kougo-john2.js";
import { KJV_JOHN_2 } from "./packs/kjv-john2.js";
import { ASV_JOHN_2 } from "./packs/asv-john2.js";
import { CUVT_JOHN_2 } from "./packs/cuvt-john2.js";
import { RCUV_JOHN_2 } from "./packs/rcuv-john2.js";
import { CCB_JOHN_2 } from "./packs/ccb-john2.js";
import { LZZ_JOHN_2 } from "./packs/lzz-john2.js";
import { SHINKAIYAKU_JOHN_2 } from "./packs/shinkaiyaku-john2.js";
import { SHIN_KYOUDOU_JOHN_2 } from "./packs/shin-kyoudou-john2.js";
import { KOUGOYAKU_PD_JOHN_2 } from "./packs/kougoyaku-pd-john2.js";
import { CUVS_JOHN_3 } from "./packs/cuvs-john3.js";
import { CUVT_JOHN_3 } from "./packs/cuvt-john3.js";
import { RCUV_JOHN_3 } from "./packs/rcuv-john3.js";
import { CCB_JOHN_3 } from "./packs/ccb-john3.js";
import { LZZ_JOHN_3 } from "./packs/lzz-john3.js";
import { KOUGO_JOHN_3 } from "./packs/kougo-john3.js";
import { SHINKAIYAKU_JOHN_3 } from "./packs/shinkaiyaku-john3.js";
import { SHIN_KYOUDOU_JOHN_3 } from "./packs/shin-kyoudou-john3.js";
import { KOUGOYAKU_PD_JOHN_3 } from "./packs/kougoyaku-pd-john3.js";

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
  web: { 1: WEB_JOHN_1, 2: WEB_JOHN_2, 3: WEB_JOHN_3 },
  kjv: { 1: KJV_JOHN_1, 2: KJV_JOHN_2, 3: KJV_JOHN_3 },
  asv: { 1: ASV_JOHN_1, 2: ASV_JOHN_2, 3: ASV_JOHN_3 },
  "kougoyaku-pd": { 1: BUNGO_JOHN_1, 2: KOUGOYAKU_PD_JOHN_2, 3: KOUGOYAKU_PD_JOHN_3 },
  kougo: { 1: KOUGO_JOHN_1, 2: KOUGO_JOHN_2, 3: KOUGO_JOHN_3 },
  cuvt: { 1: CUVT_JOHN_1, 2: CUVT_JOHN_2, 3: CUVT_JOHN_3 },
  cuvs: { 1: CUVS_JOHN_1, 2: CUVS_JOHN_2, 3: CUVS_JOHN_3 },
  rcuv: { 1: RCUV_JOHN_1, 2: RCUV_JOHN_2, 3: RCUV_JOHN_3 },
  shinkaiyaku: { 1: SHINKAIYAKU_JOHN_1, 2: SHINKAIYAKU_JOHN_2, 3: SHINKAIYAKU_JOHN_3 },
  shinKyoudou: { 1: SHIN_KYOUDOU_JOHN_1, 2: SHIN_KYOUDOU_JOHN_2, 3: SHIN_KYOUDOU_JOHN_3 },
  ccb: { 1: CCB_JOHN_1, 2: CCB_JOHN_2, 3: CCB_JOHN_3 },
  lzz: { 1: LZZ_JOHN_1, 2: LZZ_JOHN_2, 3: LZZ_JOHN_3 },
};

export type ExternalChapterPayload = {
  external: true;
  url: string;
  meta: TranslationMeta;
  sso: boolean;
};

export async function loadChapter(
  translationId: string,
  ref: VerseRef,
  sso: PartnerSsoFlags = { endao: false, weread: false },
): Promise<ChapterPayload | ExternalChapterPayload> {
  const meta = getTranslation(translationId);
  if (!meta) throw new Error(`Unknown translation: ${translationId}`);

  if (meta.provider === "external") {
    const url = buildExternalUrl(meta, formatRef(ref));
    if (!url) throw new Error("Missing external URL template");
    // SSO: when partner supports cross-login, callers attach tokens; else plain deep link.
    const ssoOn = Boolean(meta.ssoFlag && sso[meta.ssoFlag]);
    if (ssoOn) {
      return { external: true, url: `${url}&sso=1`, meta, sso: true as const };
    }
    return { external: true, url, meta, sso: false as const };
  }

  // Local PD / scaffold samples (John chapters for dual-pane / offline reading)
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

  if (
    meta.id === "web" &&
    (ref.book.toLowerCase() === "ps" ||
      ref.book.toLowerCase() === "psalm" ||
      ref.book.toLowerCase() === "psalms") &&
    ref.chapter === 23
  ) {
    return {
      translationId: meta.id,
      book: "Ps",
      chapter: 23,
      verses: WEB_PSALM_23,
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
