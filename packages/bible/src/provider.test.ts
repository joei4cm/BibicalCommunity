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
  assert.ok(result.verses.length >= 21);
  assert.equal(result.verses[0]?.verse, 1);
  assert.equal(result.verses[result.verses.length - 1]?.verse, 21);
  assert.match(result.verses.find((v) => v.verse === 16)?.text ?? "", /God so loved the world/);
  assert.match(result.verses.find((v) => v.verse === 5)?.text ?? "", /born of water and spirit/i);
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
  assert.ok(web.verses.length >= 12);
  assert.equal(web.verses[web.verses.length - 1]?.verse, 12);
  assert.match(web.verses.find((v) => v.verse === 3)?.text ?? "", /poor in spirit/i);
  assert.match(web.verses.find((v) => v.verse === 9)?.text ?? "", /peacemakers|children of God/i);

  const kjv = await loadChapter("kjv", { book: "Matthew", chapter: 5 });
  assert.ok(!("external" in kjv));
  assert.ok(kjv.verses.length >= 12);
  assert.match(kjv.verses.find((v) => v.verse === 5)?.text ?? "", /meek|inherit the earth/i);

  const asv = await loadChapter("asv", { book: "Matt", chapter: 5 });
  assert.ok(!("external" in asv));
  assert.ok(asv.verses.length >= 12);
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
  assert.ok(web.verses.length >= 21);
  assert.equal(web.verses[0]?.verse, 1);
  assert.match(web.verses[0]?.text ?? "", /no condemnation/i);
  assert.match(web.verses.find((v) => v.verse === 14)?.text ?? "", /led by the Spirit/i);
  assert.match(web.verses.find((v) => v.verse === 28)?.text ?? "", /work together for good/i);

  const kjv = await loadChapter("kjv", { book: "Romans", chapter: 8 });
  assert.ok(!("external" in kjv));
  assert.equal(kjv.book, "Rom");
  assert.ok(kjv.verses.length >= 21);
  assert.match(kjv.verses.find((v) => v.verse === 15)?.text ?? "", /Abba/i);
  assert.match(kjv.verses.find((v) => v.verse === 31)?.text ?? "", /If God be for us/i);

  const asv = await loadChapter("asv", { book: "rom", chapter: 8 });
  assert.ok(!("external" in asv));
  assert.ok(asv.verses.length >= 21);
  assert.match(asv.verses.find((v) => v.verse === 16)?.text ?? "", /children of God/i);
  assert.match(asv.verses.find((v) => v.verse === 39)?.text ?? "", /love of God/i);
});

test("loadChapter returns PD Hebrews.11 scaffolds (web/kjv/asv)", async () => {
  const web = await loadChapter("web", { book: "Heb", chapter: 11 });
  assert.ok(!("external" in web));
  assert.equal(web.book, "Heb");
  assert.equal(web.chapter, 11);
  assert.ok(web.verses.length >= 12);
  assert.equal(web.verses[0]?.verse, 1);
  assert.equal(web.verses[web.verses.length - 1]?.verse, 12);
  assert.match(web.verses[0]?.text ?? "", /faith is assurance|hoped for/i);
  assert.match(web.verses.find((v) => v.verse === 8)?.text ?? "", /Abraham/i);

  const kjv = await loadChapter("kjv", { book: "Hebrews", chapter: 11 });
  assert.ok(!("external" in kjv));
  assert.ok(kjv.verses.length >= 12);
  assert.match(kjv.verses[0]?.text ?? "", /substance of things hoped for/i);
  assert.match(kjv.verses.find((v) => v.verse === 6)?.text ?? "", /impossible to please/i);
  assert.match(kjv.verses.find((v) => v.verse === 7)?.text ?? "", /Noah/i);

  const asv = await loadChapter("asv", { book: "heb", chapter: 11 });
  assert.ok(!("external" in asv));
  assert.ok(asv.verses.length >= 12);
  assert.match(asv.verses[0]?.text ?? "", /assurance of things hoped for/i);
  assert.match(asv.verses.find((v) => v.verse === 5)?.text ?? "", /Enoch/i);
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
  assert.ok(cuvsHeb.verses.length >= 10);
  assert.match(cuvsHeb.verses[0]?.text ?? "", /样例|信就是|实底/);
  assert.match(cuvsHeb.verses.find((v) => v.verse === 8)?.text ?? "", /亚伯拉罕/);

  const kougoHeb = await loadChapter("kougo", { book: "Hebrews", chapter: 11 });
  assert.ok(!("external" in kougoHeb));
  assert.ok(kougoHeb.verses.length >= 10);
  assert.match(kougoHeb.verses[0]?.text ?? "", /見本|信仰とは/);
  assert.match(kougoHeb.verses.find((v) => v.verse === 7)?.text ?? "", /ノア/);
});

