import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCorpusPackManifestJson,
  getCorpusPack,
  listCorpusPacks,
  parseCorpusPackManifest,
  probeCorpusPackPipeline,
  r2CorpusPackPrefix,
} from "./corpus-packs.js";
import { r2ChapterObjectKey } from "./r2-format.js";

test("local corpus packs cover zh/en/ja scaffold translations", () => {
  const local = listCorpusPacks({ provider: "local", availableOnly: true });
  assert.ok(local.length >= 5);
  assert.ok(local.some((p) => p.translationId === "web" && p.chapterRefs.includes("John.3")));
  assert.ok(local.some((p) => p.language === "zh"));
  assert.ok(local.some((p) => p.language === "ja"));
});

test("availableOnly excludes licensed R2 stubs", () => {
  const available = listCorpusPacks({ availableOnly: true });
  assert.ok(available.every((p) => p.available && p.provider === "local"));
  const licensed = listCorpusPacks({ provider: "r2" });
  assert.ok(licensed.length >= 5);
  assert.ok(licensed.every((p) => !p.available));
  assert.equal(licensed[0]?.r2Prefix, r2CorpusPackPrefix(licensed[0]!.translationId));
  assert.ok(licensed[0]?.sampleR2Keys[0]?.startsWith("bible/"));
});

test("manifest JSON roundtrip", () => {
  const pack = getCorpusPack("web-local");
  assert.ok(pack);
  const again = parseCorpusPackManifest(buildCorpusPackManifestJson(pack));
  assert.equal(again.id, "web-local");
  assert.equal(again.translationId, "web");
  assert.ok(again.chapterRefs.length >= 10);
});

test("probeCorpusPackPipeline reports ready local + licensed stub path", () => {
  const probe = probeCorpusPackPipeline();
  assert.equal(probe.ok, true);
  assert.ok(probe.localChapterTotal >= 100);
  assert.ok(probe.licensedStubCount >= 5);
  assert.equal(
    probe.sampleIds.includes("web-local") || listCorpusPacks({ provider: "local" }).some((p) => p.id === "web-local"),
    true,
  );
  assert.equal(r2ChapterObjectKey("cuvs", "John", 1), "bible/cuvs/John.1.json");
});
