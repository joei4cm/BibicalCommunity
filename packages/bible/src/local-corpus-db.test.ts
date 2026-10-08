import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BOOT_DEFAULT_TRANSLATION_IDS,
  BOOT_TEACHING_CHAPTER_REFS,
  LocalCorpusDb,
  MemoryLocalCorpusStore,
  buildDemoDownloadPack,
  buildDownloadPackPayloadJson,
  listDownloadableCorpusCatalog,
  parseDownloadPackPayload,
  probeLocalCorpusPipeline,
} from "./local-corpus-db.js";

test("boot catalog is slim: cuvs + web + shinKyoudou; ESV is external", () => {
  const catalog = listDownloadableCorpusCatalog();
  const boot = catalog.filter((p) => p.installMode === "boot");
  assert.equal(boot.length, 3);
  assert.deepEqual(
    boot.map((b) => b.translationId).sort(),
    [...BOOT_DEFAULT_TRANSLATION_IDS].sort(),
  );
  for (const b of boot) {
    assert.deepEqual(b.chapterRefs, [...BOOT_TEACHING_CHAPTER_REFS], b.translationId);
  }
  const esv = catalog.find((p) => p.translationId === "esv");
  assert.ok(esv);
  assert.equal(esv.installMode, "external");
  const downloadable = catalog.filter((p) => p.installMode === "download");
  assert.ok(downloadable.length >= 5);
  assert.ok(downloadable.some((p) => p.translationId === "cuvt"));
  assert.ok(downloadable.some((p) => p.translationId === "kougo"));
  for (const tid of ["kjv", "asv", "cuvt", "kougo"]) {
    const row = downloadable.find((p) => p.translationId === tid);
    assert.ok(row, tid);
    assert.deepEqual(row.chapterRefs, [...BOOT_TEACHING_CHAPTER_REFS], tid);
  }
});

test("install download pack into local DB then read chapter", async () => {
  const db = new LocalCorpusDb(new MemoryLocalCorpusStore());
  const pack = buildDemoDownloadPack("rcuv");
  const raw = buildDownloadPackPayloadJson(pack);
  const again = parseDownloadPackPayload(raw);
  assert.equal(again.translationId, "rcuv");
  assert.ok(again.chapters.length >= 3);

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

test("probeLocalCorpusPipeline boots defaults without full TS corpora", async () => {
  const probe = await probeLocalCorpusPipeline();
  assert.equal(probe.ok, true);
  assert.deepEqual(probe.bootDefaults, [...BOOT_DEFAULT_TRANSLATION_IDS]);
  assert.ok(probe.downloadableCount >= 5);
  assert.ok(probe.externalCount >= 3);
  assert.ok(probe.installedAfterBoot >= 9);
  assert.match(probe.sampleR2Key, /^bible\/cuvs\/John\.1\.json$/);
});
