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

test("loadChapter returns PD Genesis.1 scaffolds (web/kjv/asv)", async () => {
  const web = await loadChapter("web", { book: "Gen", chapter: 1 });
  assert.ok(!("external" in web));
  assert.equal(web.source, "local");
  assert.equal(web.book, "Gen");
  assert.equal(web.chapter, 1);
  assert.ok(web.verses.length >= 3 && web.verses.length <= 5);
  assert.match(web.verses[0]?.text ?? "", /In the beginning.*God created/);

  const kjv = await loadChapter("kjv", { book: "Genesis", chapter: 1 });
  assert.ok(!("external" in kjv));
  assert.match(kjv.verses[0]?.text ?? "", /In the beginning God created/);
  assert.match(kjv.verses.find((v) => v.verse === 3)?.text ?? "", /Let there be light/);

  const asv = await loadChapter("asv", { book: "Gen", chapter: 1 });
  assert.ok(!("external" in asv));
  assert.match(asv.verses[0]?.text ?? "", /heavens and the earth|heaven and the earth/i);
  assert.match(asv.verses.find((v) => v.verse === 2)?.text ?? "", /waste and void|Spirit of God/);
});

test("loadChapter returns PD Matthew.5 scaffolds (web/kjv/asv)", async () => {
  const web = await loadChapter("web", { book: "Matt", chapter: 5 });
  assert.ok(!("external" in web));
  assert.equal(web.book, "Matt");
  assert.equal(web.chapter, 5);
  assert.ok(web.verses.length >= 3 && web.verses.length <= 5);
  assert.match(web.verses.find((v) => v.verse === 3)?.text ?? "", /poor in spirit/i);

  const kjv = await loadChapter("kjv", { book: "Matthew", chapter: 5 });
  assert.ok(!("external" in kjv));
  assert.match(kjv.verses.find((v) => v.verse === 5)?.text ?? "", /meek|inherit the earth/i);

  const asv = await loadChapter("asv", { book: "Matt", chapter: 5 });
  assert.ok(!("external" in asv));
  assert.match(asv.verses.find((v) => v.verse === 4)?.text ?? "", /mourn|comforted/i);
});

test("loadChapter returns Psalm.23 scaffolds (web/kjv/asv + zh/ja)", async () => {
  const web = await loadChapter("web", { book: "Ps", chapter: 23 });
  assert.ok(!("external" in web));
  assert.equal(web.book, "Ps");
  assert.match(web.verses[0]?.text ?? "", /shepherd/i);

  const kjv = await loadChapter("kjv", { book: "Psalm", chapter: 23 });
  assert.ok(!("external" in kjv));
  assert.ok(kjv.verses.length >= 3 && kjv.verses.length <= 5);
  assert.match(kjv.verses[0]?.text ?? "", /LORD is my shepherd/i);

  const asv = await loadChapter("asv", { book: "Psalms", chapter: 23 });
  assert.ok(!("external" in asv));
  assert.match(asv.verses[0]?.text ?? "", /Jehovah is my shepherd/i);

  const cuvs = await loadChapter("cuvs", { book: "Ps", chapter: 23 });
  assert.ok(!("external" in cuvs));
  assert.match(cuvs.verses[0]?.text ?? "", /样例|牧者/);

  const kougo = await loadChapter("kougo", { book: "Ps", chapter: 23 });
  assert.ok(!("external" in kougo));
  assert.match(kougo.verses[0]?.text ?? "", /見本|牧者/);
});

test("loadChapter returns zh/ja Genesis.1 scaffolds", async () => {
  const cuvs = await loadChapter("cuvs", { book: "Gen", chapter: 1 });
  assert.ok(!("external" in cuvs));
  assert.equal(cuvs.book, "Gen");
  assert.ok(cuvs.verses.length >= 3 && cuvs.verses.length <= 5);
  assert.match(cuvs.verses[0]?.text ?? "", /样例|起初|创造/);

  const kougo = await loadChapter("kougo", { book: "Gen", chapter: 1 });
  assert.ok(!("external" in kougo));
  assert.match(kougo.verses[0]?.text ?? "", /見本|創造|はじめに/);
});

