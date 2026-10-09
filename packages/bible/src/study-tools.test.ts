import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bookIdFromNumber,
  bookNumberFromId,
  chunkForTranslation,
  crossRefsForVerse,
  defaultStudyCommentaryId,
  entriesForVerse,
  lookupStrongs,
  normalizeStrongsId,
  searchStrongs,
  STRONGS_SEED,
  verseStrongsKey,
  type CommentaryChapter,
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
