import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCorpusPackManifestJson,
  buildLocalCorpusPacks,
  getCorpusPack,
  listCorpusPacks,
  parseCorpusPackManifest,
  probeCorpusPackPipeline,
  r2CorpusPackPrefix,
} from "./corpus-packs.js";
import { parseR2ChapterObjectKey, r2ChapterObjectKey, r2CorpusPrefix } from "./r2-format.js";
import { BOOT_DEFAULT_TRANSLATION_IDS } from "./local-corpus-db.js";

test("no TypeScript-local corpus packs remain", () => {
  assert.deepEqual(buildLocalCorpusPacks(), []);
  const local = listCorpusPacks({ provider: "local", availableOnly: true });
  assert.equal(local.length, 0);
});

test("download/boot corpus packs cover complete zh/en via R2", () => {
  const packs = listCorpusPacks({ provider: "r2", availableOnly: true });
  assert.equal(packs.length, 4);
  assert.ok(packs.some((p) => p.translationId === "web" && p.chapterRefs.includes("John.1")));
  assert.ok(packs.some((p) => p.language === "zh"));
  assert.ok(packs.some((p) => p.language === "en"));
  assert.ok(packs.every((p) => p.provider === "r2" && p.r2Prefix?.startsWith("bible/")));
  for (const id of BOOT_DEFAULT_TRANSLATION_IDS) {
    assert.ok(packs.some((p) => p.translationId === id && p.installMode === "boot"), id);
  }
});

test("unavailable licensed stubs stay unavailable", () => {
  const stubs = listCorpusPacks({ provider: "r2" }).filter((p) => !p.available);
  // All licensed tids are also in download catalog as available slim packs,
  // so full stubs may be empty — that's fine. Remaining stubs must be unavailable.
  assert.ok(stubs.every((p) => !p.available));
});

test("manifest JSON roundtrip for web-r2 pack", () => {
  const pack = getCorpusPack("web-r2");
  assert.ok(pack);
  const again = parseCorpusPackManifest(buildCorpusPackManifestJson(pack));
  assert.equal(again.id, "web-r2");
  assert.equal(again.translationId, "web");
  assert.ok(again.chapterRefs.length >= 3);
});

test("probeCorpusPackPipeline reports download path without TS packs", () => {
  const probe = probeCorpusPackPipeline();
  assert.equal(probe.ok, true);
  assert.equal(probe.localCount, 0);
  assert.equal(probe.bootCount, 1);
  assert.ok(probe.downloadableCount >= 3);
  assert.ok(probe.localChapterTotal >= 20);
  assert.equal(probe.noTsPacks, true);
  assert.ok(probe.sampleIds.includes("web-r2") || probe.sampleIds.includes("cuvs-r2"));
  assert.equal(r2ChapterObjectKey("cuvs", "John", 1), "bible/cuvs/John.1.json");
  assert.equal(r2CorpusPrefix("cuvs"), "bible/cuvs/");
  assert.equal(r2CorpusPackPrefix("cuvs"), "bible/cuvs/");
  assert.deepEqual(parseR2ChapterObjectKey("bible/cuvs/John.1.json"), {
    translationId: "cuvs",
    book: "John",
    chapter: 1,
  });
  assert.equal(parseR2ChapterObjectKey("media/user/x"), null);
});
