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
import { WEB_GEN_1 } from "./packs/web-gen1.js";
import { KJV_GEN_1 } from "./packs/kjv-gen1.js";
import { ASV_GEN_1 } from "./packs/asv-gen1.js";
import { WEB_MATT_5 } from "./packs/web-matt5.js";
import { KJV_MATT_5 } from "./packs/kjv-matt5.js";
import { ASV_MATT_5 } from "./packs/asv-matt5.js";
import { KJV_PSALM_23 } from "./packs/kjv-ps23.js";
import { ASV_PSALM_23 } from "./packs/asv-ps23.js";
import { CUVS_GEN_1 } from "./packs/cuvs-gen1.js";
import { KOUGO_GEN_1 } from "./packs/kougo-gen1.js";
import { CUVS_PSALM_23 } from "./packs/cuvs-ps23.js";
import { KOUGO_PSALM_23 } from "./packs/kougo-ps23.js";
import { WEB_ROM_8 } from "./packs/web-rom8.js";
import { KJV_ROM_8 } from "./packs/kjv-rom8.js";
import { ASV_ROM_8 } from "./packs/asv-rom8.js";
import { CUVS_ROM_8 } from "./packs/cuvs-rom8.js";
import { KOUGO_ROM_8 } from "./packs/kougo-rom8.js";
import { WEB_HEB_11 } from "./packs/web-heb11.js";
import { KJV_HEB_11 } from "./packs/kjv-heb11.js";
import { ASV_HEB_11 } from "./packs/asv-heb11.js";
import { CUVS_HEB_11 } from "./packs/cuvs-heb11.js";
import { KOUGO_HEB_11 } from "./packs/kougo-heb11.js";
import { WEB_ISA_53 } from "./packs/web-isa53.js";
import { KJV_ISA_53 } from "./packs/kjv-isa53.js";
import { ASV_ISA_53 } from "./packs/asv-isa53.js";
import { CUVS_ISA_53 } from "./packs/cuvs-isa53.js";
import { KOUGO_ISA_53 } from "./packs/kougo-isa53.js";
import { WEB_ACTS_2 } from "./packs/web-acts2.js";
import { KJV_ACTS_2 } from "./packs/kjv-acts2.js";
import { ASV_ACTS_2 } from "./packs/asv-acts2.js";
import { CUVS_ACTS_2 } from "./packs/cuvs-acts2.js";
import { KOUGO_ACTS_2 } from "./packs/kougo-acts2.js";
import { WEB_PSALM_1 } from "./packs/web-ps1.js";
import { KJV_PSALM_1 } from "./packs/kjv-ps1.js";
import { ASV_PSALM_1 } from "./packs/asv-ps1.js";
import { CUVS_PSALM_1 } from "./packs/cuvs-ps1.js";
import { KOUGO_PSALM_1 } from "./packs/kougo-ps1.js";
import { WEB_PROV_3 } from "./packs/web-prov3.js";
import { KJV_PROV_3 } from "./packs/kjv-prov3.js";
import { ASV_PROV_3 } from "./packs/asv-prov3.js";
import { CUVS_PROV_3 } from "./packs/cuvs-prov3.js";
import { KOUGO_PROV_3 } from "./packs/kougo-prov3.js";

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

type VerseRow = { verse: number; text: string };

/** Normalize book aliases used by dual-pane / plans / smoke refs. */
function normalizeBookKey(book: string): string | null {
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
  return null;
}

function canonicalBookId(key: string): string {
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
    default:
      return key;
  }
}

/**
 * Local PD / scaffold chapter samples for dual-pane / offline reading.
 * Keyed by translationId → bookKey → chapter → verses.
 */
