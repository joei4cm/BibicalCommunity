import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fixtureInventoryToDownloadPack,
  importFixturesIntoLocalDb,
  inventoryFromChapterMap,
  parseCorpusFixtureChapter,
  probeCorpusJsonImport,
} from "./corpus-import.js";
import { LocalCorpusDb, MemoryLocalCorpusStore } from "./local-corpus-db.js";

const CUVS_JOHN1 = {
  book: "John",
  chapter: 1,
  verses: [
    { verse: 1, text: "（样例·fixture）太初有道，道与神同在，道就是神。" },
    { verse: 14, text: "（样例·fixture）道成了肉身。" },
  ],
};

test("parseCorpusFixtureChapter validates R2 shape", () => {
  const ch = parseCorpusFixtureChapter(JSON.stringify(CUVS_JOHN1));
  assert.equal(ch.book, "John");
  assert.equal(ch.chapter, 1);
  assert.equal(ch.verses.length, 2);
});

test("importFixturesIntoLocalDb installs JSON inventory", async () => {
  const inv = inventoryFromChapterMap("cuvs", [
    CUVS_JOHN1,
    {
      book: "Ps",
      chapter: 23,
      verses: [{ verse: 1, text: "（样例·fixture）耶和华是我的牧者。" }],
    },
  ]);
  assert.equal(inv.chapters.length, 2);
  assert.equal(inv.chapters[0]?.r2Key, "bible/cuvs/John.1.json");

  const store = new MemoryLocalCorpusStore();
  const result = await importFixturesIntoLocalDb(inv, store);
  assert.equal(result.installed, 2);

  const db = new LocalCorpusDb(store);
  const ch = await db.getChapter("cuvs", "John", 1);
  assert.ok(ch?.verses[0]?.text.includes("fixture"));

  const pack = fixtureInventoryToDownloadPack(inv);
  assert.equal(pack.translationId, "cuvs");
  assert.equal(pack.chapters.length, 2);
});

test("probeCorpusJsonImport proves multi-tid JSON path", async () => {
  const probe = await probeCorpusJsonImport({
    cuvs: [
      CUVS_JOHN1,
      {
        book: "John",
        chapter: 3,
        verses: [{ verse: 16, text: "（样例·fixture）神爱世人。" }],
      },
      {
        book: "Ps",
        chapter: 23,
        verses: [{ verse: 1, text: "（样例·fixture）牧者。" }],
      },
    ],
    web: [
      {
        book: "John",
        chapter: 1,
        verses: [{ verse: 1, text: "In the beginning (fixture)" }],
      },
      {
        book: "John",
        chapter: 3,
        verses: [{ verse: 16, text: "For God so loved (fixture)" }],
      },
      {
        book: "Ps",
        chapter: 23,
        verses: [{ verse: 1, text: "shepherd (fixture)" }],
      },
    ],
    shinKyoudou: [
      {
        book: "John",
        chapter: 1,
        verses: [{ verse: 1, text: "初めに言があった (fixture)" }],
      },
    ],
  });
  assert.equal(probe.ok, true);
  assert.ok(probe.totalChapters >= 7);
  assert.ok(probe.sampleKeys.some((k) => k.includes("bible/cuvs/")));
});
