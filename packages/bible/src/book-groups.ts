import { BOOK_LIST, type BibleBook } from "./books.js";

/** Canonical groupings for picker UX (OT/NT + literary type). */
export type BookGroupId =
  | "law"
  | "historyOt"
  | "poetry"
  | "majorProphets"
  | "minorProphets"
  | "gospels"
  | "historyNt"
  | "pauline"
  | "generalEpistles"
  | "apocalypse";

export type BookGroupMeta = {
  id: BookGroupId;
  testament: "ot" | "nt";
  name: Record<"zh" | "en" | "ja", string>;
};

export const BOOK_GROUPS: BookGroupMeta[] = [
  {
    id: "law",
    testament: "ot",
    name: { zh: "摩西五经", en: "Law", ja: "律法" },
  },
  {
    id: "historyOt",
    testament: "ot",
    name: { zh: "历史书", en: "History", ja: "歴史書" },
  },
  {
    id: "poetry",
    testament: "ot",
    name: { zh: "诗歌智慧", en: "Poetry & Wisdom", ja: "詩歌・知恵" },
  },
  {
    id: "majorProphets",
    testament: "ot",
    name: { zh: "大先知书", en: "Major Prophets", ja: "大預言書" },
  },
  {
    id: "minorProphets",
    testament: "ot",
    name: { zh: "小先知书", en: "Minor Prophets", ja: "小預言書" },
  },
  {
    id: "gospels",
    testament: "nt",
    name: { zh: "福音书", en: "Gospels", ja: "福音書" },
  },
  {
    id: "historyNt",
    testament: "nt",
    name: { zh: "使徒行传", en: "Acts", ja: "使徒行伝" },
  },
  {
    id: "pauline",
    testament: "nt",
    name: { zh: "保罗书信", en: "Pauline Letters", ja: "パウロ書簡" },
  },
  {
    id: "generalEpistles",
    testament: "nt",
    name: { zh: "普通书信", en: "General Letters", ja: "公同書簡" },
  },
  {
    id: "apocalypse",
    testament: "nt",
    name: { zh: "启示文学", en: "Apocalypse", ja: "黙示" },
  },
];

const GROUP_BY_BOOK: Record<string, BookGroupId> = {
  Gen: "law",
  Exod: "law",
  Lev: "law",
  Num: "law",
  Deut: "law",
  Josh: "historyOt",
  Judg: "historyOt",
  Ruth: "historyOt",
  "1Sam": "historyOt",
  "2Sam": "historyOt",
  "1Kgs": "historyOt",
  "2Kgs": "historyOt",
  "1Chr": "historyOt",
  "2Chr": "historyOt",
  Ezra: "historyOt",
  Neh: "historyOt",
  Esth: "historyOt",
  Job: "poetry",
  Ps: "poetry",
  Prov: "poetry",
  Eccl: "poetry",
  Song: "poetry",
  Isa: "majorProphets",
  Jer: "majorProphets",
  Lam: "majorProphets",
  Ezek: "majorProphets",
  Dan: "majorProphets",
  Hos: "minorProphets",
  Joel: "minorProphets",
  Amos: "minorProphets",
  Obad: "minorProphets",
  Jonah: "minorProphets",
  Mic: "minorProphets",
  Nah: "minorProphets",
  Hab: "minorProphets",
  Zeph: "minorProphets",
  Hag: "minorProphets",
  Zech: "minorProphets",
  Mal: "minorProphets",
  Matt: "gospels",
  Mark: "gospels",
  Luke: "gospels",
  John: "gospels",
  Acts: "historyNt",
  Rom: "pauline",
  "1Cor": "pauline",
  "2Cor": "pauline",
  Gal: "pauline",
  Eph: "pauline",
  Phil: "pauline",
  Col: "pauline",
  "1Thess": "pauline",
  "2Thess": "pauline",
  "1Tim": "pauline",
  "2Tim": "pauline",
  Titus: "pauline",
  Phlm: "pauline",
  Heb: "generalEpistles",
  Jas: "generalEpistles",
  "1Pet": "generalEpistles",
  "2Pet": "generalEpistles",
  "1John": "generalEpistles",
  "2John": "generalEpistles",
  "3John": "generalEpistles",
  Jude: "generalEpistles",
  Rev: "apocalypse",
};

export function bookGroupId(bookId: string): BookGroupId {
  return GROUP_BY_BOOK[bookId] ?? (BOOK_LIST.find((b) => b.id === bookId)?.testament === "nt"
    ? "generalEpistles"
    : "historyOt");
}

export function getBookGroup(bookId: string): BookGroupMeta {
  const id = bookGroupId(bookId);
  return BOOK_GROUPS.find((g) => g.id === id) ?? BOOK_GROUPS[0]!;
}

export type GroupedBooks = { group: BookGroupMeta; books: BibleBook[] };

export function listBooksGrouped(filter?: { testament?: "ot" | "nt" }): GroupedBooks[] {
  const groups = filter?.testament
    ? BOOK_GROUPS.filter((g) => g.testament === filter.testament)
    : BOOK_GROUPS;
  return groups
    .map((group) => ({
      group,
      books: BOOK_LIST.filter(
        (b) =>
          bookGroupId(b.id) === group.id &&
          (!filter?.testament || b.testament === filter.testament),
      ),
    }))
    .filter((row) => row.books.length > 0);
}
