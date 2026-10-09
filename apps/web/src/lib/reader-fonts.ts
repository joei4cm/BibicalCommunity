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

const FONT_STORAGE = "lh.reader.fontId";
const SIZE_STORAGE = "lh.reader.fontSizePt";

export function loadReaderFontId(): ReaderFontId {
  const raw = localStorage.getItem(FONT_STORAGE);
  if (READER_FONTS.some((f) => f.id === raw)) return raw as ReaderFontId;
  return "songti";
}

export function saveReaderFontId(id: ReaderFontId) {
  localStorage.setItem(FONT_STORAGE, id);
}

export function loadReaderFontSizePt(): ReaderFontSizePt {
  const n = Number(localStorage.getItem(SIZE_STORAGE));
  if (READER_FONT_SIZES_PT.includes(n as ReaderFontSizePt)) return n as ReaderFontSizePt;
  return 16;
}

export function saveReaderFontSizePt(pt: ReaderFontSizePt) {
  localStorage.setItem(SIZE_STORAGE, String(pt));
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