test("loadChapter returns PD Romans.8 scaffolds (web/kjv/asv)", async () => {
  const web = await loadChapter("web", { book: "Rom", chapter: 8 });
  assert.ok(!("external" in web));
  assert.equal(web.source, "local");
  assert.equal(web.book, "Rom");
  assert.equal(web.chapter, 8);
  assert.ok(web.verses.length >= 3 && web.verses.length <= 5);
  assert.match(web.verses[0]?.text ?? "", /no condemnation/i);
  assert.match(web.verses.find((v) => v.verse === 28)?.text ?? "", /work together for good/i);

  const kjv = await loadChapter("kjv", { book: "Romans", chapter: 8 });
  assert.ok(!("external" in kjv));
  assert.equal(kjv.book, "Rom");
  assert.match(kjv.verses.find((v) => v.verse === 31)?.text ?? "", /If God be for us/i);

  const asv = await loadChapter("asv", { book: "rom", chapter: 8 });
  assert.ok(!("external" in asv));
  assert.match(asv.verses.find((v) => v.verse === 39)?.text ?? "", /love of God/i);
});

test("loadChapter returns PD Hebrews.11 scaffolds (web/kjv/asv)", async () => {
  const web = await loadChapter("web", { book: "Heb", chapter: 11 });
  assert.ok(!("external" in web));
  assert.equal(web.book, "Heb");
  assert.equal(web.chapter, 11);
  assert.ok(web.verses.length >= 3 && web.verses.length <= 5);
  assert.match(web.verses[0]?.text ?? "", /faith is assurance|hoped for/i);

  const kjv = await loadChapter("kjv", { book: "Hebrews", chapter: 11 });
  assert.ok(!("external" in kjv));
  assert.match(kjv.verses[0]?.text ?? "", /substance of things hoped for/i);
  assert.match(kjv.verses.find((v) => v.verse === 6)?.text ?? "", /impossible to please/i);

  const asv = await loadChapter("asv", { book: "heb", chapter: 11 });
  assert.ok(!("external" in asv));
  assert.match(asv.verses[0]?.text ?? "", /assurance of things hoped for/i);
});

test("loadChapter returns zh/ja Romans.8 and Hebrews.11 scaffolds", async () => {
  const cuvsRom = await loadChapter("cuvs", { book: "Rom", chapter: 8 });
  assert.ok(!("external" in cuvsRom));
  assert.equal(cuvsRom.book, "Rom");
  assert.ok(cuvsRom.verses.length >= 3 && cuvsRom.verses.length <= 5);
  assert.match(cuvsRom.verses[0]?.text ?? "", /样例|不定罪/);

  const kougoRom = await loadChapter("kougo", { book: "Romans", chapter: 8 });
  assert.ok(!("external" in kougoRom));
  assert.match(kougoRom.verses[0]?.text ?? "", /見本|罪に定められることがない/);

  const cuvsHeb = await loadChapter("cuvs", { book: "Heb", chapter: 11 });
  assert.ok(!("external" in cuvsHeb));
  assert.equal(cuvsHeb.book, "Heb");
  assert.match(cuvsHeb.verses[0]?.text ?? "", /样例|信就是|实底/);

  const kougoHeb = await loadChapter("kougo", { book: "Hebrews", chapter: 11 });
  assert.ok(!("external" in kougoHeb));
  assert.match(kougoHeb.verses[0]?.text ?? "", /見本|信仰とは/);
});

