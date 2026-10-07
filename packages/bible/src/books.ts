export interface BibleBook {
  /** OSIS book id, e.g. "John", "1Cor" */
  id: string;
  name: Record<"zh" | "en" | "ja", string>;
  chapters: number;
  testament: "ot" | "nt";
}

/** Protestant canon (66 books) with OSIS ids and zh/en/ja display names. */
export const BOOK_LIST: BibleBook[] = [
  { id: "Gen", name: { zh: "创世记", en: "Genesis", ja: "創世記" }, chapters: 50, testament: "ot" },
  { id: "Exod", name: { zh: "出埃及记", en: "Exodus", ja: "出エジプト記" }, chapters: 40, testament: "ot" },
  { id: "Lev", name: { zh: "利未记", en: "Leviticus", ja: "レビ記" }, chapters: 27, testament: "ot" },
  { id: "Num", name: { zh: "民数记", en: "Numbers", ja: "民数記" }, chapters: 36, testament: "ot" },
  { id: "Deut", name: { zh: "申命记", en: "Deuteronomy", ja: "申命記" }, chapters: 34, testament: "ot" },
  { id: "Josh", name: { zh: "约书亚记", en: "Joshua", ja: "ヨシュア記" }, chapters: 24, testament: "ot" },
  { id: "Judg", name: { zh: "士师记", en: "Judges", ja: "士師記" }, chapters: 21, testament: "ot" },
  { id: "Ruth", name: { zh: "路得记", en: "Ruth", ja: "ルツ記" }, chapters: 4, testament: "ot" },
  { id: "1Sam", name: { zh: "撒母耳记上", en: "1 Samuel", ja: "サムエル記上" }, chapters: 31, testament: "ot" },
  { id: "2Sam", name: { zh: "撒母耳记下", en: "2 Samuel", ja: "サムエル記下" }, chapters: 24, testament: "ot" },
  { id: "1Kgs", name: { zh: "列王纪上", en: "1 Kings", ja: "列王記上" }, chapters: 22, testament: "ot" },
  { id: "2Kgs", name: { zh: "列王纪下", en: "2 Kings", ja: "列王記下" }, chapters: 25, testament: "ot" },
  { id: "1Chr", name: { zh: "历代志上", en: "1 Chronicles", ja: "歴代誌上" }, chapters: 29, testament: "ot" },
  { id: "2Chr", name: { zh: "历代志下", en: "2 Chronicles", ja: "歴代誌下" }, chapters: 36, testament: "ot" },
  { id: "Ezra", name: { zh: "以斯拉记", en: "Ezra", ja: "エズラ記" }, chapters: 10, testament: "ot" },
  { id: "Neh", name: { zh: "尼希米记", en: "Nehemiah", ja: "ネヘミヤ記" }, chapters: 13, testament: "ot" },
  { id: "Esth", name: { zh: "以斯帖记", en: "Esther", ja: "エステル記" }, chapters: 10, testament: "ot" },
  { id: "Job", name: { zh: "约伯记", en: "Job", ja: "ヨブ記" }, chapters: 42, testament: "ot" },
  { id: "Ps", name: { zh: "诗篇", en: "Psalms", ja: "詩篇" }, chapters: 150, testament: "ot" },
  { id: "Prov", name: { zh: "箴言", en: "Proverbs", ja: "箴言" }, chapters: 31, testament: "ot" },
  { id: "Eccl", name: { zh: "传道书", en: "Ecclesiastes", ja: "伝道の書" }, chapters: 12, testament: "ot" },
  { id: "Song", name: { zh: "雅歌", en: "Song of Songs", ja: "雅歌" }, chapters: 8, testament: "ot" },
  { id: "Isa", name: { zh: "以赛亚书", en: "Isaiah", ja: "イザヤ書" }, chapters: 66, testament: "ot" },
  { id: "Jer", name: { zh: "耶利米书", en: "Jeremiah", ja: "エレミヤ書" }, chapters: 52, testament: "ot" },
  { id: "Lam", name: { zh: "耶利米哀歌", en: "Lamentations", ja: "哀歌" }, chapters: 5, testament: "ot" },
  { id: "Ezek", name: { zh: "以西结书", en: "Ezekiel", ja: "エゼキエル書" }, chapters: 48, testament: "ot" },
  { id: "Dan", name: { zh: "但以理书", en: "Daniel", ja: "ダニエル書" }, chapters: 12, testament: "ot" },
  { id: "Hos", name: { zh: "何西阿书", en: "Hosea", ja: "ホセア書" }, chapters: 14, testament: "ot" },
  { id: "Joel", name: { zh: "约珥书", en: "Joel", ja: "ヨエル書" }, chapters: 3, testament: "ot" },
  { id: "Amos", name: { zh: "阿摩司书", en: "Amos", ja: "アモス書" }, chapters: 9, testament: "ot" },
  { id: "Obad", name: { zh: "俄巴底亚书", en: "Obadiah", ja: "オバデヤ書" }, chapters: 1, testament: "ot" },
  { id: "Jonah", name: { zh: "约拿书", en: "Jonah", ja: "ヨナ書" }, chapters: 4, testament: "ot" },
  { id: "Mic", name: { zh: "弥迦书", en: "Micah", ja: "ミカ書" }, chapters: 7, testament: "ot" },
  { id: "Nah", name: { zh: "那鸿书", en: "Nahum", ja: "ナホム書" }, chapters: 3, testament: "ot" },
  { id: "Hab", name: { zh: "哈巴谷书", en: "Habakkuk", ja: "ハバクク書" }, chapters: 3, testament: "ot" },
  { id: "Zeph", name: { zh: "西番雅书", en: "Zephaniah", ja: "ゼパニヤ書" }, chapters: 3, testament: "ot" },
  { id: "Hag", name: { zh: "哈该书", en: "Haggai", ja: "ハガイ書" }, chapters: 2, testament: "ot" },
  { id: "Zech", name: { zh: "撒迦利亚书", en: "Zechariah", ja: "ゼカリヤ書" }, chapters: 14, testament: "ot" },
  { id: "Mal", name: { zh: "玛拉基书", en: "Malachi", ja: "マラキ書" }, chapters: 4, testament: "ot" },
  { id: "Matt", name: { zh: "马太福音", en: "Matthew", ja: "マタイによる福音書" }, chapters: 28, testament: "nt" },
  { id: "Mark", name: { zh: "马可福音", en: "Mark", ja: "マルコによる福音書" }, chapters: 16, testament: "nt" },
  { id: "Luke", name: { zh: "路加福音", en: "Luke", ja: "ルカによる福音書" }, chapters: 24, testament: "nt" },
  { id: "John", name: { zh: "约翰福音", en: "John", ja: "ヨハネによる福音書" }, chapters: 21, testament: "nt" },
  { id: "Acts", name: { zh: "使徒行传", en: "Acts", ja: "使徒行伝" }, chapters: 28, testament: "nt" },
  { id: "Rom", name: { zh: "罗马书", en: "Romans", ja: "ローマ人への手紙" }, chapters: 16, testament: "nt" },
  { id: "1Cor", name: { zh: "哥林多前书", en: "1 Corinthians", ja: "コリント人への第一の手紙" }, chapters: 16, testament: "nt" },
  { id: "2Cor", name: { zh: "哥林多后书", en: "2 Corinthians", ja: "コリント人への第二の手紙" }, chapters: 13, testament: "nt" },
  { id: "Gal", name: { zh: "加拉太书", en: "Galatians", ja: "ガラテヤ人への手紙" }, chapters: 6, testament: "nt" },
  { id: "Eph", name: { zh: "以弗所书", en: "Ephesians", ja: "エペソ人への手紙" }, chapters: 6, testament: "nt" },
  { id: "Phil", name: { zh: "腓立比书", en: "Philippians", ja: "ピリピ人への手紙" }, chapters: 4, testament: "nt" },
  { id: "Col", name: { zh: "歌罗西书", en: "Colossians", ja: "コロサイ人への手紙" }, chapters: 4, testament: "nt" },
  { id: "1Thess", name: { zh: "帖撒罗尼迦前书", en: "1 Thessalonians", ja: "テサロニケ人への第一の手紙" }, chapters: 5, testament: "nt" },
  { id: "2Thess", name: { zh: "帖撒罗尼迦后书", en: "2 Thessalonians", ja: "テサロニケ人への第二の手紙" }, chapters: 3, testament: "nt" },
  { id: "1Tim", name: { zh: "提摩太前书", en: "1 Timothy", ja: "テモテへの第一の手紙" }, chapters: 6, testament: "nt" },
  { id: "2Tim", name: { zh: "提摩太后书", en: "2 Timothy", ja: "テモテへの第二の手紙" }, chapters: 4, testament: "nt" },
  { id: "Titus", name: { zh: "提多书", en: "Titus", ja: "テトスへの手紙" }, chapters: 3, testament: "nt" },
  { id: "Phlm", name: { zh: "腓利门书", en: "Philemon", ja: "ピレモンへの手紙" }, chapters: 1, testament: "nt" },
  { id: "Heb", name: { zh: "希伯来书", en: "Hebrews", ja: "ヘブル人への手紙" }, chapters: 13, testament: "nt" },
  { id: "Jas", name: { zh: "雅各书", en: "James", ja: "ヤコブの手紙" }, chapters: 5, testament: "nt" },
  { id: "1Pet", name: { zh: "彼得前书", en: "1 Peter", ja: "ペテロの第一の手紙" }, chapters: 5, testament: "nt" },
  { id: "2Pet", name: { zh: "彼得后书", en: "2 Peter", ja: "ペテロの第二の手紙" }, chapters: 3, testament: "nt" },
  { id: "1John", name: { zh: "约翰一书", en: "1 John", ja: "ヨハネの第一の手紙" }, chapters: 5, testament: "nt" },
  { id: "2John", name: { zh: "约翰二书", en: "2 John", ja: "ヨハネの第二の手紙" }, chapters: 1, testament: "nt" },
  { id: "3John", name: { zh: "约翰三书", en: "3 John", ja: "ヨハネの第三の手紙" }, chapters: 1, testament: "nt" },
  { id: "Jude", name: { zh: "犹大书", en: "Jude", ja: "ユダの手紙" }, chapters: 1, testament: "nt" },
  { id: "Rev", name: { zh: "启示录", en: "Revelation", ja: "ヨハネの黙示録" }, chapters: 22, testament: "nt" },
];

export function listBooks(filter?: { testament?: "ot" | "nt" }): BibleBook[] {
  if (!filter?.testament) return BOOK_LIST;
  return BOOK_LIST.filter((b) => b.testament === filter.testament);
}

export function getBook(id: string): BibleBook | undefined {
  return BOOK_LIST.find((b) => b.id === id);
}
