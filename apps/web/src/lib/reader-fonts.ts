/** Open / mainstream reader typefaces for zh · en · ja. */

export type ReaderFontId =
  | "songti"
  | "heiti"
  | "kaiti"
  | "fangsong"
  | "literata"
  | "garamond"
  | "gentium"
  | "sourceSerif"
  | "notoSerifJp"
  | "shippori"
  | "notoSansJp";

export type ReaderFontGroup = "zh" | "en" | "ja";

export type ReaderFontOption = {
  id: ReaderFontId;
  group: ReaderFontGroup;
  /** i18n key under reader.font.* */
  labelKey: string;
  stack: string;
};

export const READER_FONTS: ReaderFontOption[] = [
  {
    id: "songti",
    group: "zh",
    labelKey: "reader.font.songti",
    stack: '"Noto Serif SC", "Songti SC", SimSun, serif',
  },
  {
    id: "heiti",
    group: "zh",
    labelKey: "reader.font.heiti",
    stack: '"Noto Sans SC", "PingFang SC", "Heiti SC", sans-serif',
  },
  {
    id: "kaiti",
    group: "zh",
    labelKey: "reader.font.kaiti",
    stack: '"LXGW WenKai", "ZCOOL XiaoWei", KaiTi, "STKaiti", serif',
  },
  {
    id: "fangsong",
    group: "zh",
    labelKey: "reader.font.fangsong",
    stack: 'FangSong, STFangsong, "Noto Serif SC", serif',
  },
  {
    id: "literata",
    group: "en",
    labelKey: "reader.font.literata",
    stack: 'Literata, "Source Serif 4", Georgia, serif',
  },
  {
    id: "garamond",
    group: "en",
    labelKey: "reader.font.garamond",
    stack: '"EB Garamond", Garamond, Georgia, serif',
  },
  {
    id: "gentium",
    group: "en",
    labelKey: "reader.font.gentium",
    stack: '"Gentium Book Plus", Gentium, "Times New Roman", serif',
  },
  {
    id: "sourceSerif",
    group: "en",
    labelKey: "reader.font.sourceSerif",
    stack: '"Source Serif 4", "Times New Roman", serif',
  },
  {
    id: "notoSerifJp",
    group: "ja",
    labelKey: "reader.font.notoSerifJp",
    stack: '"Noto Serif JP", "Hiragino Mincho ProN", serif',
  },
  {
    id: "shippori",
    group: "ja",
    labelKey: "reader.font.shippori",
    stack: '"Shippori Mincho", "Noto Serif JP", serif',
  },
  {
    id: "notoSansJp",
    group: "ja",
    labelKey: "reader.font.notoSansJp",
    stack: '"Noto Sans JP", "Hiragino Sans", sans-serif',
  },
];

/** Word-like point sizes shown in the settings UI. */
export const READER_FONT_SIZES_PT = [12, 14, 16, 18, 20, 22, 24, 28] as const;
export type ReaderFontSizePt = (typeof READER_FONT_SIZES_PT)[number];

const FONT_STORAGE_LEGACY = "lh.reader.fontId";
const FONT_STORAGE_BY_LANG = "lh.reader.fontByLang";
const SIZE_STORAGE = "lh.reader.fontSizePt";
const LINE_HEIGHT_STORAGE = "lh.reader.lineHeight";

/** Tighter default — previous 2.18 felt too airy on mobile. */
export const DEFAULT_LINE_HEIGHT = 1.85;

const DEFAULT_FONT_BY_LANG: Record<ReaderFontGroup, ReaderFontId> = {
  zh: "songti",
  en: "literata",
  ja: "notoSerifJp",
};

export type FontByLang = Record<ReaderFontGroup, ReaderFontId>;

function isFontId(raw: string | null | undefined): raw is ReaderFontId {
  return Boolean(raw && READER_FONTS.some((f) => f.id === raw));
}

export function loadFontByLang(): FontByLang {
  const out: FontByLang = { ...DEFAULT_FONT_BY_LANG };
  try {
    const raw = localStorage.getItem(FONT_STORAGE_BY_LANG);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Record<ReaderFontGroup, string>>;
      for (const group of ["zh", "en", "ja"] as const) {
        const id = parsed[group];
        if (isFontId(id) && READER_FONTS.find((f) => f.id === id)?.group === group) {
          out[group] = id;
        }
      }
      return out;
    }
  } catch {
    /* ignore */
  }
  // Migrate legacy single font into its language group.
  const legacy = localStorage.getItem(FONT_STORAGE_LEGACY);
  if (isFontId(legacy)) {
    const group = READER_FONTS.find((f) => f.id === legacy)?.group;
    if (group) out[group] = legacy;
    saveFontByLang(out);
  }
  return out;
}

export function saveFontByLang(map: FontByLang) {
  localStorage.setItem(FONT_STORAGE_BY_LANG, JSON.stringify(map));
}

export function saveReaderFontForLang(group: ReaderFontGroup, id: ReaderFontId) {
  const map = loadFontByLang();
  map[group] = id;
  saveFontByLang(map);
}

/** @deprecated prefer loadFontByLang / font for active translation language */
export function loadReaderFontId(): ReaderFontId {
  return loadFontByLang().zh;
}

export function saveReaderFontId(id: ReaderFontId) {
  const group = READER_FONTS.find((f) => f.id === id)?.group ?? "zh";
  saveReaderFontForLang(group, id);
}

export function loadReaderFontSizePt(): ReaderFontSizePt {
  const n = Number(localStorage.getItem(SIZE_STORAGE));
  if (READER_FONT_SIZES_PT.includes(n as ReaderFontSizePt)) return n as ReaderFontSizePt;
  return 16;
}

export function saveReaderFontSizePt(pt: ReaderFontSizePt) {
  localStorage.setItem(SIZE_STORAGE, String(pt));
}

export function loadReaderLineHeight(): number {
  const n = Number(localStorage.getItem(LINE_HEIGHT_STORAGE));
  if (Number.isFinite(n) && n >= 1.4 && n <= 2.8) return n;
  return DEFAULT_LINE_HEIGHT;
}

export function saveReaderLineHeight(lh: number) {
  localStorage.setItem(LINE_HEIGHT_STORAGE, String(lh));
}

/** Map Word-like pt to rem (12pt ≈ 1rem). */
export function fontSizePtToRem(pt: number): number {
  return +(pt / 12).toFixed(4);
}

export function fontStackFor(id: ReaderFontId): string {
  return READER_FONTS.find((f) => f.id === id)?.stack ?? READER_FONTS[0]!.stack;
}

export function fontsByGroup(group: ReaderFontGroup): ReaderFontOption[] {
  return READER_FONTS.filter((f) => f.group === group);
}

export function fontGroupForLanguage(language: string | undefined): ReaderFontGroup {
  if (language === "en" || language === "ja" || language === "zh") return language;
  return "zh";
}
