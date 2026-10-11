import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BOOT_DEFAULT_TRANSLATION_IDS,
  LocalCorpusDb,
  MemoryLocalCorpusStore,
  buildDemoDownloadPack,
  buildDownloadPackPayloadJson,
  listDownloadableCorpusCatalog,
  listProtestantChapterRefs,
  parseDownloadPackPayload,
  probeLocalCorpusPipeline,
} from "./local-corpus-db.js";
import { adjacentChapter, bookIdFromSlug, bookSlug } from "./books.js";

test("boot catalog is 和合本 whole-Bible; downloads are complete PD only", () => {
  const catalog = listDownloadableCorpusCatalog();
  const boot = catalog.filter((p) => p.installMode === "boot");
  assert.equal(boot.length, 1);
  assert.deepEqual(
    boot.map((b) => b.translationId),
    ["cuvs"],
  );
  const whole = listProtestantChapterRefs();
  for (const b of boot) {
    assert.equal(b.packKind, "whole-bible", b.translationId);
    assert.equal(b.fullPackAvailable, true, b.translationId);
    assert.equal(b.fullPackChapterCount, whole.length, b.translationId);
    assert.equal(b.chapterRefs.length, whole.length, b.translationId);
  }
  assert.ok(!catalog.some((p) => p.translationId === "esv" || p.translationId === "nasb"));
  const downloadable = catalog.filter((p) => p.installMode === "download");
  assert.deepEqual(
    downloadable.map((p) => p.translationId).sort(),
    ["asv", "kjv", "web"],
  );
  assert.ok(downloadable.every((p) => p.packKind === "whole-bible" && p.fullPackAvailable));
});

test("WeDevote-style book slug + adjacent chapter", () => {
  assert.equal(bookSlug("Gal"), "gal");
  assert.equal(bookIdFromSlug("gal"), "Gal");
  assert.equal(bookIdFromSlug("1cor"), "1Cor");
  assert.deepEqual(adjacentChapter("Gal", 6, 1), { bookId: "Eph", chapter: 1 });
  assert.deepEqual(adjacentChapter("Gal", 6, -1), { bookId: "Gal", chapter: 5 });
  assert.deepEqual(adjacentChapter("Gen", 1, -1), null);
  assert.deepEqual(adjacentChapter("Rev", 22, 1), null);
});

test("install download pack into local DB then read chapter", async () => {
  const db = new LocalCorpusDb(new MemoryLocalCorpusStore());
  const pack = buildDemoDownloadPack("rcuv");
  const raw = buildDownloadPackPayloadJson(pack);
  const again = parseDownloadPackPayload(raw);
  assert.equal(again.translationId, "rcuv");
  assert.equal(again.chapters.length, listProtestantChapterRefs().length);
  assert.ok(again.chapters.some((c) => c.book === "Gen" && c.chapter === 1));

  const result = await db.installPack("rcuv", again.chapters);
  assert.equal(result.installed, again.chapters.length);

  const ch = await db.getChapter("rcuv", "John", 1);
  assert.ok(ch);
  assert.equal(ch.book, "John");
  assert.ok(ch.verses.length >= 1);

  const installed = await db.listInstalled();
  assert.equal(installed.length, 1);
  assert.equal(installed[0]?.translationId, "rcuv");
  assert.ok(installed[0]!.chapterRefs.includes("John.1"));

  await db.removeTranslation("rcuv");
  assert.equal((await db.listInstalled()).length, 0);
  assert.equal(await db.getChapter("rcuv", "John", 1), null);
});

test("probeLocalCorpusPipeline boots cuvs without full TS corpora", async () => {
  const probe = await probeLocalCorpusPipeline();
  assert.equal(probe.ok, true);
  assert.deepEqual(probe.bootDefaults, ["cuvs"]);
  assert.ok(probe.downloadableCount >= 3);
  assert.ok(probe.installedAfterBoot >= 1);
  assert.match(probe.sampleR2Key, /^bible\/cuvs\/John\.1\.json$/);
});
