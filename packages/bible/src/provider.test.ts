import { test } from "node:test";
import assert from "node:assert/strict";
import { loadChapter } from "./provider.js";
import { getTranslation } from "./translations.js";

test("loadChapter returns verses for web John.1", async () => {
  const result = await loadChapter("web", { book: "John", chapter: 1 });
  assert.ok(!("external" in result));
  assert.equal(result.source, "local");
  assert.equal(result.translationId, "web");
  assert.equal(result.chapter, 1);
  assert.ok(result.verses.length > 0);
  assert.equal(result.verses[0]?.verse, 1);
  assert.match(result.verses[0]?.text ?? "", /In the beginning was the Word/);
});

test("loadChapter returns verses for kjv John.1", async () => {
  const result = await loadChapter("kjv", { book: "John", chapter: 1 });
  assert.ok(!("external" in result));
  assert.equal(result.source, "local");
  assert.equal(result.translationId, "kjv");
  assert.equal(result.chapter, 1);
  assert.ok(result.verses.length > 0);
  assert.equal(result.verses[0]?.verse, 1);
  assert.match(result.verses[0]?.text ?? "", /In the beginning was the Word/);
  assert.match(result.verses.find((v) => v.verse === 5)?.text ?? "", /comprehended/);
});

test("loadChapter returns verses for asv John.1", async () => {
  const result = await loadChapter("asv", { book: "John", chapter: 1 });
  assert.ok(!("external" in result));
  assert.equal(result.source, "local");
  assert.ok(result.verses.length > 0);
  assert.match(result.verses.find((v) => v.verse === 5)?.text ?? "", /apprehended/);
});

test("loadChapter returns verses for web John.3 (chapter switch)", async () => {
  const result = await loadChapter("web", { book: "John", chapter: 3 });
  assert.ok(!("external" in result));
  assert.equal(result.chapter, 3);
  assert.ok(result.verses.length > 0);
  assert.match(result.verses.find((v) => v.verse === 16)?.text ?? "", /God so loved the world/);
});

test("loadChapter returns verses for kougoyaku-pd John.1", async () => {
  const result = await loadChapter("kougoyaku-pd", { book: "John", chapter: 1 });
  assert.ok(!("external" in result));
  assert.equal(result.source, "local");
  assert.ok(result.verses.length > 0);
  assert.match(result.verses[0]?.text ?? "", /太初に言あり/);
});

test("local PD translations are marked available", () => {
  for (const id of ["web", "kjv", "asv", "kougoyaku-pd"]) {
    const meta = getTranslation(id);
    assert.ok(meta, `missing translation ${id}`);
    assert.equal(meta.available, true);
    assert.equal(meta.provider, "local");
  }
});