test("loadChapter returns PD Isaiah.53 scaffolds (web/kjv/asv)", async () => {
  const web = await loadChapter("web", { book: "Isa", chapter: 53 });
  assert.ok(!("external" in web));
  assert.equal(web.source, "local");
  assert.equal(web.book, "Isa");
  assert.equal(web.chapter, 53);
  assert.ok(web.verses.length >= 3 && web.verses.length <= 5);
  assert.match(web.verses[0]?.text ?? "", /believed our message|Yahweh's arm/i);
  assert.match(web.verses.find((v) => v.verse === 5)?.text ?? "", /pierced for our transgressions|wounds we are healed/i);

  const kjv = await loadChapter("kjv", { book: "Isaiah", chapter: 53 });
  assert.ok(!("external" in kjv));
  assert.equal(kjv.book, "Isa");
  assert.match(kjv.verses.find((v) => v.verse === 5)?.text ?? "", /wounded for our transgressions|stripes we are healed/i);

  const asv = await loadChapter("asv", { book: "isa", chapter: 53 });
  assert.ok(!("external" in asv));
  assert.match(asv.verses.find((v) => v.verse === 6)?.text ?? "", /sheep have gone astray|iniquity of us all/i);
});

test("loadChapter returns PD Acts.2 scaffolds (web/kjv/asv)", async () => {
  const web = await loadChapter("web", { book: "Acts", chapter: 2 });
  assert.ok(!("external" in web));
  assert.equal(web.book, "Acts");
  assert.equal(web.chapter, 2);
  assert.ok(web.verses.length >= 3 && web.verses.length <= 5);
  assert.match(web.verses[0]?.text ?? "", /Pentecost/i);
  assert.match(web.verses.find((v) => v.verse === 4)?.text ?? "", /Holy Spirit|other languages/i);

  const kjv = await loadChapter("kjv", { book: "Acts", chapter: 2 });
  assert.ok(!("external" in kjv));
  assert.match(kjv.verses.find((v) => v.verse === 38)?.text ?? "", /Repent.*baptized|Holy Ghost/i);

  const asv = await loadChapter("asv", { book: "acts", chapter: 2 });
  assert.ok(!("external" in asv));
  assert.match(asv.verses.find((v) => v.verse === 2)?.text ?? "", /rushing of a mighty wind/i);
});

test("loadChapter returns zh/ja Isaiah.53 and Acts.2 scaffolds", async () => {
  const cuvsIsa = await loadChapter("cuvs", { book: "Isa", chapter: 53 });
  assert.ok(!("external" in cuvsIsa));
  assert.equal(cuvsIsa.book, "Isa");
  assert.ok(cuvsIsa.verses.length >= 3 && cuvsIsa.verses.length <= 5);
  assert.match(cuvsIsa.verses[0]?.text ?? "", /样例|我们所传的|膀臂/);

  const kougoIsa = await loadChapter("kougo", { book: "Isaiah", chapter: 53 });
  assert.ok(!("external" in kougoIsa));
  assert.match(kougoIsa.verses[0]?.text ?? "", /見本|信じ得たか|主の腕/);

  const cuvsActs = await loadChapter("cuvs", { book: "Acts", chapter: 2 });
  assert.ok(!("external" in cuvsActs));
  assert.equal(cuvsActs.book, "Acts");
  assert.match(cuvsActs.verses[0]?.text ?? "", /样例|五旬节/);

  const kougoActs = await loadChapter("kougo", { book: "Acts", chapter: 2 });
  assert.ok(!("external" in kougoActs));
  assert.match(kougoActs.verses[0]?.text ?? "", /見本|五旬節/);
});

test("loadChapter returns PD Psalm.1 scaffolds (web/kjv/asv)", async () => {
  const web = await loadChapter("web", { book: "Ps", chapter: 1 });
  assert.ok(!("external" in web));
  assert.equal(web.source, "local");
  assert.equal(web.book, "Ps");
  assert.equal(web.chapter, 1);
  assert.ok(web.verses.length >= 3 && web.verses.length <= 5);
  assert.match(web.verses[0]?.text ?? "", /Blessed is the man|counsel of the wicked/i);
  assert.match(web.verses.find((v) => v.verse === 3)?.text ?? "", /tree planted|streams of water/i);

  const kjv = await loadChapter("kjv", { book: "Psalm", chapter: 1 });
  assert.ok(!("external" in kjv));
  assert.equal(kjv.book, "Ps");
  assert.match(kjv.verses[0]?.text ?? "", /Blessed is the man|counsel of the ungodly/i);

  const asv = await loadChapter("asv", { book: "Psalms", chapter: 1 });
  assert.ok(!("external" in asv));
  assert.match(asv.verses.find((v) => v.verse === 2)?.text ?? "", /law of Jehovah|meditate day and night/i);
});

test("loadChapter returns PD Proverbs.3 scaffolds (web/kjv/asv)", async () => {
  const web = await loadChapter("web", { book: "Prov", chapter: 3 });
  assert.ok(!("external" in web));
  assert.equal(web.book, "Prov");
  assert.equal(web.chapter, 3);
  assert.ok(web.verses.length >= 3 && web.verses.length <= 5);
  assert.match(web.verses.find((v) => v.verse === 5)?.text ?? "", /Trust in Yahweh|own understanding/i);

  const kjv = await loadChapter("kjv", { book: "Proverbs", chapter: 3 });
  assert.ok(!("external" in kjv));
  assert.equal(kjv.book, "Prov");
  assert.match(kjv.verses.find((v) => v.verse === 5)?.text ?? "", /Trust in the LORD|own understanding/i);

  const asv = await loadChapter("asv", { book: "prov", chapter: 3 });
  assert.ok(!("external" in asv));
  assert.match(asv.verses.find((v) => v.verse === 6)?.text ?? "", /acknowledge him|direct thy paths/i);
});

test("loadChapter returns zh/ja Psalm.1 and Proverbs.3 scaffolds", async () => {
  const cuvsPs = await loadChapter("cuvs", { book: "Ps", chapter: 1 });
  assert.ok(!("external" in cuvsPs));
  assert.equal(cuvsPs.book, "Ps");
  assert.ok(cuvsPs.verses.length >= 3 && cuvsPs.verses.length <= 5);
  assert.match(cuvsPs.verses[0]?.text ?? "", /样例|恶人的计谋|有福/);

  const kougoPs = await loadChapter("kougo", { book: "Psalm", chapter: 1 });
  assert.ok(!("external" in kougoPs));
  assert.match(kougoPs.verses[0]?.text ?? "", /見本|悪しき者|さいわい/);

  const cuvsProv = await loadChapter("cuvs", { book: "箴言", chapter: 3 });
  assert.ok(!("external" in cuvsProv));
  assert.equal(cuvsProv.book, "Prov");
  assert.match(cuvsProv.verses.find((v) => v.verse === 5)?.text ?? "", /样例|仰赖耶和华|自己的聪明/);

  const kougoProv = await loadChapter("kougo", { book: "Proverbs", chapter: 3 });
  assert.ok(!("external" in kougoProv));
  assert.match(kougoProv.verses.find((v) => v.verse === 5)?.text ?? "", /見本|主に信頼|自分の知識/);
});

test("loadChapter returns PD Mark.1 scaffolds (web/kjv/asv)", async () => {
  const web = await loadChapter("web", { book: "Mark", chapter: 1 });
  assert.ok(!("external" in web));
  assert.equal(web.source, "local");
  assert.equal(web.book, "Mark");
  assert.equal(web.chapter, 1);
  assert.ok(web.verses.length >= 3 && web.verses.length <= 5);
  assert.match(web.verses[0]?.text ?? "", /beginning of the Good News|Jesus Christ/i);
  assert.match(web.verses.find((v) => v.verse === 4)?.text ?? "", /John came baptizing|baptism of repentance/i);

  const kjv = await loadChapter("kjv", { book: "Mk", chapter: 1 });
  assert.ok(!("external" in kjv));
  assert.equal(kjv.book, "Mark");
  assert.match(kjv.verses[0]?.text ?? "", /beginning of the gospel|Son of God/i);

  const asv = await loadChapter("asv", { book: "mark", chapter: 1 });
  assert.ok(!("external" in asv));
  assert.match(asv.verses.find((v) => v.verse === 3)?.text ?? "", /voice of one crying|Make ye ready/i);
});

test("loadChapter returns PD Exodus.20 scaffolds (web/kjv/asv)", async () => {
  const web = await loadChapter("web", { book: "Exod", chapter: 20 });
  assert.ok(!("external" in web));
  assert.equal(web.book, "Exod");
  assert.equal(web.chapter, 20);
  assert.ok(web.verses.length >= 3 && web.verses.length <= 5);
  assert.match(web.verses.find((v) => v.verse === 2)?.text ?? "", /Yahweh your God|land of Egypt/i);

  const kjv = await loadChapter("kjv", { book: "Exodus", chapter: 20 });
  assert.ok(!("external" in kjv));
  assert.equal(kjv.book, "Exod");
  assert.match(kjv.verses.find((v) => v.verse === 3)?.text ?? "", /no other gods before me/i);

  const asv = await loadChapter("asv", { book: "Ex", chapter: 20 });
  assert.ok(!("external" in asv));
  assert.match(asv.verses.find((v) => v.verse === 2)?.text ?? "", /Jehovah thy God|Egypt/i);
});

test("loadChapter returns zh/ja Mark.1 and Exodus.20 scaffolds", async () => {
  const cuvsMark = await loadChapter("cuvs", { book: "马可福音", chapter: 1 });
  assert.ok(!("external" in cuvsMark));
  assert.equal(cuvsMark.book, "Mark");
  assert.ok(cuvsMark.verses.length >= 3 && cuvsMark.verses.length <= 5);
  assert.match(cuvsMark.verses[0]?.text ?? "", /样例|耶稣基督|福音的起头/);

  const kougoMark = await loadChapter("kougo", { book: "マルコ", chapter: 1 });
  assert.ok(!("external" in kougoMark));
  assert.match(kougoMark.verses[0]?.text ?? "", /見本|イエス・キリスト|福音のはじめ/);

  const cuvsExod = await loadChapter("cuvs", { book: "出埃及记", chapter: 20 });
  assert.ok(!("external" in cuvsExod));
  assert.equal(cuvsExod.book, "Exod");
  assert.match(cuvsExod.verses.find((v) => v.verse === 3)?.text ?? "", /样例|不可有别的神/);

  const kougoExod = await loadChapter("kougo", { book: "出エジプト記", chapter: 20 });
  assert.ok(!("external" in kougoExod));
  assert.match(kougoExod.verses.find((v) => v.verse === 2)?.text ?? "", /見本|エジプトの地|奴隷の家/);
});
