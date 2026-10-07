import { test } from "node:test";
import assert from "node:assert/strict";
import { loadChapter } from "./provider.js";
import { getTranslation, listTranslations } from "./translations.js";

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

test("NIV/ESV/NLT/NASB/CSB/NRSV are external deep-links", async () => {
  for (const id of ["niv", "esv", "nlt", "nasb", "csb", "nrsv"]) {
    const meta = getTranslation(id);
    assert.ok(meta);
    assert.equal(meta.provider, "external");
    const result = await loadChapter(id, { book: "John", chapter: 1 });
    assert.ok("external" in result && result.external);
    assert.match(result.url, /biblegateway|bible\.com|NIV|ESV|NLT|NASB|CSB|NRSV/i);
  }
});

test("zh/ja external mainstream (sigao, living-ja) deep-link", async () => {
  for (const id of ["sigao", "living-ja"]) {
    const meta = getTranslation(id);
    assert.ok(meta, `missing ${id}`);
    assert.equal(meta.provider, "external");
    const result = await loadChapter(id, { book: "John", chapter: 1 });
    assert.ok("external" in result && result.external);
    assert.ok(result.url.length > 8);
  }
});

test("registry covers zh/en/ja mainstream sets", () => {
  const byLang = { zh: 0, en: 0, ja: 0 };
  for (const t of listTranslations({ availableOnly: true })) {
    byLang[t.language] += 1;
  }
  assert.ok(byLang.zh >= 7, `zh count ${byLang.zh}`);
  assert.ok(byLang.en >= 7, `en count ${byLang.en}`);
  assert.ok(byLang.ja >= 4, `ja count ${byLang.ja}`);
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

test("loadChapter returns expanded zh/ja John.2 scaffolds", async () => {
  const cuvt = await loadChapter("cuvt", { book: "John", chapter: 2 });
  assert.ok(!("external" in cuvt));
  assert.match(cuvt.verses[0]?.text ?? "", /迦拿|娶親/);
  assert.match(cuvt.verses.find((v) => v.verse === 11)?.text ?? "", /神蹟|榮耀/);

  const rcuv = await loadChapter("rcuv", { book: "John", chapter: 2 });
  assert.ok(!("external" in rcuv));
  assert.match(rcuv.verses[0]?.text ?? "", /迦拿|娶亲/);

  const ccb = await loadChapter("ccb", { book: "John", chapter: 2 });
  assert.ok(!("external" in ccb));
  assert.match(ccb.verses[0]?.text ?? "", /迦拿|婚宴/);

  const lzz = await loadChapter("lzz", { book: "John", chapter: 2 });
  assert.ok(!("external" in lzz));
  assert.match(lzz.verses[0]?.text ?? "", /迦拿|婚筵/);

  const shinkaiyaku = await loadChapter("shinkaiyaku", { book: "John", chapter: 2 });
  assert.ok(!("external" in shinkaiyaku));
  assert.match(shinkaiyaku.verses[0]?.text ?? "", /カナ|婚宴/);

  const shinKyoudou = await loadChapter("shinKyoudou", { book: "John", chapter: 2 });
  assert.ok(!("external" in shinKyoudou));
  assert.match(shinKyoudou.verses[0]?.text ?? "", /カナ|婚礼/);

  const kougoyakuPd = await loadChapter("kougoyaku-pd", { book: "John", chapter: 2 });
  assert.ok(!("external" in kougoyakuPd));
  assert.match(kougoyakuPd.verses[0]?.text ?? "", /カナ|婚筵/);
});

test("loadChapter returns zh/ja John.3 scaffolds (includes 3:16)", async () => {
  const cuvs = await loadChapter("cuvs", { book: "John", chapter: 3 });
  assert.ok(!("external" in cuvs));
  assert.equal(cuvs.chapter, 3);
  assert.match(cuvs.verses[0]?.text ?? "", /尼哥底母|法利赛/);
  assert.match(cuvs.verses.find((v) => v.verse === 16)?.text ?? "", /神爱世人|独生子/);

  const cuvt = await loadChapter("cuvt", { book: "John", chapter: 3 });
  assert.ok(!("external" in cuvt));
  assert.match(cuvt.verses.find((v) => v.verse === 16)?.text ?? "", /神愛世人|獨生子/);

  const rcuv = await loadChapter("rcuv", { book: "John", chapter: 3 });
  assert.ok(!("external" in rcuv));
  assert.match(rcuv.verses.find((v) => v.verse === 16)?.text ?? "", /神爱世人|独生子/);

  const ccb = await loadChapter("ccb", { book: "John", chapter: 3 });
  assert.ok(!("external" in ccb));
  assert.match(ccb.verses.find((v) => v.verse === 16)?.text ?? "", /上帝深爱世人|独生子/);

  const lzz = await loadChapter("lzz", { book: "John", chapter: 3 });
  assert.ok(!("external" in lzz));
  assert.match(lzz.verses.find((v) => v.verse === 16)?.text ?? "", /上帝这样地爱了世人|独生子/);

  const kougo = await loadChapter("kougo", { book: "John", chapter: 3 });
  assert.ok(!("external" in kougo));
  assert.match(kougo.verses[0]?.text ?? "", /ニコデモ/);
  assert.match(kougo.verses.find((v) => v.verse === 16)?.text ?? "", /ひとり子|永遠の命/);

  const shinkaiyaku = await loadChapter("shinkaiyaku", { book: "John", chapter: 3 });
  assert.ok(!("external" in shinkaiyaku));
  assert.match(shinkaiyaku.verses.find((v) => v.verse === 16)?.text ?? "", /ひとり子|永遠のいのち/);

  const shinKyoudou = await loadChapter("shinKyoudou", { book: "John", chapter: 3 });
  assert.ok(!("external" in shinKyoudou));
  assert.match(shinKyoudou.verses.find((v) => v.verse === 16)?.text ?? "", /独り子|永遠の命/);

  const kougoyakuPd = await loadChapter("kougoyaku-pd", { book: "John", chapter: 3 });
  assert.ok(!("external" in kougoyakuPd));
  assert.match(kougoyakuPd.verses.find((v) => v.verse === 16)?.text ?? "", /獨り子|永遠の生命/);
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