const LOCAL_SAMPLES: Record<string, Record<string, Record<number, VerseRow[]>>> = {
  web: {
    john: { 1: WEB_JOHN_1, 2: WEB_JOHN_2, 3: WEB_JOHN_3 },
    gen: { 1: WEB_GEN_1 },
    matt: { 5: WEB_MATT_5 },
    ps: { 1: WEB_PSALM_1, 23: WEB_PSALM_23 },
    prov: { 3: WEB_PROV_3 },
    rom: { 8: WEB_ROM_8 },
    heb: { 11: WEB_HEB_11 },
    isa: { 53: WEB_ISA_53 },
    acts: { 2: WEB_ACTS_2 },
  },
  kjv: {
    john: { 1: KJV_JOHN_1, 2: KJV_JOHN_2, 3: KJV_JOHN_3 },
    gen: { 1: KJV_GEN_1 },
    matt: { 5: KJV_MATT_5 },
    ps: { 1: KJV_PSALM_1, 23: KJV_PSALM_23 },
    prov: { 3: KJV_PROV_3 },
    rom: { 8: KJV_ROM_8 },
    heb: { 11: KJV_HEB_11 },
    isa: { 53: KJV_ISA_53 },
    acts: { 2: KJV_ACTS_2 },
  },
  asv: {
    john: { 1: ASV_JOHN_1, 2: ASV_JOHN_2, 3: ASV_JOHN_3 },
    gen: { 1: ASV_GEN_1 },
    matt: { 5: ASV_MATT_5 },
    ps: { 1: ASV_PSALM_1, 23: ASV_PSALM_23 },
    prov: { 3: ASV_PROV_3 },
    rom: { 8: ASV_ROM_8 },
    heb: { 11: ASV_HEB_11 },
    isa: { 53: ASV_ISA_53 },
    acts: { 2: ASV_ACTS_2 },
  },
  "kougoyaku-pd": {
    john: { 1: BUNGO_JOHN_1, 2: KOUGOYAKU_PD_JOHN_2, 3: KOUGOYAKU_PD_JOHN_3 },
  },
  kougo: {
    john: { 1: KOUGO_JOHN_1, 2: KOUGO_JOHN_2, 3: KOUGO_JOHN_3 },
    gen: { 1: KOUGO_GEN_1 },
    ps: { 1: KOUGO_PSALM_1, 23: KOUGO_PSALM_23 },
    prov: { 3: KOUGO_PROV_3 },
    rom: { 8: KOUGO_ROM_8 },
    heb: { 11: KOUGO_HEB_11 },
    isa: { 53: KOUGO_ISA_53 },
    acts: { 2: KOUGO_ACTS_2 },
  },
  cuvt: {
    john: { 1: CUVT_JOHN_1, 2: CUVT_JOHN_2, 3: CUVT_JOHN_3 },
  },
  cuvs: {
    john: { 1: CUVS_JOHN_1, 2: CUVS_JOHN_2, 3: CUVS_JOHN_3 },
    gen: { 1: CUVS_GEN_1 },
    ps: { 1: CUVS_PSALM_1, 23: CUVS_PSALM_23 },
    prov: { 3: CUVS_PROV_3 },
    rom: { 8: CUVS_ROM_8 },
    heb: { 11: CUVS_HEB_11 },
    isa: { 53: CUVS_ISA_53 },
    acts: { 2: CUVS_ACTS_2 },
  },

  rcuv: {
    john: { 1: RCUV_JOHN_1, 2: RCUV_JOHN_2, 3: RCUV_JOHN_3 },
  },
  shinkaiyaku: {
    john: { 1: SHINKAIYAKU_JOHN_1, 2: SHINKAIYAKU_JOHN_2, 3: SHINKAIYAKU_JOHN_3 },
  },
  shinKyoudou: {
    john: { 1: SHIN_KYOUDOU_JOHN_1, 2: SHIN_KYOUDOU_JOHN_2, 3: SHIN_KYOUDOU_JOHN_3 },
  },
  ccb: {
    john: { 1: CCB_JOHN_1, 2: CCB_JOHN_2, 3: CCB_JOHN_3 },
  },
  lzz: {
    john: { 1: LZZ_JOHN_1, 2: LZZ_JOHN_2, 3: LZZ_JOHN_3 },
  },
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

  const bookKey = normalizeBookKey(ref.book);
  if (bookKey) {
    const verses = LOCAL_SAMPLES[meta.id]?.[bookKey]?.[ref.chapter];
    if (verses) {
      return {
        translationId: meta.id,
        book: canonicalBookId(bookKey),
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
