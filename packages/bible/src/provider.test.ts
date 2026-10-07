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

test("loadChapter returns verses for web John.2 (wedding at Cana)", async () => {
  const result = await loadChapter("web", { book: "John", chapter: 2 });
  assert.ok(!("external" in result));
  assert.equal(result.source, "local");
  assert.equal(result.chapter, 2);
  assert.ok(result.verses.length >= 11);
  assert.equal(result.verses[0]?.verse, 1);
  assert.match(result.verses[0]?.text ?? "", /wedding in Cana/);
  assert.match(result.verses.find((v) => v.verse === 11)?.text ?? "", /beginning of his signs/);
});

test("loadChapter returns verses for web John.3 (chapter switch)", async () => {
  const result = await loadChapter("web", { book: "John", chapter: 3 });
  assert.ok(!("external" in result));
  assert.equal(result.chapter, 3);
  assert.ok(result.verses.length > 0);
  assert.match(result.verses.find((v) => v.verse === 16)?.text ?? "", /God so loved the world/);
});

test("loadChapter returns verses for web John.2", async () => {
  const result = await loadChapter("web", { book: "John", chapter: 2 });
  assert.ok(!("external" in result));
  assert.equal(result.chapter, 2);
  assert.ok(result.verses.length > 0);
});

test("loadChapter returns verses for kjv John.3", async () => {
  const result = await loadChapter("kjv", { book: "John", chapter: 3 });
  assert.ok(!("external" in result));
  assert.equal(result.chapter, 3);
  assert.match(result.verses.find((v) => v.verse === 16)?.text ?? "", /God so loved the world/);
});

test("loadChapter returns verses for kjv John.3 (includes 3:16)", async () => {
  const result = await loadChapter("kjv", { book: "John", chapter: 3 });
  assert.ok(!("external" in result));
  assert.equal(result.source, "local");
  assert.equal(result.chapter, 3);
  assert.ok(result.verses.length > 0);
  assert.match(result.verses[0]?.text ?? "", /Nicodemus/);
  assert.match(
    result.verses.find((v) => v.verse === 16)?.text ?? "",
    /only begotten Son/,
  );
});

test("loadChapter returns verses for asv John.3 (includes 3:16)", async () => {
  const result = await loadChapter("asv", { book: "John", chapter: 3 });
  assert.ok(!("external" in result));
  assert.equal(result.source, "local");
  assert.equal(result.chapter, 3);
  assert.ok(result.verses.length > 0);
  assert.match(result.verses[0]?.text ?? "", /Nicodemus/);
  assert.match(
    result.verses.find((v) => v.verse === 16)?.text ?? "",
    /believeth on him/,
  );
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

test("mainstream licensed zh/ja translations are catalogued available", () => {
  for (const id of ["cuvs", "cuvt", "rcuv", "ccb", "lzz", "kougo", "shinkaiyaku", "shinKyoudou"]) {
    const meta = getTranslation(id);
    assert.ok(meta, `missing translation ${id}`);
    assert.equal(meta.available, true);
  }
});

test("NIV/ESV/NLT are external deep-links", async () => {
  for (const id of ["niv", "esv", "nlt"]) {
    const meta = getTranslation(id);
    assert.ok(meta);
    assert.equal(meta.provider, "external");
    const result = await loadChapter(id, { book: "John", chapter: 1 });
    assert.ok("external" in result && result.external);
    assert.match(result.url, /biblegateway|NIV|ESV|NLT/i);
  }
});

test("loadChapter returns kougo scaffold John.1", async () => {
  const result = await loadChapter("kougo", { book: "John", chapter: 1 });
  assert.ok(!("external" in result));
  assert.ok(result.verses.length > 0);
  assert.match(result.verses[0]?.text ?? "", /初めに言があった/);
});

test("loadChapter returns cuvs scaffold John.1", async () => {
  const result = await loadChapter("cuvs", { book: "John", chapter: 1 });
  assert.ok(!("external" in result));
  assert.ok(result.verses.length > 0);
  assert.match(result.verses[0]?.text ?? "", /太初有道/);
});

test("loadChapter returns lzz scaffold John.1", async () => {
  const result = await loadChapter("lzz", { book: "John", chapter: 1 });
  assert.ok(!("external" in result));
  assert.ok(result.verses.length > 0);
  assert.match(result.verses[0]?.text ?? "", /起初有道|太初有道/);
});

test("loadChapter returns cuvs/kougo/kjv/asv John.2 scaffolds", async () => {
  const cuvs = await loadChapter("cuvs", { book: "John", chapter: 2 });
  assert.ok(!("external" in cuvs));
  assert.match(cuvs.verses[0]?.text ?? "", /迦拿|娶亲/);

  const kougo = await loadChapter("kougo", { book: "John", chapter: 2 });
  assert.ok(!("external" in kougo));
  assert.match(kougo.verses[0]?.text ?? "", /カナ|婚礼/);

  const kjv = await loadChapter("kjv", { book: "John", chapter: 2 });
  assert.ok(!("external" in kjv));
  assert.match(kjv.verses[0]?.text ?? "", /Cana/i);

  const asv = await loadChapter("asv", { book: "John", chapter: 2 });
  assert.ok(!("external" in asv));
  assert.match(asv.verses[0]?.text ?? "", /Cana/i);
});

test("partner external chapter marks sso when flags on", async () => {
  const off = await loadChapter("endao", { book: "John", chapter: 1 }, { endao: false, weread: false });
  assert.ok("external" in off && off.external);
  assert.equal(off.sso, false);
  assert.ok(!off.url.includes("sso=1"));

  const on = await loadChapter("endao", { book: "John", chapter: 1 }, { endao: true, weread: false });
  assert.ok("external" in on && on.external);
  assert.equal(on.sso, true);
  assert.ok(on.url.includes("sso=1"));
});
