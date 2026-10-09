import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bookIdFromNumber,
  bookNumberFromId,
  chunkForTranslation,
  crossRefsForVerse,
  defaultStudyCommentaryId,
  entriesForVerse,
  lookupEaston,
  lookupStrongs,
  normalizeStrongsId,
  searchEaston,
  searchStrongs,
  STUDY_COMMENTARIES,
  strongsForVerse,
  STRONGS_SEED,
  verseStrongsKey,
  type CommentaryChapter,
  type EastonDictionary,
} from "./study-tools.js";

test("bookNumberFromId maps Protestant canon to getBible 1–66", () => {
  assert.equal(bookNumberFromId("Gen"), 1);
  assert.equal(bookNumberFromId("John"), 43);
  assert.equal(bookNumberFromId("Rev"), 66);
  assert.equal(bookIdFromNumber(43), "John");
});

test("defaultStudyCommentaryId prefers Chinese Matthew Henry for zh", () => {
  assert.equal(defaultStudyCommentaryId("zh"), "mhcc-zh");
  assert.equal(defaultStudyCommentaryId("zh-CN"), "mhcc-zh");
  assert.equal(defaultStudyCommentaryId("en"), "mhcc");
});

test("chunkForTranslation keeps pieces under limit", () => {
  const long = "Hello world. ".repeat(60);
  const chunks = chunkForTranslation(long, 80);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((c) => c.length <= 80));
});

test("normalizeStrongsId accepts G/H prefixes and bare numbers", () => {
  assert.equal(normalizeStrongsId("g26"), "G26");
  assert.equal(normalizeStrongsId("H03068"), "H3068");
  assert.equal(normalizeStrongsId("26", "greek"), "G26");
});

test("lookupStrongs + searchStrongs use seed dictionary", () => {
  const hit = lookupStrongs("G26", STRONGS_SEED);
  assert.ok(hit);
  assert.match(hit!.entry.lemma, /ἀγάπη/);
  const love = searchStrongs("love", STRONGS_SEED, 5);
  assert.ok(love.some((x) => x.id === "G26" || x.id === "G25"));
});

test("entriesForVerse prefers exact then prior then chapter-level", () => {
  const chapter: CommentaryChapter = {
    commentary: "mhcc",
    book: 43,
    chapter: 14,
    entries: [
      { book: 43, chapter: 14, verse: 0, text: "chapter overview" },
      { book: 43, chapter: 14, verse: 1, text: "v1 note" },
      { book: 43, chapter: 14, verse: 6, text: "v6 note" },
    ],
  };
  assert.equal(entriesForVerse(chapter, 6)[0]?.text, "v6 note");
  assert.equal(entriesForVerse(chapter, 3)[0]?.text, "v1 note");
});

test("crossRefsForVerse flattens TSK structured references", () => {
  const chapter: CommentaryChapter = {
    commentary: "tsk",
    book: 43,
    chapter: 14,
    entries: [
      {
        book: 43,
        chapter: 14,
        verse: 6,
        text: "the way.\n10:9; Isa 35:8",
        references: [
          { ref: "John 10:9", osis: "John.10.9", book: 43, chapter: 10, verse: 9 },
          { ref: "Isaiah 35:8", osis: "Isa.35.8", book: 23, chapter: 35, verse: 8 },
        ],
      },
    ],
  };
  const hits = crossRefsForVerse(chapter, 6);
  assert.equal(hits.length, 2);
  assert.equal(hits[0]?.bookId, "John");
  assert.equal(hits[1]?.bookId, "Isa");
  assert.equal(verseStrongsKey("John", 14, 6), "John.14.6");
});

test("STUDY_COMMENTARIES includes Clarke, JFB, Barnes, and Wesley", () => {
  const ids = STUDY_COMMENTARIES.map((c) => c.id);
  assert.ok(ids.includes("clarke"));
  assert.ok(ids.includes("jfb"));
  assert.ok(ids.includes("barnes"));
  assert.ok(ids.includes("wesley"));
  assert.ok(ids.includes("mhcc-zh"));
});

test("strongsForVerse reads OT and NT map keys", () => {
  const map = {
    "Gen.1.1": ["H7225", "H430"],
    "John.14.6": ["G3598", "G225"],
  };
  assert.deepEqual(strongsForVerse(map, "Gen", 1, 1), ["H7225", "H430"]);
  assert.deepEqual(strongsForVerse(map, "John", 14, 6), ["G3598", "G225"]);
  assert.deepEqual(strongsForVerse(map, "Ps", 23, 1), []);
});

test("lookupEaston + searchEaston match headword and body", () => {
  const dict: EastonDictionary = {
    Shepherd: ["One who tends sheep; Christ is the good shepherd."],
    Aaron: ["The brother of Moses; first high priest."],
  };
  const hit = lookupEaston("shepherd", dict);
  assert.ok(hit);
  assert.equal(hit!.headword, "Shepherd");
  const body = searchEaston("high priest", dict, 5);
  assert.ok(body.some((x) => x.headword === "Aaron"));
  const prefix = searchEaston("shep", dict, 5);
  assert.ok(prefix.some((x) => x.headword === "Shepherd"));
});
