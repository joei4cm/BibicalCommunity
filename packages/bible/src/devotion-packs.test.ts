import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LOCAL_DEVOTION_PACKS,
  buildDevotionPackManifestJson,
  getDevotionPack,
  listDevotionPacks,
  parseDevotionPackManifest,
  probeDevotionPackPipeline,
  r2DevotionPackObjectKey,
} from "./devotion-packs.js";

test("local devotion packs mirror CC0 materials (≥5)", () => {
  assert.ok(LOCAL_DEVOTION_PACKS.length >= 5);
  for (const p of LOCAL_DEVOTION_PACKS) {
    assert.equal(p.provider, "local");
    assert.equal(p.available, true);
    assert.ok(p.body.en.trim());
  }
});

test("availableOnly excludes licensed stubs", () => {
  const avail = listDevotionPacks({ availableOnly: true });
  assert.ok(!avail.some((p) => p.id === "publisher-devotion-sample"));
});

test("r2 key + JSON roundtrip", () => {
  assert.equal(
    r2DevotionPackObjectKey("publisher-devotion-sample"),
    "devotion-packs/publisher-devotion-sample/manifest.json",
  );
  const morning = getDevotionPack("morning-examen");
  assert.ok(morning);
  const again = parseDevotionPackManifest(buildDevotionPackManifestJson(morning));
  assert.equal(again.id, "morning-examen");
  assert.equal(again.title.en, morning.title.en);
});

test("probeDevotionPackPipeline ok", () => {
  const probe = probeDevotionPackPipeline();
  assert.equal(probe.ok, true);
  assert.ok(probe.localCount >= 5);
  assert.ok(probe.licensedStubCount >= 1);
});
