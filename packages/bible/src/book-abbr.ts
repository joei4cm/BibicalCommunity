import { getBook } from "./books.js";

/**
 * Short labels for dense book pickers (WeDevote-style zh; common en/ja short forms).
 */
const BOOK_ABBR: Record<string, Record<"zh" | "en" | "ja", string>> = {
  Gen: { zh: "创", en: "Gen", ja: "創" },
  Exod: { zh: "出", en: "Ex", ja: "出" },
  Lev: { zh: "利", en: "Lev", ja: "レビ" },
  Num: { zh: "民", en: "Num", ja: "民" },
  Deut: { zh: "申", en: "Deut", ja: "申" },
  Josh: { zh: "书", en: "Josh", ja: "ヨシュア" },
  Judg: { zh: "士", en: "Judg", ja: "士" },
  Ruth: { zh: "得", en: "Ruth", ja: "ルツ" },
  "1Sam": { zh: "撒上", en: "1Sa", ja: "サム上" },
  "2Sam": { zh: "撒下", en: "2Sa", ja: "サム下" },
  "1Kgs": { zh: "王上", en: "1Ki", ja: "列上" },
  "2Kgs": { zh: "王下", en: "2Ki", ja: "列下" },
  "1Chr": { zh: "代上", en: "1Ch", ja: "代上" },
  "2Chr": { zh: "代下", en: "2Ch", ja: "代下" },
  Ezra: { zh: "拉", en: "Ezr", ja: "エズ" },
  Neh: { zh: "尼", en: "Neh", ja: "ネヘ" },
  Esth: { zh: "斯", en: "Est", ja: "エス" },
  Job: { zh: "伯", en: "Job", ja: "ヨブ" },
  Ps: { zh: "诗", en: "Ps", ja: "詩" },
  Prov: { zh: "箴", en: "Pr", ja: "箴" },
  Eccl: { zh: "传", en: "Ecc", ja: "伝" },
  Song: { zh: "歌", en: "SS", ja: "雅" },
  Isa: { zh: "赛", en: "Isa", ja: "イザ" },
  Jer: { zh: "耶", en: "Jer", ja: "エレ" },
  Lam: { zh: "哀", en: "Lam", ja: "哀" },
  Ezek: { zh: "结", en: "Eze", ja: "エゼ" },
  Dan: { zh: "但", en: "Dan", ja: "ダニ" },
  Hos: { zh: "何", en: "Hos", ja: "ホセ" },
  Joel: { zh: "珥", en: "Joel", ja: "ヨエ" },
  Amos: { zh: "摩", en: "Am", ja: "アモ" },
  Obad: { zh: "俄", en: "Ob", ja: "オバ" },
  Jonah: { zh: "拿", en: "Jnh", ja: "ヨナ" },
  Mic: { zh: "弥", en: "Mic", ja: "ミカ" },
  Nah: { zh: "鸿", en: "Nah", ja: "ナホ" },
  Hab: { zh: "哈", en: "Hab", ja: "ハバ" },
  Zeph: { zh: "番", en: "Zep", ja: "ゼパ" },
  Hag: { zh: "该", en: "Hag", ja: "ハガ" },
  Zech: { zh: "亚", en: "Zec", ja: "ゼカ" },
  Mal: { zh: "玛", en: "Mal", ja: "マラ" },
  Matt: { zh: "太", en: "Mt", ja: "マタ" },
  Mark: { zh: "可", en: "Mk", ja: "マルコ" },
  Luke: { zh: "路", en: "Lk", ja: "ルカ" },
  John: { zh: "约", en: "Jn", ja: "ヨハ" },
  Acts: { zh: "徒", en: "Ac", ja: "使" },
  Rom: { zh: "罗", en: "Ro", ja: "ロマ" },
  "1Cor": { zh: "林前", en: "1Co", ja: "Ⅰコリ" },
  "2Cor": { zh: "林后", en: "2Co", ja: "Ⅱコリ" },
  Gal: { zh: "加", en: "Ga", ja: "ガラ" },
  Eph: { zh: "弗", en: "Eph", ja: "エペ" },
  Phil: { zh: "腓", en: "Php", ja: "ピリ" },
  Col: { zh: "西", en: "Col", ja: "コロ" },
  "1Thess": { zh: "帖前", en: "1Th", ja: "Ⅰテサ" },
  "2Thess": { zh: "帖后", en: "2Th", ja: "Ⅱテサ" },
  "1Tim": { zh: "提前", en: "1Ti", ja: "Ⅰテモ" },
  "2Tim": { zh: "提后", en: "2Ti", ja: "Ⅱテモ" },
  Titus: { zh: "多", en: "Tit", ja: "テト" },
  Phlm: { zh: "门", en: "Phm", ja: "ピレ" },
  Heb: { zh: "来", en: "Heb", ja: "ヘブ" },
  Jas: { zh: "雅", en: "Jas", ja: "ヤコ" },
  "1Pet": { zh: "彼前", en: "1Pe", ja: "Ⅰペテ" },
  "2Pet": { zh: "彼后", en: "2Pe", ja: "Ⅱペテ" },
  "1John": { zh: "约一", en: "1Jn", ja: "Ⅰヨハ" },
  "2John": { zh: "约二", en: "2Jn", ja: "Ⅱヨハ" },
  "3John": { zh: "约三", en: "3Jn", ja: "Ⅲヨハ" },
  Jude: { zh: "犹", en: "Jud", ja: "ユダ" },
  Rev: { zh: "启", en: "Rev", ja: "黙" },
};

export function bookAbbr(bookId: string, locale: "zh" | "en" | "ja" = "zh"): string {
  const hit = BOOK_ABBR[bookId]?.[locale];
  if (hit) return hit;
  const book = getBook(bookId);
  if (!book) return bookId;
  const full = book.name[locale];
  if (locale === "zh") return full.slice(0, 2);
  if (locale === "ja") return full.slice(0, 3);
  return book.id;
}
