import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FIRST_PARTY_THEME_PACKS,
  buildThemePackManifestJson,
  getThemePack,
  listThemePacks,
  parseThemePackManifest,
  probeThemePackPipeline,
  r2ThemePackObjectKey,
} from "./theme-packs.js";

test("first-party theme packs cover default/parchment/paper/ink", () => {
  const ids = FIRST_PARTY_THEME_PACKS.map((p) => p.id).sort();
  assert.deepEqual(ids, ["default", "ink", "paper", "parchment"]);
  for (const p of FIRST_PARTY_THEME_PACKS) {
    assert.equal(p.provider, "local");
    assert.equal(p.available, true);
    assert.ok(p.cssVariables.readerBg.startsWith("#"));
  }
});

test("listThemePacks availableOnly excludes licensed stubs", () => {
  const avail = listThemePacks({ availableOnly: true });
  assert.ok(avail.every((p) => p.available));
  assert.ok(!avail.some((p) => p.id === "publisher-sample"));
});

test("r2 key + roundtrip JSON manifest", () => {
  assert.equal(r2ThemePackObjectKey("publisher-sample"), "theme-packs/publisher-sample/manifest.json");
  const parchment = getThemePack("parchment");
  assert.ok(parchment);
  const raw = buildThemePackManifestJson(parchment);
  const again = parseThemePackManifest(raw);
  assert.equal(again.id, "parchment");
  assert.equal(again.cssVariables.verseNum, parchment.cssVariables.verseNum);
});

test("probeThemePackPipeline reports ready first-party path", () => {
  const probe = probeThemePackPipeline();
  assert.equal(probe.ok, true);
  assert.ok(probe.firstPartyCount >= 4);
  assert.ok(probe.licensedStubCount >= 1);
});