test("loadChapter returns zh/ja Romans.12 scaffolds", async () => {
  const cuvs = await loadChapter("cuvs", { book: "Rom", chapter: 12 });
  assert.ok(!("external" in cuvs));
  assert.ok(cuvs.verses.length >= 8);
  assert.match(cuvs.verses.find((v) => v.verse === 1)?.text ?? "", /活祭/);
  assert.match(cuvs.verses.find((v) => v.verse === 21)?.text ?? "", /以善胜恶/);

  const kougo = await loadChapter("kougo", { book: "Romans", chapter: 12 });
  assert.ok(!("external" in kougo));
  assert.ok(kougo.verses.length >= 8);
  assert.match(kougo.verses.find((v) => v.verse === 2)?.text ?? "", /造りかえられ|心を新たに/);
  assert.match(kougo.verses.find((v) => v.verse === 21)?.text ?? "", /善をもって悪に勝ち/);
});

test("loadChapter returns PD Isaiah.53 scaffolds (web/kjv/asv)", async () => {
  const web = await loadChapter("web", { book: "Isa", chapter: 53 });
  assert.ok(!("external" in web));
  assert.equal(web.source, "local");
  assert.equal(web.book, "Isa");
  assert.equal(web.chapter, 53);
  assert.ok(web.verses.length >= 12);
  assert.equal(web.verses[0]?.verse, 1);
  assert.equal(web.verses[web.verses.length - 1]?.verse, 12);
  assert.match(web.verses[0]?.text ?? "", /believed our message|Yahweh's arm/i);
  assert.match(web.verses.find((v) => v.verse === 5)?.text ?? "", /pierced for our transgressions|wounds we are healed/i);
  assert.match(web.verses.find((v) => v.verse === 7)?.text ?? "", /lamb|slaughter/i);

  const kjv = await loadChapter("kjv", { book: "Isaiah", chapter: 53 });
  assert.ok(!("external" in kjv));
  assert.equal(kjv.book, "Isa");
  assert.ok(kjv.verses.length >= 12);
  assert.match(kjv.verses.find((v) => v.verse === 5)?.text ?? "", /wounded for our transgressions|stripes we are healed/i);
  assert.match(kjv.verses.find((v) => v.verse === 12)?.text ?? "", /intercession for the transgressors/i);

  const asv = await loadChapter("asv", { book: "isa", chapter: 53 });
  assert.ok(!("external" in asv));
  assert.ok(asv.verses.length >= 12);
  assert.match(asv.verses.find((v) => v.verse === 6)?.text ?? "", /sheep have gone astray|iniquity of us all/i);
  assert.match(asv.verses.find((v) => v.verse === 11)?.text ?? "", /justify many|iniquities/i);
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

test("loadChapter returns licensed-peer Heb.11 / Isa.53 / Acts.2 / Ps.1 / Prov.3 scaffolds", async () => {
  const peers = ["cuvt", "rcuv", "ccb", "lzz", "shinkaiyaku", "shinKyoudou"] as const;
  for (const tid of peers) {
    const heb = await loadChapter(tid, { book: "Heb", chapter: 11 });
    assert.ok(!("external" in heb), tid);
    assert.equal(heb.book, "Heb");
    assert.ok(heb.verses.length >= 5 && heb.verses.length <= 12, tid);
    assert.match(heb.verses[0]?.text ?? "", /样例|樣例|見本|信|信仰/);

    const isa = await loadChapter(tid, { book: "Isa", chapter: 53 });
    assert.ok(!("external" in isa), tid);
    assert.equal(isa.book, "Isa");
    assert.ok(isa.verses.length >= 3 && isa.verses.length <= 8, tid);
    assert.match(isa.verses[0]?.text ?? "", /样例|樣例|見本|信|腕|膀臂/);

    const acts = await loadChapter(tid, { book: "Acts", chapter: 2 });
    assert.ok(!("external" in acts), tid);
    assert.equal(acts.book, "Acts");
    assert.match(acts.verses[0]?.text ?? "", /样例|樣例|見本|五旬/);

    const ps = await loadChapter(tid, { book: "Ps", chapter: 1 });
    assert.ok(!("external" in ps), tid);
    assert.equal(ps.book, "Ps");
    assert.match(ps.verses[0]?.text ?? "", /样例|樣例|見本|恶|惡|福|さいわい|幸い/);

    const prov = await loadChapter(tid, { book: "Prov", chapter: 3 });
    assert.ok(!("external" in prov), tid);
    assert.equal(prov.book, "Prov");
    assert.match(prov.verses.find((v) => v.verse === 5)?.text ?? "", /样例|樣例|見本|仰赖|仰賴|信頼|聪明|聰明|知識/);
  }
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

test("loadChapter returns PD Luke.2 scaffolds (web/kjv/asv)", async () => {
  const web = await loadChapter("web", { book: "Luke", chapter: 2 });
  assert.ok(!("external" in web));
  assert.equal(web.source, "local");
  assert.equal(web.book, "Luke");
  assert.equal(web.chapter, 2);
  assert.ok(web.verses.length >= 3 && web.verses.length <= 5);
  assert.match(web.verses[0]?.text ?? "", /Caesar Augustus|decree|enrolled/i);
  assert.match(web.verses.find((v) => v.verse === 11)?.text ?? "", /Savior|Christ the Lord/i);

  const kjv = await loadChapter("kjv", { book: "Lk", chapter: 2 });
  assert.ok(!("external" in kjv));
  assert.equal(kjv.book, "Luke");
  assert.match(kjv.verses.find((v) => v.verse === 7)?.text ?? "", /firstborn|manger|swaddling/i);

  const asv = await loadChapter("asv", { book: "luke", chapter: 2 });
  assert.ok(!("external" in asv));
  assert.match(asv.verses.find((v) => v.verse === 10)?.text ?? "", /good tidings|Be not afraid/i);
});

test("loadChapter returns PD Deuteronomy.6 scaffolds (web/kjv/asv)", async () => {
  const web = await loadChapter("web", { book: "Deut", chapter: 6 });
  assert.ok(!("external" in web));
  assert.equal(web.book, "Deut");
  assert.equal(web.chapter, 6);
  assert.ok(web.verses.length >= 3 && web.verses.length <= 5);
  assert.match(web.verses.find((v) => v.verse === 4)?.text ?? "", /Hear.*Israel|Yahweh is one/i);

  const kjv = await loadChapter("kjv", { book: "Deuteronomy", chapter: 6 });
  assert.ok(!("external" in kjv));
  assert.equal(kjv.book, "Deut");
  assert.match(kjv.verses.find((v) => v.verse === 5)?.text ?? "", /love the LORD thy God/i);

  const asv = await loadChapter("asv", { book: "Dt", chapter: 6 });
  assert.ok(!("external" in asv));
  assert.match(asv.verses.find((v) => v.verse === 4)?.text ?? "", /Jehovah our God|one Jehovah/i);
});

test("loadChapter returns zh/ja Luke.2 and Deuteronomy.6 scaffolds", async () => {
  const cuvsLuke = await loadChapter("cuvs", { book: "路加福音", chapter: 2 });
  assert.ok(!("external" in cuvsLuke));
  assert.equal(cuvsLuke.book, "Luke");
  assert.ok(cuvsLuke.verses.length >= 3 && cuvsLuke.verses.length <= 5);
  assert.match(cuvsLuke.verses[0]?.text ?? "", /样例|凯撒|报名上册/);

  const kougoLuke = await loadChapter("kougo", { book: "ルカ", chapter: 2 });
  assert.ok(!("external" in kougoLuke));
  assert.match(kougoLuke.verses[0]?.text ?? "", /見本|アウグスト|人口調査/);

  const cuvsDeut = await loadChapter("cuvs", { book: "申命记", chapter: 6 });
  assert.ok(!("external" in cuvsDeut));
  assert.equal(cuvsDeut.book, "Deut");
  assert.match(cuvsDeut.verses.find((v) => v.verse === 4)?.text ?? "", /样例|以色列|独一的主/);

  const kougoDeut = await loadChapter("kougo", { book: "申命記", chapter: 6 });
  assert.ok(!("external" in kougoDeut));
  assert.match(kougoDeut.verses.find((v) => v.verse === 4)?.text ?? "", /見本|イスラエル|唯一の主/);
});

test("loadChapter returns PD Matt.6 scaffolds (web/kjv/asv)", async () => {
  const web = await loadChapter("web", { book: "Matt", chapter: 6 });
  assert.ok(!("external" in web));
  assert.equal(web.source, "local");
  assert.equal(web.book, "Matt");
  assert.equal(web.chapter, 6);
  assert.ok(web.verses.length >= 3 && web.verses.length <= 5);
  assert.match(web.verses.find((v) => v.verse === 9)?.text ?? "", /Our Father|name be kept holy/i);
  assert.match(web.verses.find((v) => v.verse === 33)?.text ?? "", /seek first|Kingdom/i);

  const kjv = await loadChapter("kjv", { book: "Matthew", chapter: 6 });
  assert.ok(!("external" in kjv));
  assert.equal(kjv.book, "Matt");
  assert.match(kjv.verses.find((v) => v.verse === 11)?.text ?? "", /daily bread/i);

  const asv = await loadChapter("asv", { book: "Mt", chapter: 6 });
  assert.ok(!("external" in asv));
  assert.match(asv.verses.find((v) => v.verse === 10)?.text ?? "", /Thy kingdom come|will be done/i);
});

test("loadChapter returns PD Galatians.5 scaffolds (web/kjv/asv)", async () => {
  const web = await loadChapter("web", { book: "Gal", chapter: 5 });
  assert.ok(!("external" in web));
  assert.equal(web.book, "Gal");
  assert.equal(web.chapter, 5);
  assert.ok(web.verses.length >= 3 && web.verses.length <= 5);
  assert.match(web.verses.find((v) => v.verse === 22)?.text ?? "", /fruit of the Spirit|love, joy, peace/i);

  const kjv = await loadChapter("kjv", { book: "Galatians", chapter: 5 });
  assert.ok(!("external" in kjv));
  assert.equal(kjv.book, "Gal");
  assert.match(kjv.verses.find((v) => v.verse === 16)?.text ?? "", /Walk in the Spirit/i);

  const asv = await loadChapter("asv", { book: "gal", chapter: 5 });
  assert.ok(!("external" in asv));
  assert.match(asv.verses.find((v) => v.verse === 23)?.text ?? "", /self-control|no law/i);
});

test("loadChapter returns zh/ja Matt.6 and Galatians.5 scaffolds", async () => {
  const cuvsMatt = await loadChapter("cuvs", { book: "马太福音", chapter: 6 });
  assert.ok(!("external" in cuvsMatt));
  assert.equal(cuvsMatt.book, "Matt");
  assert.ok(cuvsMatt.verses.length >= 3 && cuvsMatt.verses.length <= 5);
  assert.match(cuvsMatt.verses.find((v) => v.verse === 9)?.text ?? "", /样例|天上的父|尊你的名/);

  const kougoMatt = await loadChapter("kougo", { book: "マタイ", chapter: 6 });
  assert.ok(!("external" in kougoMatt));
  assert.match(kougoMatt.verses.find((v) => v.verse === 9)?.text ?? "", /見本|われらの父|御名/);

  const cuvsGal = await loadChapter("cuvs", { book: "加拉太书", chapter: 5 });
  assert.ok(!("external" in cuvsGal));
  assert.equal(cuvsGal.book, "Gal");
  assert.match(cuvsGal.verses.find((v) => v.verse === 22)?.text ?? "", /样例|圣灵所结的果子|仁爱/);

  const kougoGal = await loadChapter("kougo", { book: "ガラテヤ", chapter: 5 });
  assert.ok(!("external" in kougoGal));
  assert.match(kougoGal.verses.find((v) => v.verse === 22)?.text ?? "", /見本|御霊の実|愛、喜び/);
});

test("loadChapter returns PD Philippians.4 scaffolds (web/kjv/asv)", async () => {
  const web = await loadChapter("web", { book: "Phil", chapter: 4 });
  assert.ok(!("external" in web));
  assert.equal(web.source, "local");
  assert.equal(web.book, "Phil");
  assert.equal(web.chapter, 4);
  assert.ok(web.verses.length >= 3 && web.verses.length <= 5);
  assert.match(web.verses.find((v) => v.verse === 4)?.text ?? "", /Rejoice in the Lord/i);
  assert.match(web.verses.find((v) => v.verse === 13)?.text ?? "", /all things through Christ/i);

  const kjv = await loadChapter("kjv", { book: "Philippians", chapter: 4 });
  assert.ok(!("external" in kjv));
  assert.equal(kjv.book, "Phil");
  assert.match(kjv.verses.find((v) => v.verse === 7)?.text ?? "", /peace of God/i);

  const asv = await loadChapter("asv", { book: "Php", chapter: 4 });
  assert.ok(!("external" in asv));
  assert.match(asv.verses.find((v) => v.verse === 13)?.text ?? "", /all things in him/i);
});

test("loadChapter returns PD 1Corinthians.13 scaffolds (web/kjv/asv)", async () => {
  const web = await loadChapter("web", { book: "1Cor", chapter: 13 });
  assert.ok(!("external" in web));
  assert.equal(web.book, "1Cor");
  assert.equal(web.chapter, 13);
  assert.ok(web.verses.length >= 3 && web.verses.length <= 5);
  assert.match(web.verses.find((v) => v.verse === 4)?.text ?? "", /Love is patient/i);
  assert.match(web.verses.find((v) => v.verse === 13)?.text ?? "", /greatest of these is love/i);

  const kjv = await loadChapter("kjv", { book: "1Corinthians", chapter: 13 });
  assert.ok(!("external" in kjv));
  assert.equal(kjv.book, "1Cor");
  assert.match(kjv.verses.find((v) => v.verse === 13)?.text ?? "", /greatest of these is charity/i);

  const asv = await loadChapter("asv", { book: "1Co", chapter: 13 });
  assert.ok(!("external" in asv));
  assert.match(asv.verses.find((v) => v.verse === 1)?.text ?? "", /have not love/i);
});

test("loadChapter returns zh/ja Philippians.4 and 1Corinthians.13 scaffolds", async () => {
  const cuvsPhil = await loadChapter("cuvs", { book: "腓立比书", chapter: 4 });
  assert.ok(!("external" in cuvsPhil));
  assert.equal(cuvsPhil.book, "Phil");
  assert.match(cuvsPhil.verses.find((v) => v.verse === 4)?.text ?? "", /样例|常常喜乐/);

  const kougoPhil = await loadChapter("kougo", { book: "ピリピ", chapter: 4 });
  assert.ok(!("external" in kougoPhil));
  assert.match(kougoPhil.verses.find((v) => v.verse === 4)?.text ?? "", /見本|常に喜び/);

  const cuvsCor = await loadChapter("cuvs", { book: "哥林多前书", chapter: 13 });
  assert.ok(!("external" in cuvsCor));
  assert.equal(cuvsCor.book, "1Cor");
  assert.match(cuvsCor.verses.find((v) => v.verse === 13)?.text ?? "", /样例|最大的是爱/);

  const kougoCor = await loadChapter("kougo", { book: "コリント第一", chapter: 13 });
  assert.ok(!("external" in kougoCor));
  assert.match(kougoCor.verses.find((v) => v.verse === 13)?.text ?? "", /見本|最も大いなるものは、愛/);
});

test("loadChapter returns PD John.14 / Rom.12 / 1John.4 scaffolds (web/kjv/asv)", async () => {
  const john14 = await loadChapter("web", { book: "John", chapter: 14 });
  assert.ok(!("external" in john14));
  assert.equal(john14.source, "local");
  assert.equal(john14.chapter, 14);
  assert.ok(john14.verses.length >= 18);
  assert.equal(john14.verses[0]?.verse, 1);
  assert.match(john14.verses.find((v) => v.verse === 6)?.text ?? "", /way, the truth, and the life/i);
  assert.match(john14.verses.find((v) => v.verse === 16)?.text ?? "", /Counselor|Comforter|Spirit/i);
  assert.match(john14.verses.find((v) => v.verse === 27)?.text ?? "", /Peace I leave with you/i);

  const kjv14 = await loadChapter("kjv", { book: "John", chapter: 14 });
  assert.ok(!("external" in kjv14));
  assert.ok(kjv14.verses.length >= 18);
  assert.match(kjv14.verses.find((v) => v.verse === 2)?.text ?? "", /mansions|Father's house/i);

  const asv14 = await loadChapter("asv", { book: "John", chapter: 14 });
  assert.ok(!("external" in asv14));
  assert.ok(asv14.verses.length >= 18);
  assert.match(asv14.verses.find((v) => v.verse === 17)?.text ?? "", /Spirit of truth/i);

  const cuvs14 = await loadChapter("cuvs", { book: "John", chapter: 14 });
  assert.ok(!("external" in cuvs14));
  assert.match(cuvs14.verses.find((v) => v.verse === 6)?.text ?? "", /道路|真理|生命/);
  const kougo14 = await loadChapter("kougo", { book: "John", chapter: 14 });
  assert.ok(!("external" in kougo14));
  assert.match(kougo14.verses.find((v) => v.verse === 6)?.text ?? "", /道であり|真理|命である/);

  const cuvt14 = await loadChapter("cuvt", { book: "John", chapter: 14 });
  assert.ok(!("external" in cuvt14));
  assert.match(cuvt14.verses.find((v) => v.verse === 6)?.text ?? "", /道路|真理|生命/);
  assert.match(cuvt14.verses.find((v) => v.verse === 1)?.text ?? "", /心裏|憂愁|你們/);

  for (const tid of ["rcuv", "ccb", "lzz"] as const) {
    const ch = await loadChapter(tid, { book: "John", chapter: 14 });
    assert.ok(!("external" in ch), tid);
    assert.match(ch.verses.find((v) => v.verse === 6)?.text ?? "", /道路|真理|生命/);
  }
  for (const tid of ["shinkaiyaku", "shinKyoudou"] as const) {
    const ch = await loadChapter(tid, { book: "John", chapter: 14 });
    assert.ok(!("external" in ch), tid);
    assert.match(ch.verses.find((v) => v.verse === 6)?.text ?? "", /道であり|真理|いのち|命である/);
  }

  const rom12 = await loadChapter("kjv", { book: "Romans", chapter: 12 });
  assert.ok(!("external" in rom12));
  assert.equal(rom12.book, "Rom");
  assert.ok(rom12.verses.length >= 21);
  assert.match(rom12.verses.find((v) => v.verse === 1)?.text ?? "", /living sacrifice/i);
  assert.match(rom12.verses.find((v) => v.verse === 21)?.text ?? "", /overcome evil with good/i);

  const webRom12 = await loadChapter("web", { book: "Rom", chapter: 12 });
  assert.ok(!("external" in webRom12));
  assert.ok(webRom12.verses.length >= 21);
  assert.match(webRom12.verses.find((v) => v.verse === 9)?.text ?? "", /without hypocrisy/i);

  const jn4 = await loadChapter("asv", { book: "1John", chapter: 4 });
  assert.ok(!("external" in jn4));
  assert.equal(jn4.book, "1John");
  assert.ok(jn4.verses.length >= 15);
  assert.equal(jn4.verses[0]?.verse, 7);
  assert.equal(jn4.verses[jn4.verses.length - 1]?.verse, 21);
  assert.match(jn4.verses.find((v) => v.verse === 8)?.text ?? "", /God is love/i);
  assert.match(jn4.verses.find((v) => v.verse === 18)?.text ?? "", /perfect love|casteth out fear|casts out fear/i);
  assert.match(jn4.verses.find((v) => v.verse === 19)?.text ?? "", /first loved us/i);

  const webJn4 = await loadChapter("web", { book: "1John", chapter: 4 });
  assert.ok(!("external" in webJn4));
  assert.ok(webJn4.verses.length >= 15);
  assert.match(webJn4.verses.find((v) => v.verse === 10)?.text ?? "", /atoning sacrifice|propitiation/i);

  const kjvJn4 = await loadChapter("kjv", { book: "1John", chapter: 4 });
  assert.ok(!("external" in kjvJn4));
  assert.ok(kjvJn4.verses.length >= 15);
  assert.match(kjvJn4.verses.find((v) => v.verse === 21)?.text ?? "", /love his brother/i);

  const cuvsJn4 = await loadChapter("cuvs", { book: "1John", chapter: 4 });
  assert.ok(!("external" in cuvsJn4));
  assert.match(cuvsJn4.verses.find((v) => v.verse === 8)?.text ?? "", /神就是爱/);
  const kougoJn4 = await loadChapter("kougo", { book: "1John", chapter: 4 });
  assert.ok(!("external" in kougoJn4));
  assert.match(kougoJn4.verses.find((v) => v.verse === 8)?.text ?? "", /神は愛である/);
});

test("loadChapter returns zh/ja Matthew.5 Beatitudes scaffolds (cuvs/kougo)", async () => {
  const cuvs5 = await loadChapter("cuvs", { book: "Matt", chapter: 5 });
  assert.ok(!("external" in cuvs5));
  assert.match(cuvs5.verses.find((v) => v.verse === 3)?.text ?? "", /虚心|有福/);
  assert.match(cuvs5.verses.find((v) => v.verse === 9)?.text ?? "", /和睦|神的儿子/);

  const kougo5 = await loadChapter("kougo", { book: "Matt", chapter: 5 });
  assert.ok(!("external" in kougo5));
  assert.match(kougo5.verses.find((v) => v.verse === 3)?.text ?? "", /心の貧しい|さいわい/);
  assert.match(kougo5.verses.find((v) => v.verse === 9)?.text ?? "", /平和|神の子/);
});

test("loadChapter returns ccb/lzz key-chapter scaffolds", async () => {
  for (const tid of ["ccb", "lzz"] as const) {
    const matt5 = await loadChapter(tid, { book: "Matt", chapter: 5 });
    assert.ok(!("external" in matt5), tid);
    assert.match(matt5.verses.find((v) => v.verse === 3)?.text ?? "", /有福|天国/);

    const rom8 = await loadChapter(tid, { book: "Rom", chapter: 8 });
    assert.ok(!("external" in rom8), tid);
    assert.match(rom8.verses.find((v) => v.verse === 1)?.text ?? "", /基督耶稣|不定罪|不被定罪/);

    const jn15 = await loadChapter(tid, { book: "John", chapter: 15 });
    assert.ok(!("external" in jn15), tid);
    assert.match(jn15.verses.find((v) => v.verse === 5)?.text ?? "", /葡萄树|枝子/);

    const jn4 = await loadChapter(tid, { book: "1John", chapter: 4 });
    assert.ok(!("external" in jn4), tid);
    assert.match(jn4.verses.find((v) => v.verse === 8)?.text ?? "", /上帝就是爱|神就是爱|上帝就是愛/);

    const ps23 = await loadChapter(tid, { book: "Ps", chapter: 23 });
    assert.ok(!("external" in ps23), tid);
    assert.match(ps23.verses.find((v) => v.verse === 1)?.text ?? "", /牧者|耶和华|永恒主/);
  }
});

test("loadChapter returns expanded rcuv key-chapter scaffolds", async () => {
  const matt5 = await loadChapter("rcuv", { book: "Matt", chapter: 5 });
  assert.ok(!("external" in matt5));
  assert.match(matt5.verses.find((v) => v.verse === 3)?.text ?? "", /虚心|有福|天国/);

  const rom8 = await loadChapter("rcuv", { book: "Rom", chapter: 8 });
  assert.ok(!("external" in rom8));
  assert.match(rom8.verses.find((v) => v.verse === 28)?.text ?? "", /万事|得益处/);

  const jn15 = await loadChapter("rcuv", { book: "John", chapter: 15 });
  assert.ok(!("external" in jn15));
  assert.match(jn15.verses.find((v) => v.verse === 5)?.text ?? "", /葡萄树|枝子/);

  const jn4 = await loadChapter("rcuv", { book: "1John", chapter: 4 });
  assert.ok(!("external" in jn4));
  assert.match(jn4.verses.find((v) => v.verse === 8)?.text ?? "", /神就是爱/);

  const ps23 = await loadChapter("rcuv", { book: "Ps", chapter: 23 });
  assert.ok(!("external" in ps23));
  assert.match(ps23.verses.find((v) => v.verse === 1)?.text ?? "", /耶和华|牧者/);
});

test("loadChapter returns shinkaiyaku/shinKyoudou key-chapter scaffolds", async () => {
  for (const tid of ["shinkaiyaku", "shinKyoudou"] as const) {
    const matt5 = await loadChapter(tid, { book: "Matt", chapter: 5 });
    assert.ok(!("external" in matt5), tid);
    assert.match(matt5.verses.find((v) => v.verse === 3)?.text ?? "", /心の貧しい|幸い|天/);

    const rom8 = await loadChapter(tid, { book: "Rom", chapter: 8 });
    assert.ok(!("external" in rom8), tid);
    assert.match(rom8.verses.find((v) => v.verse === 1)?.text ?? "", /キリスト・イエス|罪に定め/);

    const jn15 = await loadChapter(tid, { book: "John", chapter: 15 });
    assert.ok(!("external" in jn15), tid);
    assert.match(jn15.verses.find((v) => v.verse === 5)?.text ?? "", /ぶどうの木|枝/);

    const jn4 = await loadChapter(tid, { book: "1John", chapter: 4 });
    assert.ok(!("external" in jn4), tid);
    assert.match(jn4.verses.find((v) => v.verse === 8)?.text ?? "", /神は愛/);

    const ps23 = await loadChapter(tid, { book: "Ps", chapter: 23 });
    assert.ok(!("external" in ps23), tid);
    assert.match(ps23.verses.find((v) => v.verse === 1)?.text ?? "", /羊飼い|牧者|欠けることがない|乏しい/);
  }
});

test("loadChapter returns expanded cuvt key-chapter scaffolds", async () => {
  const matt5 = await loadChapter("cuvt", { book: "Matt", chapter: 5 });
  assert.ok(!("external" in matt5));
  assert.match(matt5.verses.find((v) => v.verse === 3)?.text ?? "", /虛心|有福|天國/);

  const matt6 = await loadChapter("cuvt", { book: "Matt", chapter: 6 });
  assert.ok(!("external" in matt6));
  assert.match(matt6.verses.find((v) => v.verse === 9)?.text ?? "", /禱告|天上的父/);

  const gen1 = await loadChapter("cuvt", { book: "Gen", chapter: 1 });
  assert.ok(!("external" in gen1));
  assert.match(gen1.verses.find((v) => v.verse === 1)?.text ?? "", /創造天地/);

  const ps23 = await loadChapter("cuvt", { book: "Ps", chapter: 23 });
  assert.ok(!("external" in ps23));
  assert.match(ps23.verses.find((v) => v.verse === 1)?.text ?? "", /耶和華|牧者/);

  const rom8 = await loadChapter("cuvt", { book: "Rom", chapter: 8 });
  assert.ok(!("external" in rom8));
  assert.match(rom8.verses.find((v) => v.verse === 28)?.text ?? "", /萬事|得益處/);

  const rom12 = await loadChapter("cuvt", { book: "Rom", chapter: 12 });
  assert.ok(!("external" in rom12));
  assert.match(rom12.verses.find((v) => v.verse === 1)?.text ?? "", /活祭|聖潔/);

  const jn15 = await loadChapter("cuvt", { book: "John", chapter: 15 });
  assert.ok(!("external" in jn15));
  assert.match(jn15.verses.find((v) => v.verse === 5)?.text ?? "", /葡萄樹|枝子/);

  const jn4 = await loadChapter("cuvt", { book: "1John", chapter: 4 });
  assert.ok(!("external" in jn4));
  assert.match(jn4.verses.find((v) => v.verse === 8)?.text ?? "", /神就是愛/);
});
