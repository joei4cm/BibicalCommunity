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
  assert.ok(result.verses.length >= 14);
  assert.equal(result.verses[0]?.verse, 1);
  assert.match(result.verses[0]?.text ?? "", /In the beginning was the Word/);
  assert.match(result.verses.find((v) => v.verse === 14)?.text ?? "", /Word became flesh|grace and truth/i);
});

test("loadChapter returns verses for kjv John.1", async () => {
  const result = await loadChapter("kjv", { book: "John", chapter: 1 });
  assert.ok(!("external" in result));
  assert.equal(result.source, "local");
  assert.equal(result.translationId, "kjv");
  assert.equal(result.chapter, 1);
  assert.ok(result.verses.length >= 14);
  assert.equal(result.verses[0]?.verse, 1);
  assert.match(result.verses[0]?.text ?? "", /In the beginning was the Word/);
  assert.match(result.verses.find((v) => v.verse === 5)?.text ?? "", /comprehended/);
  assert.match(result.verses.find((v) => v.verse === 14)?.text ?? "", /Word was made flesh|grace and truth/i);
});

test("loadChapter returns verses for asv John.1", async () => {
  const result = await loadChapter("asv", { book: "John", chapter: 1 });
  assert.ok(!("external" in result));
  assert.equal(result.source, "local");
  assert.equal(result.translationId, "asv");
  assert.equal(result.chapter, 1);
  assert.ok(result.verses.length >= 14);
  assert.equal(result.verses[0]?.verse, 1);
  assert.match(result.verses[0]?.text ?? "", /In the beginning was the Word/);
  assert.match(result.verses.find((v) => v.verse === 14)?.text ?? "", /Word became flesh|grace and truth/i);
});

test("loadChapter returns verses for web John.2 (wedding at Cana)", async () => {
  const result = await loadChapter("web", { book: "John", chapter: 2 });
  assert.ok(!("external" in result));
  assert.equal(result.source, "local");
  assert.equal(result.chapter, 2);
  assert.ok(result.verses.length >= 25);
  assert.equal(result.verses[0]?.verse, 1);
  assert.equal(result.verses[result.verses.length - 1]?.verse, 25);
  assert.match(result.verses[0]?.text ?? "", /wedding in Cana/);
  assert.match(result.verses.find((v) => v.verse === 11)?.text ?? "", /beginning of his signs/);
  assert.match(result.verses.find((v) => v.verse === 16)?.text ?? "", /Father's house|marketplace/i);
  assert.match(result.verses.find((v) => v.verse === 19)?.text ?? "", /Destroy this temple|three days/i);
  assert.match(result.verses.find((v) => v.verse === 25)?.text ?? "", /knew what was in man/i);
});

test("loadChapter returns verses for web John.3 (chapter switch)", async () => {
  const result = await loadChapter("web", { book: "John", chapter: 3 });
  assert.ok(!("external" in result));
  assert.equal(result.chapter, 3);
  assert.ok(result.verses.length >= 36);
  assert.equal(result.verses[0]?.verse, 1);
  assert.equal(result.verses[result.verses.length - 1]?.verse, 36);
  assert.match(result.verses.find((v) => v.verse === 16)?.text ?? "", /God so loved the world/);
  assert.match(result.verses.find((v) => v.verse === 5)?.text ?? "", /born of water and spirit/i);
  assert.match(result.verses.find((v) => v.verse === 30)?.text ?? "", /increase|decrease/i);
  assert.match(result.verses.find((v) => v.verse === 36)?.text ?? "", /eternal life|wrath of God/i);
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

test("loadChapter returns denser kougoyaku-pd John.3 scaffold", async () => {
  const result = await loadChapter("kougoyaku-pd", { book: "John", chapter: 3 });
  assert.ok(!("external" in result));
  assert.ok(result.verses.length >= 36);
  assert.equal(result.verses[result.verses.length - 1]?.verse, 36);
  assert.match(result.verses.find((v) => v.verse === 16)?.text ?? "", /獨り子|永遠の生命|世を愛/);
  assert.match(result.verses.find((v) => v.verse === 30)?.text ?? "", /増し|減ず/);
  assert.match(result.verses.find((v) => v.verse === 36)?.text ?? "", /永遠の生命|怒/);
});

test("loadChapter returns verses for kougoyaku-pd John.1", async () => {
  const result = await loadChapter("kougoyaku-pd", { book: "John", chapter: 1 });
  assert.ok(!("external" in result));
  assert.equal(result.source, "local");
  assert.ok(result.verses.length >= 14);
  assert.match(result.verses[0]?.text ?? "", /太初に言あり/);
  assert.match(result.verses.find((v) => v.verse === 14)?.text ?? "", /言は肉となり|榮光|恩と眞/);
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
  assert.ok(result.verses.length >= 14);
  assert.match(result.verses[0]?.text ?? "", /样例|太初有道/);
  assert.match(result.verses.find((v) => v.verse === 14)?.text ?? "", /样例|道成了肉身|恩典和真理|荣光/);
});

test("loadChapter returns cuvs/kougo/kjv/asv John.2 scaffolds", async () => {
  const cuvs = await loadChapter("cuvs", { book: "John", chapter: 2 });
  assert.ok(!("external" in cuvs));
  assert.ok(cuvs.verses.length >= 25);
  assert.equal(cuvs.verses[cuvs.verses.length - 1]?.verse, 25);
  assert.match(cuvs.verses[0]?.text ?? "", /样例|迦拿|娶亲/);
  assert.match(cuvs.verses.find((v) => v.verse === 11)?.text ?? "", /样例|神迹|荣耀|门徒/);
  assert.match(cuvs.verses.find((v) => v.verse === 16)?.text ?? "", /父的殿|买卖/);
  assert.match(cuvs.verses.find((v) => v.verse === 19)?.text ?? "", /拆毁这殿|三日内/);
  assert.match(cuvs.verses.find((v) => v.verse === 25)?.text ?? "", /人心/);

  const kougo = await loadChapter("kougo", { book: "John", chapter: 2 });
  assert.ok(!("external" in kougo));
  assert.ok(kougo.verses.length >= 25);
  assert.equal(kougo.verses[kougo.verses.length - 1]?.verse, 25);
  assert.match(kougo.verses[0]?.text ?? "", /見本|カナ|婚礼/);
  assert.match(kougo.verses.find((v) => v.verse === 11)?.text ?? "", /見本|しるし|栄光|信じ/);
  assert.match(kougo.verses.find((v) => v.verse === 16)?.text ?? "", /父の家|商売/);
  assert.match(kougo.verses.find((v) => v.verse === 19)?.text ?? "", /神殿をこわしたら|三日/);
  assert.match(kougo.verses.find((v) => v.verse === 25)?.text ?? "", /心の中/);

  const kjv = await loadChapter("kjv", { book: "John", chapter: 2 });
  assert.ok(!("external" in kjv));
  assert.ok(kjv.verses.length >= 25);
  assert.match(kjv.verses[0]?.text ?? "", /Cana/i);
  assert.match(kjv.verses.find((v) => v.verse === 11)?.text ?? "", /beginning of miracles|manifested.*glory/i);
  assert.match(kjv.verses.find((v) => v.verse === 19)?.text ?? "", /Destroy this temple|three days/i);

  const asv = await loadChapter("asv", { book: "John", chapter: 2 });
  assert.ok(!("external" in asv));
  assert.ok(asv.verses.length >= 25);
  assert.match(asv.verses[0]?.text ?? "", /Cana/i);
  assert.match(asv.verses.find((v) => v.verse === 5)?.text ?? "", /Whatsoever he saith|do it/i);
  assert.match(asv.verses.find((v) => v.verse === 25)?.text ?? "", /knew what was in man/i);
});

test("loadChapter returns expanded zh/ja John.2 scaffolds", async () => {
  const cuvt = await loadChapter("cuvt", { book: "John", chapter: 2 });
  assert.ok(!("external" in cuvt));
  assert.ok(cuvt.verses.length >= 25);
  assert.match(cuvt.verses[0]?.text ?? "", /樣例|迦拿|娶親/);
  assert.match(cuvt.verses.find((v) => v.verse === 11)?.text ?? "", /神蹟|榮耀/);
  assert.match(cuvt.verses.find((v) => v.verse === 25)?.text ?? "", /心裏|人心/);

  const rcuv = await loadChapter("rcuv", { book: "John", chapter: 2 });
  assert.ok(!("external" in rcuv));
  assert.ok(rcuv.verses.length >= 25);
  assert.match(rcuv.verses[0]?.text ?? "", /样例|迦拿|娶亲/);

  const ccb = await loadChapter("ccb", { book: "John", chapter: 2 });
  assert.ok(!("external" in ccb));
  assert.ok(ccb.verses.length >= 25);
  assert.match(ccb.verses[0]?.text ?? "", /样例|迦拿|婚宴|娶亲/);

  const lzz = await loadChapter("lzz", { book: "John", chapter: 2 });
  assert.ok(!("external" in lzz));
  assert.ok(lzz.verses.length >= 25);
  assert.match(lzz.verses[0]?.text ?? "", /样例|迦拿|婚筵/);

  const shinkaiyaku = await loadChapter("shinkaiyaku", { book: "John", chapter: 2 });
  assert.ok(!("external" in shinkaiyaku));
  assert.ok(shinkaiyaku.verses.length >= 25);
  assert.match(shinkaiyaku.verses[0]?.text ?? "", /見本|カナ|婚礼|婚宴/);

  const shinKyoudou = await loadChapter("shinKyoudou", { book: "John", chapter: 2 });
  assert.ok(!("external" in shinKyoudou));
  assert.ok(shinKyoudou.verses.length >= 25);
  assert.match(shinKyoudou.verses[0]?.text ?? "", /見本|カナ|婚礼/);

  const kougoyakuPd = await loadChapter("kougoyaku-pd", { book: "John", chapter: 2 });
  assert.ok(!("external" in kougoyakuPd));
  assert.ok(kougoyakuPd.verses.length >= 25);
  assert.equal(kougoyakuPd.verses[kougoyakuPd.verses.length - 1]?.verse, 25);
  assert.match(kougoyakuPd.verses[0]?.text ?? "", /カナ|婚筵/);
});

test("loadChapter returns zh/ja John.3 scaffolds (includes 3:16)", async () => {
  const cuvs = await loadChapter("cuvs", { book: "John", chapter: 3 });
  assert.ok(!("external" in cuvs));
  assert.equal(cuvs.chapter, 3);
  assert.ok(cuvs.verses.length >= 36);
  assert.equal(cuvs.verses[cuvs.verses.length - 1]?.verse, 36);
  assert.match(cuvs.verses[0]?.text ?? "", /尼哥底母|法利赛/);
  assert.match(cuvs.verses.find((v) => v.verse === 3)?.text ?? "", /重生|神的国/);
  assert.match(cuvs.verses.find((v) => v.verse === 16)?.text ?? "", /神爱世人|独生子/);
  assert.match(cuvs.verses.find((v) => v.verse === 30)?.text ?? "", /兴旺|衰微/);
  assert.match(cuvs.verses.find((v) => v.verse === 36)?.text ?? "", /永生|震怒/);

  const cuvt = await loadChapter("cuvt", { book: "John", chapter: 3 });
  assert.ok(!("external" in cuvt));
  assert.ok(cuvt.verses.length >= 36);
  assert.match(cuvt.verses.find((v) => v.verse === 16)?.text ?? "", /神愛世人|獨生子/);
  assert.match(cuvt.verses.find((v) => v.verse === 36)?.text ?? "", /永生|震怒/);

  const rcuv = await loadChapter("rcuv", { book: "John", chapter: 3 });
  assert.ok(!("external" in rcuv));
  assert.ok(rcuv.verses.length >= 36);
  assert.match(rcuv.verses.find((v) => v.verse === 16)?.text ?? "", /神爱世人|独生子/);

  const ccb = await loadChapter("ccb", { book: "John", chapter: 3 });
  assert.ok(!("external" in ccb));
  assert.ok(ccb.verses.length >= 36);
  assert.match(ccb.verses.find((v) => v.verse === 16)?.text ?? "", /上帝深爱世人|独生子/);

  const lzz = await loadChapter("lzz", { book: "John", chapter: 3 });
  assert.ok(!("external" in lzz));
  assert.ok(lzz.verses.length >= 36);
  assert.match(lzz.verses.find((v) => v.verse === 16)?.text ?? "", /上帝这样地爱了世人|独生子/);

  const kougo = await loadChapter("kougo", { book: "John", chapter: 3 });
  assert.ok(!("external" in kougo));
  assert.ok(kougo.verses.length >= 36);
  assert.match(kougo.verses[0]?.text ?? "", /ニコデモ/);
  assert.match(kougo.verses.find((v) => v.verse === 16)?.text ?? "", /ひとり子|永遠の命/);
  assert.match(kougo.verses.find((v) => v.verse === 30)?.text ?? "", /栄え|衰える/);
  assert.match(kougo.verses.find((v) => v.verse === 36)?.text ?? "", /永遠の命|怒り/);

  const shinkaiyaku = await loadChapter("shinkaiyaku", { book: "John", chapter: 3 });
  assert.ok(!("external" in shinkaiyaku));
  assert.ok(shinkaiyaku.verses.length >= 36);
  assert.match(shinkaiyaku.verses.find((v) => v.verse === 16)?.text ?? "", /ひとり子|永遠のいのち/);

  const shinKyoudou = await loadChapter("shinKyoudou", { book: "John", chapter: 3 });
  assert.ok(!("external" in shinKyoudou));
  assert.ok(shinKyoudou.verses.length >= 36);
  assert.match(shinKyoudou.verses.find((v) => v.verse === 16)?.text ?? "", /独り子|永遠の命/);

  const kougoyakuPd = await loadChapter("kougoyaku-pd", { book: "John", chapter: 3 });
  assert.ok(!("external" in kougoyakuPd));
  assert.ok(kougoyakuPd.verses.length >= 36);
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
  assert.ok(web.verses.length >= 31);
  assert.match(web.verses[0]?.text ?? "", /In the beginning.*God created/);
  assert.match(web.verses.find((v) => v.verse === 27)?.text ?? "", /image|male and female/i);
  assert.match(web.verses.find((v) => v.verse === 31)?.text ?? "", /very good|sixth day/i);
  assert.match(web.verses.find((v) => v.verse === 13)?.text ?? "", /third day/i);

  const kjv = await loadChapter("kjv", { book: "Genesis", chapter: 1 });
  assert.ok(!("external" in kjv));
  assert.ok(kjv.verses.length >= 31);
  assert.match(kjv.verses[0]?.text ?? "", /In the beginning God created/);
  assert.match(kjv.verses.find((v) => v.verse === 3)?.text ?? "", /Let there be light/);

  const asv = await loadChapter("asv", { book: "Gen", chapter: 1 });
  assert.ok(!("external" in asv));
  assert.ok(asv.verses.length >= 31);
  assert.match(asv.verses[0]?.text ?? "", /heavens and the earth|heaven and the earth/i);
  assert.match(asv.verses.find((v) => v.verse === 2)?.text ?? "", /waste and void|Spirit of God/);
});

test("loadChapter returns PD Matthew.5 scaffolds (web/kjv/asv)", async () => {
  const web = await loadChapter("web", { book: "Matt", chapter: 5 });
  assert.ok(!("external" in web));
  assert.equal(web.book, "Matt");
  assert.equal(web.chapter, 5);
  assert.ok(web.verses.length >= 48);
  assert.equal(web.verses[0]?.verse, 1);
  assert.equal(web.verses[web.verses.length - 1]?.verse, 48);
  assert.match(web.verses.find((v) => v.verse === 3)?.text ?? "", /poor in spirit/i);
  assert.match(web.verses.find((v) => v.verse === 9)?.text ?? "", /peacemakers|children of God/i);
  assert.match(web.verses.find((v) => v.verse === 13)?.text ?? "", /salt of the earth/i);
  assert.match(web.verses.find((v) => v.verse === 14)?.text ?? "", /light of the world/i);
  assert.match(web.verses.find((v) => v.verse === 44)?.text ?? "", /love your enemies/i);
  assert.match(web.verses.find((v) => v.verse === 48)?.text ?? "", /perfect/i);

  const kjv = await loadChapter("kjv", { book: "Matthew", chapter: 5 });
  assert.ok(!("external" in kjv));
  assert.ok(kjv.verses.length >= 48);
  assert.equal(kjv.verses[kjv.verses.length - 1]?.verse, 48);
  assert.match(kjv.verses.find((v) => v.verse === 5)?.text ?? "", /meek|inherit the earth/i);
  assert.match(kjv.verses.find((v) => v.verse === 48)?.text ?? "", /perfect/i);

  const asv = await loadChapter("asv", { book: "Matt", chapter: 5 });
  assert.ok(!("external" in asv));
  assert.ok(asv.verses.length >= 48);
  assert.equal(asv.verses[asv.verses.length - 1]?.verse, 48);
  assert.match(asv.verses.find((v) => v.verse === 4)?.text ?? "", /mourn|comforted/i);
  assert.match(asv.verses.find((v) => v.verse === 48)?.text ?? "", /perfect/i);
});

test("loadChapter returns Psalm.23 scaffolds (web/kjv/asv + zh/ja)", async () => {
  const web = await loadChapter("web", { book: "Ps", chapter: 23 });
  assert.ok(!("external" in web));
  assert.equal(web.book, "Ps");
  assert.ok(web.verses.length >= 6);
  assert.match(web.verses[0]?.text ?? "", /shepherd/i);
  assert.match(web.verses.find((v) => v.verse === 6)?.text ?? "", /dwell|forever|house/i);

  const kjv = await loadChapter("kjv", { book: "Psalm", chapter: 23 });
  assert.ok(!("external" in kjv));
  assert.ok(kjv.verses.length >= 6);
  assert.match(kjv.verses[0]?.text ?? "", /LORD is my shepherd/i);
  assert.match(kjv.verses.find((v) => v.verse === 6)?.text ?? "", /house of the LORD|for ever/i);

  const asv = await loadChapter("asv", { book: "Psalms", chapter: 23 });
  assert.ok(!("external" in asv));
  assert.ok(asv.verses.length >= 6);
  assert.match(asv.verses[0]?.text ?? "", /Jehovah is my shepherd/i);

  const cuvs = await loadChapter("cuvs", { book: "Ps", chapter: 23 });
  assert.ok(!("external" in cuvs));
  assert.ok(cuvs.verses.length >= 6);
  assert.match(cuvs.verses[0]?.text ?? "", /样例|牧者/);
  assert.match(cuvs.verses.find((v) => v.verse === 6)?.text ?? "", /恩惠慈爱|耶和华的殿/);

  const cuvt = await loadChapter("cuvt", { book: "Ps", chapter: 23 });
  assert.ok(!("external" in cuvt));
  assert.ok(cuvt.verses.length >= 6);
  assert.match(cuvt.verses.find((v) => v.verse === 6)?.text ?? "", /恩惠慈愛|耶和華的殿/);

  const kougo = await loadChapter("kougo", { book: "Ps", chapter: 23 });
  assert.ok(!("external" in kougo));
  assert.ok(kougo.verses.length >= 6);
  assert.match(kougo.verses[0]?.text ?? "", /見本|牧者/);
  assert.match(kougo.verses.find((v) => v.verse === 6)?.text ?? "", /主の家|いつまでも/);
});

test("loadChapter returns zh/ja Genesis.1 scaffolds", async () => {
  const cuvs = await loadChapter("cuvs", { book: "Gen", chapter: 1 });
  assert.ok(!("external" in cuvs));
  assert.equal(cuvs.book, "Gen");
  assert.ok(cuvs.verses.length >= 31);
  assert.match(cuvs.verses[0]?.text ?? "", /样例|起初|创造/);
  assert.match(cuvs.verses.find((v) => v.verse === 13)?.text ?? "", /第三日/);
  assert.match(cuvs.verses.find((v) => v.verse === 27)?.text ?? "", /样例|形像|造男造女/);
  assert.match(cuvs.verses.find((v) => v.verse === 31)?.text ?? "", /样例|甚好|第六日/);

  const kougo = await loadChapter("kougo", { book: "Gen", chapter: 1 });
  assert.ok(!("external" in kougo));
  assert.ok(kougo.verses.length >= 31);
  assert.match(kougo.verses[0]?.text ?? "", /見本|創造|はじめに/);
  assert.match(kougo.verses.find((v) => v.verse === 13)?.text ?? "", /第三日/);
});

test("loadChapter returns PD Romans.8 scaffolds (web/kjv/asv)", async () => {
  const web = await loadChapter("web", { book: "Rom", chapter: 8 });
  assert.ok(!("external" in web));
  assert.equal(web.source, "local");
  assert.equal(web.book, "Rom");
  assert.equal(web.chapter, 8);
  assert.ok(web.verses.length >= 39);
  assert.equal(web.verses[0]?.verse, 1);
  assert.equal(web.verses[web.verses.length - 1]?.verse, 39);
  assert.match(web.verses[0]?.text ?? "", /no condemnation/i);
  assert.match(web.verses.find((v) => v.verse === 14)?.text ?? "", /led by the Spirit/i);
  assert.match(web.verses.find((v) => v.verse === 18)?.text ?? "", /sufferings.*glory|glory.*revealed/i);
  assert.match(web.verses.find((v) => v.verse === 26)?.text ?? "", /Spirit.*helps|intercession|groanings/i);
  assert.match(web.verses.find((v) => v.verse === 28)?.text ?? "", /work together for good/i);
  assert.match(web.verses.find((v) => v.verse === 37)?.text ?? "", /more than conquerors/i);
  assert.match(web.verses.find((v) => v.verse === 39)?.text ?? "", /separate.*love|Christ Jesus our Lord/i);

  const kjv = await loadChapter("kjv", { book: "Romans", chapter: 8 });
  assert.ok(!("external" in kjv));
  assert.equal(kjv.book, "Rom");
  assert.ok(kjv.verses.length >= 39);
  assert.equal(kjv.verses[kjv.verses.length - 1]?.verse, 39);
  assert.match(kjv.verses.find((v) => v.verse === 15)?.text ?? "", /Abba/i);
  assert.match(kjv.verses.find((v) => v.verse === 31)?.text ?? "", /If God be for us/i);
  assert.match(kjv.verses.find((v) => v.verse === 37)?.text ?? "", /more than conquerors/i);

  const asv = await loadChapter("asv", { book: "rom", chapter: 8 });
  assert.ok(!("external" in asv));
  assert.ok(asv.verses.length >= 39);
  assert.equal(asv.verses[asv.verses.length - 1]?.verse, 39);
  assert.match(asv.verses.find((v) => v.verse === 16)?.text ?? "", /children of God/i);
  assert.match(asv.verses.find((v) => v.verse === 39)?.text ?? "", /love of God/i);
});

test("loadChapter returns PD Hebrews.11 scaffolds (web/kjv/asv)", async () => {
  const web = await loadChapter("web", { book: "Heb", chapter: 11 });
  assert.ok(!("external" in web));
  assert.equal(web.book, "Heb");
  assert.equal(web.chapter, 11);
  assert.ok(web.verses.length >= 40);
  assert.equal(web.verses[0]?.verse, 1);
  assert.equal(web.verses[web.verses.length - 1]?.verse, 40);
  assert.match(web.verses[0]?.text ?? "", /faith is assurance|hoped for/i);
  assert.match(web.verses.find((v) => v.verse === 8)?.text ?? "", /Abraham/i);
  assert.match(web.verses.find((v) => v.verse === 40)?.text ?? "", /better thing|apart from us|made perfect/i);

  const kjv = await loadChapter("kjv", { book: "Hebrews", chapter: 11 });
  assert.ok(!("external" in kjv));
  assert.ok(kjv.verses.length >= 40);
  assert.match(kjv.verses[0]?.text ?? "", /substance of things hoped for/i);
  assert.match(kjv.verses.find((v) => v.verse === 6)?.text ?? "", /impossible to please/i);
  assert.match(kjv.verses.find((v) => v.verse === 7)?.text ?? "", /Noah/i);
  assert.match(kjv.verses.find((v) => v.verse === 29)?.text ?? "", /Red sea/i);

  const asv = await loadChapter("asv", { book: "heb", chapter: 11 });
  assert.ok(!("external" in asv));
  assert.ok(asv.verses.length >= 40);
  assert.match(asv.verses[0]?.text ?? "", /assurance of things hoped for/i);
  assert.match(asv.verses.find((v) => v.verse === 5)?.text ?? "", /Enoch/i);
  assert.match(asv.verses.find((v) => v.verse === 40)?.text ?? "", /better thing|apart from us|made perfect/i);
});

test("loadChapter returns zh/ja Romans.8 and Hebrews.11 scaffolds", async () => {
  const cuvsRom = await loadChapter("cuvs", { book: "Rom", chapter: 8 });
  assert.ok(!("external" in cuvsRom));
  assert.equal(cuvsRom.book, "Rom");
  assert.ok(cuvsRom.verses.length >= 39);
  assert.equal(cuvsRom.verses[cuvsRom.verses.length - 1]?.verse, 39);
  assert.match(cuvsRom.verses[0]?.text ?? "", /样例|不定罪/);
  assert.match(cuvsRom.verses.find((v) => v.verse === 14)?.text ?? "", /神的儿子|被神的灵/);
  assert.match(cuvsRom.verses.find((v) => v.verse === 18)?.text ?? "", /苦楚|荣耀/);
  assert.match(cuvsRom.verses.find((v) => v.verse === 26)?.text ?? "", /圣灵|祷告|叹息/);
  assert.match(cuvsRom.verses.find((v) => v.verse === 28)?.text ?? "", /万事都互相效力|爱神的人/);
  assert.match(cuvsRom.verses.find((v) => v.verse === 37)?.text ?? "", /得胜有余/);
  assert.match(cuvsRom.verses.find((v) => v.verse === 39)?.text ?? "", /隔绝|基督耶稣/);

  const kougoRom = await loadChapter("kougo", { book: "Romans", chapter: 8 });
  assert.ok(!("external" in kougoRom));
  assert.ok(kougoRom.verses.length >= 39);
  assert.equal(kougoRom.verses[kougoRom.verses.length - 1]?.verse, 39);
  assert.match(kougoRom.verses[0]?.text ?? "", /見本|罪に定められることがない/);
  assert.match(kougoRom.verses.find((v) => v.verse === 15)?.text ?? "", /アバ|父よ/);
  assert.match(kougoRom.verses.find((v) => v.verse === 26)?.text ?? "", /御霊|とりなし|うめき/);
  assert.match(kougoRom.verses.find((v) => v.verse === 37)?.text ?? "", /勝ち得て余り/);
  assert.match(kougoRom.verses.find((v) => v.verse === 39)?.text ?? "", /引き離す|神の愛/);

  const cuvsHeb = await loadChapter("cuvs", { book: "Heb", chapter: 11 });
  assert.ok(!("external" in cuvsHeb));
  assert.equal(cuvsHeb.book, "Heb");
  assert.ok(cuvsHeb.verses.length >= 40);
  assert.match(cuvsHeb.verses[0]?.text ?? "", /样例|信就是|实底/);
  assert.match(cuvsHeb.verses.find((v) => v.verse === 8)?.text ?? "", /亚伯拉罕/);
  assert.match(cuvsHeb.verses.find((v) => v.verse === 40)?.text ?? "", /样例|更美的事|完全/);

  const kougoHeb = await loadChapter("kougo", { book: "Hebrews", chapter: 11 });
  assert.ok(!("external" in kougoHeb));
  assert.ok(kougoHeb.verses.length >= 40);
  assert.match(kougoHeb.verses[0]?.text ?? "", /見本|信仰とは/);
  assert.match(kougoHeb.verses.find((v) => v.verse === 7)?.text ?? "", /ノア/);
  assert.match(kougoHeb.verses.find((v) => v.verse === 40)?.text ?? "", /見本|すぐれた|全う/);
});

test("loadChapter returns zh/ja Romans.12 scaffolds", async () => {
  const cuvs = await loadChapter("cuvs", { book: "Rom", chapter: 12 });
  assert.ok(!("external" in cuvs));
  assert.ok(cuvs.verses.length >= 21);
  assert.match(cuvs.verses.find((v) => v.verse === 1)?.text ?? "", /活祭/);
  assert.match(cuvs.verses.find((v) => v.verse === 9)?.text ?? "", /爱人不可虚假|恶要厌恶/);
  assert.match(cuvs.verses.find((v) => v.verse === 21)?.text ?? "", /以善胜恶/);

  const cuvt = await loadChapter("cuvt", { book: "Rom", chapter: 12 });
  assert.ok(!("external" in cuvt));
  assert.ok(cuvt.verses.length >= 21);
  assert.match(cuvt.verses.find((v) => v.verse === 1)?.text ?? "", /活祭|聖潔/);
  assert.match(cuvt.verses.find((v) => v.verse === 21)?.text ?? "", /以善勝惡/);

  const rcuv = await loadChapter("rcuv", { book: "Rom", chapter: 12 });
  assert.ok(!("external" in rcuv));
  assert.ok(rcuv.verses.length >= 21);
  assert.match(rcuv.verses.find((v) => v.verse === 21)?.text ?? "", /以善胜恶/);

  const ccb = await loadChapter("ccb", { book: "Rom", chapter: 12 });
  assert.ok(!("external" in ccb));
  assert.ok(ccb.verses.length >= 21);
  assert.match(ccb.verses.find((v) => v.verse === 1)?.text ?? "", /活祭|上帝/);

  const lzz = await loadChapter("lzz", { book: "Rom", chapter: 12 });
  assert.ok(!("external" in lzz));
  assert.ok(lzz.verses.length >= 21);
  assert.match(lzz.verses.find((v) => v.verse === 21)?.text ?? "", /以善胜恶|善胜恶/);

  const kougo = await loadChapter("kougo", { book: "Romans", chapter: 12 });
  assert.ok(!("external" in kougo));
  assert.ok(kougo.verses.length >= 21);
  assert.match(kougo.verses.find((v) => v.verse === 2)?.text ?? "", /造りかえられ|心を新たに/);
  assert.match(kougo.verses.find((v) => v.verse === 21)?.text ?? "", /善をもって悪に勝ち/);

  const shinkaiyaku = await loadChapter("shinkaiyaku", { book: "Rom", chapter: 12 });
  assert.ok(!("external" in shinkaiyaku));
  assert.ok(shinkaiyaku.verses.length >= 21);
  assert.match(shinkaiyaku.verses.find((v) => v.verse === 21)?.text ?? "", /善をもって悪に勝ち|悪に負けては/);

  const shinKyoudou = await loadChapter("shinKyoudou", { book: "Rom", chapter: 12 });
  assert.ok(!("external" in shinKyoudou));
  assert.ok(shinKyoudou.verses.length >= 21);
  assert.match(shinKyoudou.verses.find((v) => v.verse === 21)?.text ?? "", /善をもって悪に勝ち|悪に負けては/);
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
  assert.ok(web.verses.length >= 47);
  assert.equal(web.verses[0]?.verse, 1);
  assert.equal(web.verses[web.verses.length - 1]?.verse, 47);
  assert.match(web.verses[0]?.text ?? "", /Pentecost/i);
  assert.match(web.verses.find((v) => v.verse === 4)?.text ?? "", /Holy Spirit|other languages/i);
  assert.match(web.verses.find((v) => v.verse === 38)?.text ?? "", /Repent.*baptized|Holy Spirit/i);
  assert.match(web.verses.find((v) => v.verse === 47)?.text ?? "", /praising God|added to the assembly|day by day/i);

  const kjv = await loadChapter("kjv", { book: "Acts", chapter: 2 });
  assert.ok(!("external" in kjv));
  assert.ok(kjv.verses.length >= 47);
  assert.match(kjv.verses.find((v) => v.verse === 38)?.text ?? "", /Repent.*baptized|Holy Ghost/i);
  assert.match(kjv.verses.find((v) => v.verse === 41)?.text ?? "", /three thousand/i);

  const asv = await loadChapter("asv", { book: "acts", chapter: 2 });
  assert.ok(!("external" in asv));
  assert.ok(asv.verses.length >= 47);
  assert.match(asv.verses.find((v) => v.verse === 2)?.text ?? "", /rushing of a mighty wind/i);
  assert.match(asv.verses.find((v) => v.verse === 47)?.text ?? "", /praising God|added to them day by day/i);
});

test("loadChapter returns zh/ja Isaiah.53 and Acts.2 scaffolds", async () => {
  const cuvsIsa = await loadChapter("cuvs", { book: "Isa", chapter: 53 });
  assert.ok(!("external" in cuvsIsa));
  assert.equal(cuvsIsa.book, "Isa");
  assert.ok(cuvsIsa.verses.length >= 12);
  assert.match(cuvsIsa.verses[0]?.text ?? "", /样例|我们所传的|膀臂/);
  assert.match(cuvsIsa.verses.find((v) => v.verse === 5)?.text ?? "", /过犯|鞭伤|医治/);
  assert.match(cuvsIsa.verses.find((v) => v.verse === 12)?.text ?? "", /代求|罪犯/);

  const kougoIsa = await loadChapter("kougo", { book: "Isaiah", chapter: 53 });
  assert.ok(!("external" in kougoIsa));
  assert.match(kougoIsa.verses[0]?.text ?? "", /見本|信じ得たか|主の腕/);

  const cuvsActs = await loadChapter("cuvs", { book: "Acts", chapter: 2 });
  assert.ok(!("external" in cuvsActs));
  assert.equal(cuvsActs.book, "Acts");
  assert.ok(cuvsActs.verses.length >= 47);
  assert.equal(cuvsActs.verses[cuvsActs.verses.length - 1]?.verse, 47);
  assert.match(cuvsActs.verses[0]?.text ?? "", /样例|五旬节/);
  assert.match(cuvsActs.verses.find((v) => v.verse === 38)?.text ?? "", /样例|悔改|受洗|圣灵/);
  assert.match(cuvsActs.verses.find((v) => v.verse === 47)?.text ?? "", /样例|赞美神|得救的人|天天加给/);

  const kougoActs = await loadChapter("kougo", { book: "Acts", chapter: 2 });
  assert.ok(!("external" in kougoActs));
  assert.ok(kougoActs.verses.length >= 47);
  assert.equal(kougoActs.verses[kougoActs.verses.length - 1]?.verse, 47);
  assert.match(kougoActs.verses[0]?.text ?? "", /見本|五旬節/);
  assert.match(kougoActs.verses.find((v) => v.verse === 47)?.text ?? "", /見本|さんび|日々|救われる者/);
});

test("loadChapter returns licensed-peer pastoral Gal.5 / Phil.4 / 1Cor.13 / Eph.2 / Col.3 / Jas.1 / Matt.28 / Rev.21 scaffolds", async () => {
  const peers = ["cuvt", "rcuv", "ccb", "lzz", "shinkaiyaku", "shinKyoudou"] as const;
  for (const tid of peers) {
    const gal = await loadChapter(tid, { book: "Gal", chapter: 5 });
    assert.ok(!("external" in gal), tid);
    assert.ok(gal.verses.length >= 26, tid);
    assert.equal(gal.verses[0]?.verse, 1, tid);
    assert.equal(gal.verses[gal.verses.length - 1]?.verse, 26, tid);
    assert.match(gal.verses.find((v) => v.verse === 1)?.text ?? "", /样例|樣例|見本|自由|解放/);
    assert.match(gal.verses.find((v) => v.verse === 22)?.text ?? "", /样例|樣例|見本|仁爱|仁愛|愛、喜び|御霊の実|聖霊の実|霊の結ぶ実/);

    const phil = await loadChapter(tid, { book: "Phil", chapter: 4 });
    assert.ok(!("external" in phil), tid);
    assert.ok(phil.verses.length >= 23, tid);
    assert.equal(phil.verses[0]?.verse, 1, tid);
    assert.equal(phil.verses[phil.verses.length - 1]?.verse, 23, tid);
    assert.match(phil.verses.find((v) => v.verse === 4)?.text ?? "", /样例|樣例|見本|喜乐|喜樂|喜び/);
    assert.match(phil.verses.find((v) => v.verse === 19)?.text ?? "", /样例|樣例|見本|充足|満た/);

    const cor = await loadChapter(tid, { book: "1Cor", chapter: 13 });
    assert.ok(!("external" in cor), tid);
    assert.ok(cor.verses.length >= 13, tid);
    assert.match(cor.verses.find((v) => v.verse === 13)?.text ?? "", /样例|樣例|見本|最大的是爱|最大的是愛|愛である|愛です/);

    const eph = await loadChapter(tid, { book: "Eph", chapter: 2 });
    assert.ok(!("external" in eph), tid);
    assert.ok(eph.verses.length >= 22, tid);
    assert.equal(eph.verses[eph.verses.length - 1]?.verse, 22, tid);
    assert.match(eph.verses.find((v) => v.verse === 8)?.text ?? "", /样例|樣例|見本|本乎恩|恵み|信仰/);
    assert.match(eph.verses.find((v) => v.verse === 14)?.text ?? "", /样例|樣例|見本|和睦|平和|墙|中垣/);

    const col = await loadChapter(tid, { book: "Col", chapter: 3 });
    assert.ok(!("external" in col), tid);
    assert.ok(col.verses.length >= 25, tid);
    assert.equal(col.verses[col.verses.length - 1]?.verse, 25, tid);
    assert.match(col.verses.find((v) => v.verse === 14)?.text ?? "", /样例|樣例|見本|爱心|愛心|愛を/);
    assert.match(col.verses.find((v) => v.verse === 23)?.text ?? "", /样例|樣例|見本|心里|心から|主/);

    const jas = await loadChapter(tid, { book: "Jas", chapter: 1 });
    assert.ok(!("external" in jas), tid);
    assert.ok(jas.verses.length >= 27, tid);
    assert.equal(jas.verses[0]?.verse, 1, tid);
    assert.equal(jas.verses[jas.verses.length - 1]?.verse, 27, tid);
    assert.match(jas.verses.find((v) => v.verse === 22)?.text ?? "", /样例|樣例|見本|行道|実行/);
    assert.match(jas.verses.find((v) => v.verse === 27)?.text ?? "", /样例|樣例|見本|孤儿|孤兒|寡婦|寡妇|孤児|寡婦|世俗|世の汚れ/);

    const matt = await loadChapter(tid, { book: "Matt", chapter: 28 });
    assert.ok(!("external" in matt), tid);
    assert.ok(matt.verses.length >= 20, tid);
    assert.equal(matt.verses[0]?.verse, 1, tid);
    assert.equal(matt.verses[matt.verses.length - 1]?.verse, 20, tid);
    assert.match(matt.verses.find((v) => v.verse === 19)?.text ?? "", /样例|樣例|見本|门徒|門徒|弟子/);
    assert.match(matt.verses.find((v) => v.verse === 6)?.text ?? "", /样例|樣例|見本|复活|復活|よみがえ|甦/);
    assert.match(matt.verses.find((v) => v.verse === 13)?.text ?? "", /样例|樣例|見本|偷|盗|眠/);

    const rev = await loadChapter(tid, { book: "Rev", chapter: 21 });
    assert.ok(!("external" in rev), tid);
    assert.ok(rev.verses.length >= 27, tid);
    assert.equal(rev.verses[rev.verses.length - 1]?.verse, 27, tid);
    assert.match(rev.verses[0]?.text ?? "", /样例|樣例|見本|新天|新しい天/);
    assert.match(rev.verses.find((v) => v.verse === 22)?.text ?? "", /样例|樣例|見本|殿|聖所|羔羊|小羊/);
  }
});

test("loadChapter returns PD Eph.2 / Col.3 / Jas.1 / Rev.21 scaffolds (web/kjv/asv)", async () => {
  const eph = await loadChapter("web", { book: "Eph", chapter: 2 });
  assert.ok(!("external" in eph));
  assert.equal(eph.book, "Eph");
  assert.ok(eph.verses.length >= 22);
  assert.equal(eph.verses[0]?.verse, 1);
  assert.equal(eph.verses[eph.verses.length - 1]?.verse, 22);
  assert.match(eph.verses.find((v) => v.verse === 8)?.text ?? "", /by grace.*saved through faith|gift of God/i);
  assert.match(eph.verses.find((v) => v.verse === 14)?.text ?? "", /he is our peace|middle wall/i);
  assert.match(eph.verses.find((v) => v.verse === 20)?.text ?? "", /cornerstone|apostles and prophets/i);

  const kjvEph = await loadChapter("kjv", { book: "Ephesians", chapter: 2 });
  assert.ok(!("external" in kjvEph));
  assert.ok(kjvEph.verses.length >= 22);
  assert.match(kjvEph.verses.find((v) => v.verse === 8)?.text ?? "", /by grace.*saved through faith|gift of God/i);
  assert.match(kjvEph.verses.find((v) => v.verse === 22)?.text ?? "", /habitation of God|Spirit/i);

  const col = await loadChapter("web", { book: "Col", chapter: 3 });
  assert.ok(!("external" in col));
  assert.ok(col.verses.length >= 25);
  assert.equal(col.verses[0]?.verse, 1);
  assert.equal(col.verses[col.verses.length - 1]?.verse, 25);
  assert.match(col.verses.find((v) => v.verse === 14)?.text ?? "", /walk in love|bond of perfection/i);
  assert.match(col.verses.find((v) => v.verse === 11)?.text ?? "", /Christ is all|Greek and Jew/i);
  assert.match(col.verses.find((v) => v.verse === 23)?.text ?? "", /work heartily|as for the Lord/i);

  const jas = await loadChapter("web", { book: "Jas", chapter: 1 });
  assert.ok(!("external" in jas));
  assert.ok(jas.verses.length >= 27);
  assert.equal(jas.verses[0]?.verse, 1);
  assert.equal(jas.verses[jas.verses.length - 1]?.verse, 27);
  assert.match(jas.verses.find((v) => v.verse === 22)?.text ?? "", /doers of the word|not only hearers/i);
  assert.match(jas.verses.find((v) => v.verse === 27)?.text ?? "", /pure religion|fatherless and widows|unstained by the world/i);

  const asvJas = await loadChapter("asv", { book: "James", chapter: 1 });
  assert.ok(!("external" in asvJas));
  assert.ok(asvJas.verses.length >= 27);
  assert.match(asvJas.verses.find((v) => v.verse === 1)?.text ?? "", /twelve tribes|Dispersion/i);

  const rev = await loadChapter("web", { book: "Rev", chapter: 21 });
  assert.ok(!("external" in rev));
  assert.ok(rev.verses.length >= 27);
  assert.equal(rev.verses[0]?.verse, 1);
  assert.equal(rev.verses[rev.verses.length - 1]?.verse, 27);
  assert.match(rev.verses[0]?.text ?? "", /new heaven and a new earth/i);
  assert.match(rev.verses.find((v) => v.verse === 4)?.text ?? "", /wipe away every tear|Death will be no more/i);
  assert.match(rev.verses.find((v) => v.verse === 22)?.text ?? "", /no temple|Lamb are its temple/i);
  assert.match(rev.verses.find((v) => v.verse === 27)?.text ?? "", /Lamb's book of life/i);
});

test("loadChapter returns zh/ja Eph.2 / Col.3 / Jas.1 / Rev.21 scaffolds", async () => {
  const cuvsEph = await loadChapter("cuvs", { book: "Eph", chapter: 2 });
  assert.ok(!("external" in cuvsEph));
  assert.ok(cuvsEph.verses.length >= 22);
  assert.match(cuvsEph.verses.find((v) => v.verse === 8)?.text ?? "", /样例|本乎恩|因着信/);
  assert.match(cuvsEph.verses.find((v) => v.verse === 14)?.text ?? "", /样例|和睦|隔断的墙/);

  const kougoEph = await loadChapter("kougo", { book: "Eph", chapter: 2 });
  assert.ok(!("external" in kougoEph));
  assert.ok(kougoEph.verses.length >= 22);
  assert.match(kougoEph.verses.find((v) => v.verse === 8)?.text ?? "", /見本|恵み|信仰/);
  assert.match(kougoEph.verses.find((v) => v.verse === 14)?.text ?? "", /見本|平和|中垣/);

  const cuvsCol = await loadChapter("cuvs", { book: "Col", chapter: 3 });
  assert.ok(!("external" in cuvsCol));
  assert.ok(cuvsCol.verses.length >= 25);
  assert.match(cuvsCol.verses.find((v) => v.verse === 14)?.text ?? "", /样例|爱心|联络全德/);
  assert.match(cuvsCol.verses.find((v) => v.verse === 23)?.text ?? "", /样例|心里做|给主做/);

  const kougoCol = await loadChapter("kougo", { book: "Col", chapter: 3 });
  assert.ok(!("external" in kougoCol));
  assert.ok(kougoCol.verses.length >= 25);
  assert.match(kougoCol.verses.find((v) => v.verse === 14)?.text ?? "", /見本|愛を|帯/);

  const cuvsJas = await loadChapter("cuvs", { book: "Jas", chapter: 1 });
  assert.ok(!("external" in cuvsJas));
  assert.ok(cuvsJas.verses.length >= 27);
  assert.equal(cuvsJas.verses[cuvsJas.verses.length - 1]?.verse, 27);
  assert.match(cuvsJas.verses.find((v) => v.verse === 22)?.text ?? "", /样例|行道|听道/);
  assert.match(cuvsJas.verses.find((v) => v.verse === 27)?.text ?? "", /样例|孤儿寡妇|不沾染世俗/);

  const kougoJas = await loadChapter("kougo", { book: "James", chapter: 1 });
  assert.ok(!("external" in kougoJas));
  assert.ok(kougoJas.verses.length >= 27);
  assert.equal(kougoJas.verses[kougoJas.verses.length - 1]?.verse, 27);
  assert.match(kougoJas.verses.find((v) => v.verse === 22)?.text ?? "", /見本|実行|聞くだけ/);
  assert.match(kougoJas.verses.find((v) => v.verse === 27)?.text ?? "", /見本|孤児|寡婦|世の汚れ/);

  const cuvsRev = await loadChapter("cuvs", { book: "Rev", chapter: 21 });
  assert.ok(!("external" in cuvsRev));
  assert.ok(cuvsRev.verses.length >= 27);
  assert.match(cuvsRev.verses[0]?.text ?? "", /样例|新天新地/);
  assert.match(cuvsRev.verses.find((v) => v.verse === 22)?.text ?? "", /样例|城内有殿|羔羊为城的殿/);

  const kougoRev = await loadChapter("kougo", { book: "Revelation", chapter: 21 });
  assert.ok(!("external" in kougoRev));
  assert.ok(kougoRev.verses.length >= 27);
  assert.match(kougoRev.verses[0]?.text ?? "", /見本|新しい天/);
  assert.match(kougoRev.verses.find((v) => v.verse === 22)?.text ?? "", /見本|聖所|小羊/);
});

test("loadChapter returns licensed-peer Mark.1 / Exod.20 / Luke.2 / Deut.6 scaffolds", async () => {
  const peers = ["cuvt", "rcuv", "ccb", "lzz", "shinkaiyaku", "shinKyoudou"] as const;
  for (const tid of peers) {
    const mark = await loadChapter(tid, { book: "Mark", chapter: 1 });
    assert.ok(!("external" in mark), tid);
    assert.equal(mark.book, "Mark");
    assert.ok(mark.verses.length >= 45, tid);
    assert.equal(mark.verses[mark.verses.length - 1]?.verse, 45, tid);
    assert.match(mark.verses[0]?.text ?? "", /样例|樣例|見本|福音|はじめ/);
    assert.match(mark.verses.find((v) => v.verse === 15)?.text ?? "", /样例|樣例|見本|神的国|神の国|悔改|悔い改/);

    const exod = await loadChapter(tid, { book: "Exod", chapter: 20 });
    assert.ok(!("external" in exod), tid);
    assert.equal(exod.book, "Exod");
    assert.ok(exod.verses.length >= 26, tid);
    assert.equal(exod.verses[exod.verses.length - 1]?.verse, 26, tid);
    assert.match(exod.verses.find((v) => v.verse === 3)?.text ?? "", /样例|樣例|見本|别的|別的|神としては|ほかに神|ほかの神/);
    assert.match(exod.verses.find((v) => v.verse === 20)?.text ?? "", /样例|樣例|見本|惧怕|懼怕|恐れて|试验|試驗|試み/);

    const luke = await loadChapter(tid, { book: "Luke", chapter: 2 });
    assert.ok(!("external" in luke), tid);
    assert.equal(luke.book, "Luke");
    assert.ok(luke.verses.length >= 52, tid);
    assert.equal(luke.verses[0]?.verse, 1, tid);
    assert.equal(luke.verses[luke.verses.length - 1]?.verse, 52, tid);
    assert.match(luke.verses.find((v) => v.verse === 11)?.text ?? "", /样例|樣例|見本|救主|キリスト/);
    assert.match(luke.verses.find((v) => v.verse === 52)?.text ?? "", /样例|樣例|見本|智慧|知恵|身量|背たけ|增长|增長|愛された/);

    const deut = await loadChapter(tid, { book: "Deut", chapter: 6 });
    assert.ok(!("external" in deut), tid);
    assert.equal(deut.book, "Deut");
    assert.ok(deut.verses.length >= 25, tid);
    assert.match(deut.verses.find((v) => v.verse === 4)?.text ?? "", /样例|樣例|見本|以色列|イスラエル|独一|唯一/);
  }
});

test("loadChapter returns licensed-peer Heb.11 / Isa.53 / Acts.2 / Ps.1 / Prov.3 scaffolds", async () => {
  const peers = ["cuvt", "rcuv", "ccb", "lzz", "shinkaiyaku", "shinKyoudou"] as const;
  for (const tid of peers) {
    const heb = await loadChapter(tid, { book: "Heb", chapter: 11 });
    assert.ok(!("external" in heb), tid);
    assert.equal(heb.book, "Heb");
    assert.ok(heb.verses.length >= 40, tid);
    assert.equal(heb.verses[heb.verses.length - 1]?.verse, 40, tid);
    assert.match(heb.verses[0]?.text ?? "", /样例|樣例|見本|信|信仰/);
    assert.match(heb.verses.find((v) => v.verse === 12)?.text ?? "", /星|砂|沙|子孙|子孫|生まれ/);
    assert.match(heb.verses.find((v) => v.verse === 40)?.text ?? "", /样例|樣例|見本|更美|すぐれた|完全|全う/);

    const isa = await loadChapter(tid, { book: "Isa", chapter: 53 });
    assert.ok(!("external" in isa), tid);
    assert.equal(isa.book, "Isa");
    assert.ok(isa.verses.length >= 12, tid);
    assert.match(isa.verses[0]?.text ?? "", /样例|樣例|見本|信|腕|膀臂/);
    assert.match(isa.verses.find((v) => v.verse === 5)?.text ?? "", /过犯|過犯|鞭|傷|いや|砕/);

    const acts = await loadChapter(tid, { book: "Acts", chapter: 2 });
    assert.ok(!("external" in acts), tid);
    assert.equal(acts.book, "Acts");
    assert.ok(acts.verses.length >= 47, tid);
    assert.equal(acts.verses[0]?.verse, 1, tid);
    assert.equal(acts.verses[acts.verses.length - 1]?.verse, 47, tid);
    assert.match(acts.verses[0]?.text ?? "", /样例|樣例|見本|五旬/);
    assert.match(acts.verses.find((v) => v.verse === 38)?.text ?? "", /样例|樣例|見本|悔改|バプテスマ|受洗/);
    assert.match(acts.verses.find((v) => v.verse === 47)?.text ?? "", /样例|樣例|見本|赞美|讚美|さんび|日々|得救|救われる/);

    const ps = await loadChapter(tid, { book: "Ps", chapter: 1 });
    assert.ok(!("external" in ps), tid);
    assert.equal(ps.book, "Ps");
    assert.ok(ps.verses.length >= 6, tid);
    assert.match(ps.verses[0]?.text ?? "", /样例|樣例|見本|恶|惡|福|さいわい|幸い/);

    const prov = await loadChapter(tid, { book: "Prov", chapter: 3 });
    assert.ok(!("external" in prov), tid);
    assert.equal(prov.book, "Prov");
    assert.ok(prov.verses.length >= 35, tid);
    assert.equal(prov.verses[prov.verses.length - 1]?.verse, 35, tid);
    assert.match(prov.verses.find((v) => v.verse === 5)?.text ?? "", /样例|樣例|見本|仰赖|仰賴|信頼|聪明|聰明|知識|悟り|分別/);
    assert.match(prov.verses.find((v) => v.verse === 35)?.text ?? "", /样例|樣例|見本|智慧|愚|誉|恥|羞辱|尊荣|尊榮/);
  }
});

test("loadChapter returns PD Psalm.1 scaffolds (web/kjv/asv)", async () => {
  const web = await loadChapter("web", { book: "Ps", chapter: 1 });
  assert.ok(!("external" in web));
  assert.equal(web.source, "local");
  assert.equal(web.book, "Ps");
  assert.equal(web.chapter, 1);
  assert.ok(web.verses.length >= 6);
  assert.match(web.verses[0]?.text ?? "", /Blessed is the man|counsel of the wicked/i);
  assert.match(web.verses.find((v) => v.verse === 3)?.text ?? "", /tree planted|streams of water/i);
  assert.match(web.verses.find((v) => v.verse === 6)?.text ?? "", /knows the way|way of the wicked/i);

  const kjv = await loadChapter("kjv", { book: "Psalm", chapter: 1 });
  assert.ok(!("external" in kjv));
  assert.equal(kjv.book, "Ps");
  assert.ok(kjv.verses.length >= 6);
  assert.match(kjv.verses[0]?.text ?? "", /Blessed is the man|counsel of the ungodly/i);

  const asv = await loadChapter("asv", { book: "Psalms", chapter: 1 });
  assert.ok(!("external" in asv));
  assert.ok(asv.verses.length >= 6);
  assert.match(asv.verses.find((v) => v.verse === 2)?.text ?? "", /law of Jehovah|meditate day and night/i);
});

test("loadChapter returns PD Proverbs.3 scaffolds (web/kjv/asv)", async () => {
  const web = await loadChapter("web", { book: "Prov", chapter: 3 });
  assert.ok(!("external" in web));
  assert.equal(web.book, "Prov");
  assert.equal(web.chapter, 3);
  assert.ok(web.verses.length >= 35);
  assert.equal(web.verses[web.verses.length - 1]?.verse, 35);
  assert.match(web.verses.find((v) => v.verse === 5)?.text ?? "", /Trust in Yahweh|own understanding/i);
  assert.match(web.verses.find((v) => v.verse === 8)?.text ?? "", /health|marrow|bones/i);
  assert.match(web.verses.find((v) => v.verse === 35)?.text ?? "", /wise will inherit glory|shame.*fools/i);

  const kjv = await loadChapter("kjv", { book: "Proverbs", chapter: 3 });
  assert.ok(!("external" in kjv));
  assert.equal(kjv.book, "Prov");
  assert.ok(kjv.verses.length >= 35);
  assert.match(kjv.verses.find((v) => v.verse === 5)?.text ?? "", /Trust in the LORD|own understanding/i);
  assert.match(kjv.verses.find((v) => v.verse === 35)?.text ?? "", /wise shall inherit glory|shame.*fools/i);

  const asv = await loadChapter("asv", { book: "prov", chapter: 3 });
  assert.ok(!("external" in asv));
  assert.ok(asv.verses.length >= 35);
  assert.match(asv.verses.find((v) => v.verse === 6)?.text ?? "", /acknowledge him|direct thy paths/i);
  assert.match(asv.verses.find((v) => v.verse === 35)?.text ?? "", /wise shall inherit glory|shame.*fools/i);
});

test("loadChapter returns zh/ja Psalm.1 and Proverbs.3 scaffolds", async () => {
  const cuvsPs = await loadChapter("cuvs", { book: "Ps", chapter: 1 });
  assert.ok(!("external" in cuvsPs));
  assert.equal(cuvsPs.book, "Ps");
  assert.ok(cuvsPs.verses.length >= 6);
  assert.match(cuvsPs.verses[0]?.text ?? "", /样例|恶人的计谋|有福/);

  const kougoPs = await loadChapter("kougo", { book: "Psalm", chapter: 1 });
  assert.ok(!("external" in kougoPs));
  assert.ok(kougoPs.verses.length >= 6);
  assert.match(kougoPs.verses[0]?.text ?? "", /見本|悪しき者|さいわい/);

  const cuvsProv = await loadChapter("cuvs", { book: "箴言", chapter: 3 });
  assert.ok(!("external" in cuvsProv));
  assert.equal(cuvsProv.book, "Prov");
  assert.ok(cuvsProv.verses.length >= 35);
  assert.equal(cuvsProv.verses[cuvsProv.verses.length - 1]?.verse, 35);
  assert.match(cuvsProv.verses.find((v) => v.verse === 5)?.text ?? "", /样例|仰赖耶和华|自己的聪明/);
  assert.match(cuvsProv.verses.find((v) => v.verse === 35)?.text ?? "", /样例|智慧人|愚昧|羞辱/);

  const kougoProv = await loadChapter("kougo", { book: "Proverbs", chapter: 3 });
  assert.ok(!("external" in kougoProv));
  assert.ok(kougoProv.verses.length >= 35);
  assert.equal(kougoProv.verses[kougoProv.verses.length - 1]?.verse, 35);
  assert.match(kougoProv.verses.find((v) => v.verse === 5)?.text ?? "", /見本|主に信頼|自分の知識/);
  assert.match(kougoProv.verses.find((v) => v.verse === 35)?.text ?? "", /見本|知恵ある者|愚か|恥/);
});

test("loadChapter returns PD Mark.1 scaffolds (web/kjv/asv)", async () => {
  const web = await loadChapter("web", { book: "Mark", chapter: 1 });
  assert.ok(!("external" in web));
  assert.equal(web.source, "local");
  assert.equal(web.book, "Mark");
  assert.equal(web.chapter, 1);
  assert.ok(web.verses.length >= 45);
  assert.equal(web.verses[0]?.verse, 1);
  assert.equal(web.verses[web.verses.length - 1]?.verse, 45);
  assert.match(web.verses[0]?.text ?? "", /beginning of the Good News|Jesus Christ/i);
  assert.match(web.verses.find((v) => v.verse === 4)?.text ?? "", /John came baptizing|baptism of repentance/i);
  assert.match(web.verses.find((v) => v.verse === 15)?.text ?? "", /Kingdom is at hand|Repent.*believe/i);
  assert.match(web.verses.find((v) => v.verse === 41)?.text ?? "", /Be made clean|I want to/i);

  const kjv = await loadChapter("kjv", { book: "Mk", chapter: 1 });
  assert.ok(!("external" in kjv));
  assert.equal(kjv.book, "Mark");
  assert.ok(kjv.verses.length >= 45);
  assert.match(kjv.verses[0]?.text ?? "", /beginning of the gospel|Son of God/i);
  assert.match(kjv.verses.find((v) => v.verse === 17)?.text ?? "", /fishers of men/i);

  const asv = await loadChapter("asv", { book: "mark", chapter: 1 });
  assert.ok(!("external" in asv));
  assert.ok(asv.verses.length >= 45);
  assert.match(asv.verses.find((v) => v.verse === 3)?.text ?? "", /voice of one crying|Make ye ready/i);
  assert.match(asv.verses.find((v) => v.verse === 45)?.text ?? "", /desert places|every quarter/i);
});

test("loadChapter returns PD Exodus.20 scaffolds (web/kjv/asv)", async () => {
  const web = await loadChapter("web", { book: "Exod", chapter: 20 });
  assert.ok(!("external" in web));
  assert.equal(web.book, "Exod");
  assert.equal(web.chapter, 20);
  assert.ok(web.verses.length >= 26);
  assert.equal(web.verses[0]?.verse, 1);
  assert.equal(web.verses[web.verses.length - 1]?.verse, 26);
  assert.match(web.verses.find((v) => v.verse === 2)?.text ?? "", /Yahweh your God|land of Egypt/i);
  assert.match(web.verses.find((v) => v.verse === 13)?.text ?? "", /not murder|not kill/i);
  assert.match(web.verses.find((v) => v.verse === 17)?.text ?? "", /not covet/i);
  assert.match(web.verses.find((v) => v.verse === 18)?.text ?? "", /thunderings|lightnings|trumpet/i);
  assert.match(web.verses.find((v) => v.verse === 20)?.text ?? "", /Don't be afraid|Fear not|test you/i);
  assert.match(web.verses.find((v) => v.verse === 26)?.text ?? "", /steps|altar|nakedness/i);

  const kjv = await loadChapter("kjv", { book: "Exodus", chapter: 20 });
  assert.ok(!("external" in kjv));
  assert.equal(kjv.book, "Exod");
  assert.ok(kjv.verses.length >= 26);
  assert.equal(kjv.verses[kjv.verses.length - 1]?.verse, 26);
  assert.match(kjv.verses.find((v) => v.verse === 3)?.text ?? "", /no other gods before me/i);
  assert.match(kjv.verses.find((v) => v.verse === 20)?.text ?? "", /Fear not|prove you/i);

  const asv = await loadChapter("asv", { book: "Ex", chapter: 20 });
  assert.ok(!("external" in asv));
  assert.ok(asv.verses.length >= 26);
  assert.equal(asv.verses[asv.verses.length - 1]?.verse, 26);
  assert.match(asv.verses.find((v) => v.verse === 2)?.text ?? "", /Jehovah thy God|Egypt/i);
  assert.match(asv.verses.find((v) => v.verse === 26)?.text ?? "", /steps|altar|nakedness/i);
});

test("loadChapter returns zh/ja Mark.1 and Exodus.20 scaffolds", async () => {
  const cuvsMark = await loadChapter("cuvs", { book: "马可福音", chapter: 1 });
  assert.ok(!("external" in cuvsMark));
  assert.equal(cuvsMark.book, "Mark");
  assert.ok(cuvsMark.verses.length >= 45);
  assert.match(cuvsMark.verses[0]?.text ?? "", /样例|耶稣基督|福音的起头/);
  assert.match(cuvsMark.verses.find((v) => v.verse === 15)?.text ?? "", /样例|神的国|悔改|信福音/);

  const kougoMark = await loadChapter("kougo", { book: "マルコ", chapter: 1 });
  assert.ok(!("external" in kougoMark));
  assert.ok(kougoMark.verses.length >= 45);
  assert.match(kougoMark.verses[0]?.text ?? "", /見本|イエス・キリスト|福音のはじめ/);
  assert.match(kougoMark.verses.find((v) => v.verse === 15)?.text ?? "", /見本|神の国|悔い改/);

  const cuvsExod = await loadChapter("cuvs", { book: "出埃及记", chapter: 20 });
  assert.ok(!("external" in cuvsExod));
  assert.equal(cuvsExod.book, "Exod");
  assert.ok(cuvsExod.verses.length >= 26);
  assert.equal(cuvsExod.verses[cuvsExod.verses.length - 1]?.verse, 26);
  assert.match(cuvsExod.verses.find((v) => v.verse === 3)?.text ?? "", /样例|不可有别的神/);
  assert.match(cuvsExod.verses.find((v) => v.verse === 13)?.text ?? "", /不可杀人/);
  assert.match(cuvsExod.verses.find((v) => v.verse === 17)?.text ?? "", /不可贪恋/);
  assert.match(cuvsExod.verses.find((v) => v.verse === 18)?.text ?? "", /雷轰|闪电|角声/);
  assert.match(cuvsExod.verses.find((v) => v.verse === 20)?.text ?? "", /不要惧怕|试验/);
  assert.match(cuvsExod.verses.find((v) => v.verse === 26)?.text ?? "", /台阶|下体/);

  const kougoExod = await loadChapter("kougo", { book: "出エジプト記", chapter: 20 });
  assert.ok(!("external" in kougoExod));
  assert.ok(kougoExod.verses.length >= 26);
  assert.equal(kougoExod.verses[kougoExod.verses.length - 1]?.verse, 26);
  assert.match(kougoExod.verses.find((v) => v.verse === 2)?.text ?? "", /見本|エジプトの地|奴隷の家/);
  assert.match(kougoExod.verses.find((v) => v.verse === 13)?.text ?? "", /殺してはならない/);
  assert.match(kougoExod.verses.find((v) => v.verse === 20)?.text ?? "", /恐れてはならない|試み/);
  assert.match(kougoExod.verses.find((v) => v.verse === 26)?.text ?? "", /階段|祭壇|裸/);
});

test("loadChapter returns PD Luke.2 scaffolds (web/kjv/asv)", async () => {
  const web = await loadChapter("web", { book: "Luke", chapter: 2 });
  assert.ok(!("external" in web));
  assert.equal(web.source, "local");
  assert.equal(web.book, "Luke");
  assert.equal(web.chapter, 2);
  assert.ok(web.verses.length >= 52);
  assert.equal(web.verses[0]?.verse, 1);
  assert.equal(web.verses[web.verses.length - 1]?.verse, 52);
  assert.match(web.verses[0]?.text ?? "", /Caesar Augustus|decree|enrolled/i);
  assert.match(web.verses.find((v) => v.verse === 11)?.text ?? "", /Savior|Christ the Lord/i);
  assert.match(web.verses.find((v) => v.verse === 52)?.text ?? "", /increased in wisdom|favor with God/i);

  const kjv = await loadChapter("kjv", { book: "Lk", chapter: 2 });
  assert.ok(!("external" in kjv));
  assert.equal(kjv.book, "Luke");
  assert.ok(kjv.verses.length >= 52);
  assert.match(kjv.verses.find((v) => v.verse === 7)?.text ?? "", /firstborn|manger|swaddling/i);
  assert.match(kjv.verses.find((v) => v.verse === 49)?.text ?? "", /Father's business|about my Father/i);

  const asv = await loadChapter("asv", { book: "luke", chapter: 2 });
  assert.ok(!("external" in asv));
  assert.ok(asv.verses.length >= 52);
  assert.match(asv.verses.find((v) => v.verse === 10)?.text ?? "", /good tidings|Be not afraid/i);
  assert.match(asv.verses.find((v) => v.verse === 52)?.text ?? "", /advanced in wisdom|favor with God/i);
});

test("loadChapter returns PD Deuteronomy.6 scaffolds (web/kjv/asv)", async () => {
  const web = await loadChapter("web", { book: "Deut", chapter: 6 });
  assert.ok(!("external" in web));
  assert.equal(web.book, "Deut");
  assert.equal(web.chapter, 6);
  assert.ok(web.verses.length >= 25);
  assert.match(web.verses.find((v) => v.verse === 4)?.text ?? "", /Hear.*Israel|Yahweh is one/i);
  assert.match(web.verses.find((v) => v.verse === 9)?.text ?? "", /door posts|gates/i);

  const kjv = await loadChapter("kjv", { book: "Deuteronomy", chapter: 6 });
  assert.ok(!("external" in kjv));
  assert.equal(kjv.book, "Deut");
  assert.ok(kjv.verses.length >= 25);
  assert.match(kjv.verses.find((v) => v.verse === 5)?.text ?? "", /love the LORD thy God/i);

  const asv = await loadChapter("asv", { book: "Dt", chapter: 6 });
  assert.ok(!("external" in asv));
  assert.ok(asv.verses.length >= 25);
  assert.match(asv.verses.find((v) => v.verse === 4)?.text ?? "", /Jehovah our God|one Jehovah/i);
});

test("loadChapter returns zh/ja Luke.2 and Deuteronomy.6 scaffolds", async () => {
  const cuvsLuke = await loadChapter("cuvs", { book: "路加福音", chapter: 2 });
  assert.ok(!("external" in cuvsLuke));
  assert.equal(cuvsLuke.book, "Luke");
  assert.ok(cuvsLuke.verses.length >= 52);
  assert.equal(cuvsLuke.verses[cuvsLuke.verses.length - 1]?.verse, 52);
  assert.match(cuvsLuke.verses[0]?.text ?? "", /样例|凯撒|报名上册/);
  assert.match(cuvsLuke.verses.find((v) => v.verse === 52)?.text ?? "", /样例|智慧|身量|增长/);

  const kougoLuke = await loadChapter("kougo", { book: "ルカ", chapter: 2 });
  assert.ok(!("external" in kougoLuke));
  assert.ok(kougoLuke.verses.length >= 52);
  assert.equal(kougoLuke.verses[kougoLuke.verses.length - 1]?.verse, 52);
  assert.match(kougoLuke.verses[0]?.text ?? "", /見本|アウグスト|人口調査/);
  assert.match(kougoLuke.verses.find((v) => v.verse === 52)?.text ?? "", /見本|知恵|背たけ|愛された/);

  const cuvsDeut = await loadChapter("cuvs", { book: "申命记", chapter: 6 });
  assert.ok(!("external" in cuvsDeut));
  assert.equal(cuvsDeut.book, "Deut");
  assert.ok(cuvsDeut.verses.length >= 25);
  assert.match(cuvsDeut.verses.find((v) => v.verse === 4)?.text ?? "", /样例|以色列|独一的主/);
  assert.match(cuvsDeut.verses.find((v) => v.verse === 9)?.text ?? "", /门框|城门/);

  const kougoDeut = await loadChapter("kougo", { book: "申命記", chapter: 6 });
  assert.ok(!("external" in kougoDeut));
  assert.ok(kougoDeut.verses.length >= 25);
  assert.match(kougoDeut.verses.find((v) => v.verse === 4)?.text ?? "", /見本|イスラエル|唯一の主/);
  assert.match(kougoDeut.verses.find((v) => v.verse === 9)?.text ?? "", /入口|門/);
});

test("loadChapter returns PD Matt.6 scaffolds (web/kjv/asv)", async () => {
  const web = await loadChapter("web", { book: "Matt", chapter: 6 });
  assert.ok(!("external" in web));
  assert.equal(web.source, "local");
  assert.equal(web.book, "Matt");
  assert.equal(web.chapter, 6);
  assert.ok(web.verses.length >= 34);
  assert.equal(web.verses[0]?.verse, 1);
  assert.equal(web.verses[web.verses.length - 1]?.verse, 34);
  assert.match(web.verses.find((v) => v.verse === 9)?.text ?? "", /Our Father|name be kept holy/i);
  assert.match(web.verses.find((v) => v.verse === 12)?.text ?? "", /Forgive us our debts/i);
  assert.match(web.verses.find((v) => v.verse === 33)?.text ?? "", /seek first|Kingdom/i);
  assert.match(web.verses.find((v) => v.verse === 24)?.text ?? "", /two masters|Mammon/i);

  const kjv = await loadChapter("kjv", { book: "Matthew", chapter: 6 });
  assert.ok(!("external" in kjv));
  assert.equal(kjv.book, "Matt");
  assert.ok(kjv.verses.length >= 34);
  assert.match(kjv.verses.find((v) => v.verse === 11)?.text ?? "", /daily bread/i);
  assert.match(kjv.verses.find((v) => v.verse === 13)?.text ?? "", /temptation|evil/i);
  assert.match(kjv.verses.find((v) => v.verse === 34)?.text ?? "", /no thought for the morrow|Sufficient unto the day/i);

  const asv = await loadChapter("asv", { book: "Mt", chapter: 6 });
  assert.ok(!("external" in asv));
  assert.ok(asv.verses.length >= 34);
  assert.match(asv.verses.find((v) => v.verse === 10)?.text ?? "", /Thy kingdom come|will be done/i);
  assert.match(asv.verses.find((v) => v.verse === 19)?.text ?? "", /treasures upon the earth|moth and rust/i);
});

test("loadChapter returns PD Matt.28 scaffolds (web/kjv/asv)", async () => {
  const web = await loadChapter("web", { book: "Matt", chapter: 28 });
  assert.ok(!("external" in web));
  assert.equal(web.source, "local");
  assert.equal(web.book, "Matt");
  assert.equal(web.chapter, 28);
  assert.ok(web.verses.length >= 20);
  assert.equal(web.verses[0]?.verse, 1);
  assert.equal(web.verses[web.verses.length - 1]?.verse, 20);
  assert.match(web.verses.find((v) => v.verse === 6)?.text ?? "", /risen|not here/i);
  assert.match(web.verses.find((v) => v.verse === 13)?.text ?? "", /disciples came by night|stole him/i);
  assert.match(web.verses.find((v) => v.verse === 19)?.text ?? "", /make disciples|baptizing|Father.*Son.*Holy Spirit/i);
  assert.match(web.verses.find((v) => v.verse === 20)?.text ?? "", /I am with you|end of the age|always/i);

  const kjv = await loadChapter("kjv", { book: "Matthew", chapter: 28 });
  assert.ok(!("external" in kjv));
  assert.equal(kjv.book, "Matt");
  assert.ok(kjv.verses.length >= 20);
  assert.match(kjv.verses.find((v) => v.verse === 19)?.text ?? "", /teach all nations|baptizing/i);
  assert.match(kjv.verses.find((v) => v.verse === 15)?.text ?? "", /took the money|commonly reported|until this day/i);

  const asv = await loadChapter("asv", { book: "Mt", chapter: 28 });
  assert.ok(!("external" in asv));
  assert.ok(asv.verses.length >= 20);
  assert.match(asv.verses.find((v) => v.verse === 6)?.text ?? "", /risen|He is not here/i);
  assert.match(asv.verses.find((v) => v.verse === 12)?.text ?? "", /assembled with the elders|much money|soldiers/i);
});

test("loadChapter returns PD Galatians.5 scaffolds (web/kjv/asv)", async () => {
  const web = await loadChapter("web", { book: "Gal", chapter: 5 });
  assert.ok(!("external" in web));
  assert.equal(web.book, "Gal");
  assert.equal(web.chapter, 5);
  assert.ok(web.verses.length >= 26);
  assert.equal(web.verses[0]?.verse, 1);
  assert.equal(web.verses[web.verses.length - 1]?.verse, 26);
  assert.match(web.verses.find((v) => v.verse === 1)?.text ?? "", /liberty|free|yoke of bondage/i);
  assert.match(web.verses.find((v) => v.verse === 22)?.text ?? "", /fruit of the Spirit|love, joy, peace/i);

  const kjv = await loadChapter("kjv", { book: "Galatians", chapter: 5 });
  assert.ok(!("external" in kjv));
  assert.equal(kjv.book, "Gal");
  assert.ok(kjv.verses.length >= 26);
  assert.match(kjv.verses.find((v) => v.verse === 16)?.text ?? "", /Walk in the Spirit/i);
  assert.match(kjv.verses.find((v) => v.verse === 1)?.text ?? "", /liberty|yoke of bondage/i);

  const asv = await loadChapter("asv", { book: "gal", chapter: 5 });
  assert.ok(!("external" in asv));
  assert.ok(asv.verses.length >= 26);
  assert.match(asv.verses.find((v) => v.verse === 23)?.text ?? "", /self-control|no law/i);
  assert.match(asv.verses.find((v) => v.verse === 13)?.text ?? "", /called for freedom|love be servants/i);
});

test("loadChapter returns zh/ja Matt.6 and Galatians.5 scaffolds", async () => {
  const cuvsMatt = await loadChapter("cuvs", { book: "马太福音", chapter: 6 });
  assert.ok(!("external" in cuvsMatt));
  assert.equal(cuvsMatt.book, "Matt");
  assert.ok(cuvsMatt.verses.length >= 34);
  assert.match(cuvsMatt.verses.find((v) => v.verse === 9)?.text ?? "", /样例|天上的父|尊你的名/);
  assert.match(cuvsMatt.verses.find((v) => v.verse === 13)?.text ?? "", /试探|凶恶|阿们/);
  assert.match(cuvsMatt.verses.find((v) => v.verse === 33)?.text ?? "", /样例|先求|国|义/);

  const kougoMatt = await loadChapter("kougo", { book: "マタイ", chapter: 6 });
  assert.ok(!("external" in kougoMatt));
  assert.ok(kougoMatt.verses.length >= 34);
  assert.match(kougoMatt.verses.find((v) => v.verse === 9)?.text ?? "", /見本|われらの父|御名/);
  assert.match(kougoMatt.verses.find((v) => v.verse === 13)?.text ?? "", /試み|悪から/);
  assert.match(kougoMatt.verses.find((v) => v.verse === 33)?.text ?? "", /見本|神の国|神の義/);

  const cuvsGal = await loadChapter("cuvs", { book: "加拉太书", chapter: 5 });
  assert.ok(!("external" in cuvsGal));
  assert.equal(cuvsGal.book, "Gal");
  assert.ok(cuvsGal.verses.length >= 26);
  assert.match(cuvsGal.verses.find((v) => v.verse === 1)?.text ?? "", /样例|自由|轭/);
  assert.match(cuvsGal.verses.find((v) => v.verse === 22)?.text ?? "", /样例|圣灵所结的果子|仁爱/);

  const kougoGal = await loadChapter("kougo", { book: "ガラテヤ", chapter: 5 });
  assert.ok(!("external" in kougoGal));
  assert.ok(kougoGal.verses.length >= 26);
  assert.match(kougoGal.verses.find((v) => v.verse === 1)?.text ?? "", /見本|自由|解放/);
  assert.match(kougoGal.verses.find((v) => v.verse === 22)?.text ?? "", /見本|御霊の実|愛、喜び/);
});

test("loadChapter returns PD Philippians.4 scaffolds (web/kjv/asv)", async () => {
  const web = await loadChapter("web", { book: "Phil", chapter: 4 });
  assert.ok(!("external" in web));
  assert.equal(web.source, "local");
  assert.equal(web.book, "Phil");
  assert.equal(web.chapter, 4);
  assert.ok(web.verses.length >= 23);
  assert.equal(web.verses[0]?.verse, 1);
  assert.equal(web.verses[web.verses.length - 1]?.verse, 23);
  assert.match(web.verses.find((v) => v.verse === 4)?.text ?? "", /Rejoice in the Lord/i);
  assert.match(web.verses.find((v) => v.verse === 13)?.text ?? "", /all things through Christ/i);
  assert.match(web.verses.find((v) => v.verse === 19)?.text ?? "", /supply every need|riches in glory/i);

  const kjv = await loadChapter("kjv", { book: "Philippians", chapter: 4 });
  assert.ok(!("external" in kjv));
  assert.equal(kjv.book, "Phil");
  assert.ok(kjv.verses.length >= 23);
  assert.match(kjv.verses.find((v) => v.verse === 7)?.text ?? "", /peace of God/i);
  assert.match(kjv.verses.find((v) => v.verse === 19)?.text ?? "", /supply all your need/i);

  const asv = await loadChapter("asv", { book: "Php", chapter: 4 });
  assert.ok(!("external" in asv));
  assert.ok(asv.verses.length >= 23);
  assert.match(asv.verses.find((v) => v.verse === 13)?.text ?? "", /all things in him/i);
  assert.match(asv.verses.find((v) => v.verse === 23)?.text ?? "", /grace of the Lord Jesus Christ/i);
});

test("loadChapter returns PD 1Corinthians.13 scaffolds (web/kjv/asv)", async () => {
  const web = await loadChapter("web", { book: "1Cor", chapter: 13 });
  assert.ok(!("external" in web));
  assert.equal(web.book, "1Cor");
  assert.equal(web.chapter, 13);
  assert.ok(web.verses.length >= 13);
  assert.match(web.verses.find((v) => v.verse === 4)?.text ?? "", /Love is patient/i);
  assert.match(web.verses.find((v) => v.verse === 8)?.text ?? "", /Love never fails/i);
  assert.match(web.verses.find((v) => v.verse === 13)?.text ?? "", /greatest of these is love/i);

  const kjv = await loadChapter("kjv", { book: "1Corinthians", chapter: 13 });
  assert.ok(!("external" in kjv));
  assert.equal(kjv.book, "1Cor");
  assert.ok(kjv.verses.length >= 13);
  assert.match(kjv.verses.find((v) => v.verse === 13)?.text ?? "", /greatest of these is charity/i);

  const asv = await loadChapter("asv", { book: "1Co", chapter: 13 });
  assert.ok(!("external" in asv));
  assert.ok(asv.verses.length >= 13);
  assert.match(asv.verses.find((v) => v.verse === 1)?.text ?? "", /have not love/i);
});

test("loadChapter returns zh/ja Philippians.4 and 1Corinthians.13 scaffolds", async () => {
  const cuvsPhil = await loadChapter("cuvs", { book: "腓立比书", chapter: 4 });
  assert.ok(!("external" in cuvsPhil));
  assert.equal(cuvsPhil.book, "Phil");
  assert.ok(cuvsPhil.verses.length >= 23);
  assert.match(cuvsPhil.verses.find((v) => v.verse === 4)?.text ?? "", /样例|常常喜乐/);
  assert.match(cuvsPhil.verses.find((v) => v.verse === 19)?.text ?? "", /样例|一切所需|充足/);

  const kougoPhil = await loadChapter("kougo", { book: "ピリピ", chapter: 4 });
  assert.ok(!("external" in kougoPhil));
  assert.ok(kougoPhil.verses.length >= 23);
  assert.match(kougoPhil.verses.find((v) => v.verse === 4)?.text ?? "", /見本|常に喜び/);
  assert.match(kougoPhil.verses.find((v) => v.verse === 19)?.text ?? "", /見本|いっさいの必要|満た/);

  const cuvsCor = await loadChapter("cuvs", { book: "哥林多前书", chapter: 13 });
  assert.ok(!("external" in cuvsCor));
  assert.equal(cuvsCor.book, "1Cor");
  assert.ok(cuvsCor.verses.length >= 13);
  assert.match(cuvsCor.verses.find((v) => v.verse === 4)?.text ?? "", /爱是恒久忍耐|恩慈/);
  assert.match(cuvsCor.verses.find((v) => v.verse === 13)?.text ?? "", /样例|最大的是爱/);

  const kougoCor = await loadChapter("kougo", { book: "コリント第一", chapter: 13 });
  assert.ok(!("external" in kougoCor));
  assert.ok(kougoCor.verses.length >= 13);
  assert.match(kougoCor.verses.find((v) => v.verse === 13)?.text ?? "", /見本|最も大いなるものは、愛/);
});

test("loadChapter returns denser John.15 vine scaffolds (PD + licensed peers)", async () => {
  const web = await loadChapter("web", { book: "John", chapter: 15 });
  assert.ok(!("external" in web));
  assert.ok(web.verses.length >= 27);
  assert.equal(web.verses[0]?.verse, 1);
  assert.equal(web.verses[web.verses.length - 1]?.verse, 27);
  assert.match(web.verses.find((v) => v.verse === 1)?.text ?? "", /true vine/i);
  assert.match(web.verses.find((v) => v.verse === 5)?.text ?? "", /branches|apart from me/i);
  assert.match(web.verses.find((v) => v.verse === 13)?.text ?? "", /lay down his life|friends/i);
  assert.match(web.verses.find((v) => v.verse === 17)?.text ?? "", /love one another/i);
  assert.match(web.verses.find((v) => v.verse === 26)?.text ?? "", /Counselor|Spirit of truth|testify/i);
  assert.match(web.verses.find((v) => v.verse === 27)?.text ?? "", /testify|beginning/i);

  const kjv = await loadChapter("kjv", { book: "John", chapter: 15 });
  assert.ok(!("external" in kjv));
  assert.ok(kjv.verses.length >= 27);
  assert.match(kjv.verses.find((v) => v.verse === 5)?.text ?? "", /ye are the branches|without me/i);
  assert.match(kjv.verses.find((v) => v.verse === 27)?.text ?? "", /bear witness|beginning/i);

  const asv = await loadChapter("asv", { book: "John", chapter: 15 });
  assert.ok(!("external" in asv));
  assert.ok(asv.verses.length >= 27);
  assert.match(asv.verses.find((v) => v.verse === 5)?.text ?? "", /apart from me/i);
  assert.match(asv.verses.find((v) => v.verse === 27)?.text ?? "", /bear witness|beginning/i);

  for (const tid of ["cuvs", "cuvt", "rcuv", "ccb", "lzz"] as const) {
    const ch = await loadChapter(tid, { book: "John", chapter: 15 });
    assert.ok(!("external" in ch), tid);
    assert.ok(ch.verses.length >= 27, tid);
    assert.equal(ch.verses[ch.verses.length - 1]?.verse, 27, tid);
    assert.match(ch.verses.find((v) => v.verse === 5)?.text ?? "", /葡萄|枝/, tid);
    assert.match(ch.verses.find((v) => v.verse === 13)?.text ?? "", /舍命|捨命|朋友/, tid);
    assert.match(ch.verses.find((v) => v.verse === 26)?.text ?? "", /保惠师|保惠師|圣灵|聖靈|见证|見證/, tid);
    assert.match(ch.verses.find((v) => v.verse === 27)?.text ?? "", /见证|見證|起头|起頭/, tid);
  }

  for (const tid of ["kougo", "shinkaiyaku", "shinKyoudou"] as const) {
    const ch = await loadChapter(tid, { book: "John", chapter: 15 });
    assert.ok(!("external" in ch), tid);
    assert.ok(ch.verses.length >= 27, tid);
    assert.equal(ch.verses[ch.verses.length - 1]?.verse, 27, tid);
    assert.match(ch.verses.find((v) => v.verse === 5)?.text ?? "", /ぶどう|枝/, tid);
    assert.match(ch.verses.find((v) => v.verse === 13)?.text ?? "", /命|友/, tid);
    assert.match(ch.verses.find((v) => v.verse === 26)?.text ?? "", /助け主|御霊|あかし/, tid);
    assert.match(ch.verses.find((v) => v.verse === 27)?.text ?? "", /あかし|初め/, tid);
  }
});

test("loadChapter returns PD John.14 / Rom.12 / 1John.4 scaffolds (web/kjv/asv)", async () => {
  const john14 = await loadChapter("web", { book: "John", chapter: 14 });
  assert.ok(!("external" in john14));
  assert.equal(john14.source, "local");
  assert.equal(john14.chapter, 14);
  assert.ok(john14.verses.length >= 31);
  assert.equal(john14.verses[0]?.verse, 1);
  assert.equal(john14.verses[john14.verses.length - 1]?.verse, 31);
  assert.match(john14.verses.find((v) => v.verse === 6)?.text ?? "", /way, the truth, and the life/i);
  assert.match(john14.verses.find((v) => v.verse === 16)?.text ?? "", /Counselor|Comforter|Spirit/i);
  assert.match(john14.verses.find((v) => v.verse === 26)?.text ?? "", /Counselor|Holy Spirit|teach you all/i);
  assert.match(john14.verses.find((v) => v.verse === 27)?.text ?? "", /Peace I leave with you/i);
  assert.match(john14.verses.find((v) => v.verse === 31)?.text ?? "", /Arise.*go|let's go from here/i);

  const kjv14 = await loadChapter("kjv", { book: "John", chapter: 14 });
  assert.ok(!("external" in kjv14));
  assert.ok(kjv14.verses.length >= 31);
  assert.match(kjv14.verses.find((v) => v.verse === 2)?.text ?? "", /mansions|Father's house/i);
  assert.match(kjv14.verses.find((v) => v.verse === 31)?.text ?? "", /Arise, let us go hence/i);

  const asv14 = await loadChapter("asv", { book: "John", chapter: 14 });
  assert.ok(!("external" in asv14));
  assert.ok(asv14.verses.length >= 31);
  assert.match(asv14.verses.find((v) => v.verse === 17)?.text ?? "", /Spirit of truth/i);

  const cuvs14 = await loadChapter("cuvs", { book: "John", chapter: 14 });
  assert.ok(!("external" in cuvs14));
  assert.ok(cuvs14.verses.length >= 31);
  assert.equal(cuvs14.verses[cuvs14.verses.length - 1]?.verse, 31);
  assert.match(cuvs14.verses.find((v) => v.verse === 6)?.text ?? "", /道路|真理|生命/);
  assert.match(cuvs14.verses.find((v) => v.verse === 3)?.text ?? "", /再来|预备/);
  assert.match(cuvs14.verses.find((v) => v.verse === 27)?.text ?? "", /平安|忧愁|胆怯/);
  assert.match(cuvs14.verses.find((v) => v.verse === 31)?.text ?? "", /样例|起来|走吧/);
  const kougo14 = await loadChapter("kougo", { book: "John", chapter: 14 });
  assert.ok(!("external" in kougo14));
  assert.ok(kougo14.verses.length >= 31);
  assert.equal(kougo14.verses[kougo14.verses.length - 1]?.verse, 31);
  assert.match(kougo14.verses.find((v) => v.verse === 6)?.text ?? "", /道であり|真理|命である/);
  assert.match(kougo14.verses.find((v) => v.verse === 16)?.text ?? "", /助け主/);
  assert.match(kougo14.verses.find((v) => v.verse === 31)?.text ?? "", /見本|立て|出かけて/);

  const cuvt14 = await loadChapter("cuvt", { book: "John", chapter: 14 });
  assert.ok(!("external" in cuvt14));
  assert.ok(cuvt14.verses.length >= 31);
  assert.match(cuvt14.verses.find((v) => v.verse === 6)?.text ?? "", /道路|真理|生命/);
  assert.match(cuvt14.verses.find((v) => v.verse === 1)?.text ?? "", /心裏|憂愁|你們/);

  for (const tid of ["rcuv", "ccb", "lzz"] as const) {
    const ch = await loadChapter(tid, { book: "John", chapter: 14 });
    assert.ok(!("external" in ch), tid);
    assert.ok(ch.verses.length >= 31, tid);
    assert.equal(ch.verses[ch.verses.length - 1]?.verse, 31, tid);
    assert.match(ch.verses.find((v) => v.verse === 6)?.text ?? "", /道路|真理|生命/);
    assert.match(ch.verses.find((v) => v.verse === 16)?.text ?? "", /保惠师|圣灵|圣灵|保惠/);
  }
  for (const tid of ["shinkaiyaku", "shinKyoudou"] as const) {
    const ch = await loadChapter(tid, { book: "John", chapter: 14 });
    assert.ok(!("external" in ch), tid);
    assert.ok(ch.verses.length >= 31, tid);
    assert.equal(ch.verses[ch.verses.length - 1]?.verse, 31, tid);
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
  assert.ok(jn4.verses.length >= 21);
  assert.equal(jn4.verses[0]?.verse, 1);
  assert.equal(jn4.verses[jn4.verses.length - 1]?.verse, 21);
  assert.match(jn4.verses.find((v) => v.verse === 1)?.text ?? "", /prove the spirits|believe not every spirit|false prophets/i);
  assert.match(jn4.verses.find((v) => v.verse === 4)?.text ?? "", /greater is he|overcome/i);
  assert.match(jn4.verses.find((v) => v.verse === 8)?.text ?? "", /God is love/i);
  assert.match(jn4.verses.find((v) => v.verse === 18)?.text ?? "", /perfect love|casteth out fear|casts out fear/i);
  assert.match(jn4.verses.find((v) => v.verse === 19)?.text ?? "", /first loved us/i);

  const webJn4 = await loadChapter("web", { book: "1John", chapter: 4 });
  assert.ok(!("external" in webJn4));
  assert.ok(webJn4.verses.length >= 21);
  assert.equal(webJn4.verses[0]?.verse, 1);
  assert.match(webJn4.verses.find((v) => v.verse === 1)?.text ?? "", /test the spirits|false prophets/i);
  assert.match(webJn4.verses.find((v) => v.verse === 10)?.text ?? "", /atoning sacrifice|propitiation/i);

  const kjvJn4 = await loadChapter("kjv", { book: "1John", chapter: 4 });
  assert.ok(!("external" in kjvJn4));
  assert.ok(kjvJn4.verses.length >= 21);
  assert.match(kjvJn4.verses.find((v) => v.verse === 1)?.text ?? "", /try the spirits|false prophets/i);
  assert.match(kjvJn4.verses.find((v) => v.verse === 21)?.text ?? "", /love his brother/i);

  const cuvsJn4 = await loadChapter("cuvs", { book: "1John", chapter: 4 });
  assert.ok(!("external" in cuvsJn4));
  assert.ok(cuvsJn4.verses.length >= 21);
  assert.equal(cuvsJn4.verses[0]?.verse, 1);
  assert.match(cuvsJn4.verses.find((v) => v.verse === 1)?.text ?? "", /试验|假先知|灵/);
  assert.match(cuvsJn4.verses.find((v) => v.verse === 4)?.text ?? "", /属神|胜了|更大/);
  assert.match(cuvsJn4.verses.find((v) => v.verse === 8)?.text ?? "", /神就是爱|上帝就是爱/);
  assert.match(cuvsJn4.verses.find((v) => v.verse === 18)?.text ?? "", /惧怕|完全/);
  const kougoJn4 = await loadChapter("kougo", { book: "1John", chapter: 4 });
  assert.ok(!("external" in kougoJn4));
  assert.ok(kougoJn4.verses.length >= 21);
  assert.equal(kougoJn4.verses[0]?.verse, 1);
  assert.match(kougoJn4.verses.find((v) => v.verse === 1)?.text ?? "", /霊|ためし|にせ預言者/);
  assert.match(kougoJn4.verses.find((v) => v.verse === 4)?.text ?? "", /うち勝|大いなる/);
  assert.match(kougoJn4.verses.find((v) => v.verse === 8)?.text ?? "", /神は愛である/);
  assert.match(kougoJn4.verses.find((v) => v.verse === 19)?.text ?? "", /まず|愛して/);
});

test("loadChapter returns zh/ja Matthew.5 Beatitudes scaffolds (cuvs/kougo)", async () => {
  const cuvs5 = await loadChapter("cuvs", { book: "Matt", chapter: 5 });
  assert.ok(!("external" in cuvs5));
  assert.ok(cuvs5.verses.length >= 48);
  assert.equal(cuvs5.verses[cuvs5.verses.length - 1]?.verse, 48);
  assert.match(cuvs5.verses.find((v) => v.verse === 3)?.text ?? "", /虚心|有福/);
  assert.match(cuvs5.verses.find((v) => v.verse === 9)?.text ?? "", /和睦|神的儿子/);
  assert.match(cuvs5.verses.find((v) => v.verse === 11)?.text ?? "", /辱骂|逼迫|毁谤/);
  assert.match(cuvs5.verses.find((v) => v.verse === 12)?.text ?? "", /欢喜快乐|赏赐/);
  assert.match(cuvs5.verses.find((v) => v.verse === 13)?.text ?? "", /世上的盐|盐/);
  assert.match(cuvs5.verses.find((v) => v.verse === 44)?.text ?? "", /爱.*仇敌|仇敌/);
  assert.match(cuvs5.verses.find((v) => v.verse === 48)?.text ?? "", /完全/);

  const cuvt5 = await loadChapter("cuvt", { book: "Matt", chapter: 5 });
  assert.ok(!("external" in cuvt5));
  assert.ok(cuvt5.verses.length >= 48);
  assert.equal(cuvt5.verses[cuvt5.verses.length - 1]?.verse, 48);
  assert.match(cuvt5.verses.find((v) => v.verse === 12)?.text ?? "", /歡喜快樂|賞賜/);
  assert.match(cuvt5.verses.find((v) => v.verse === 48)?.text ?? "", /完全/);

  const rcuv5 = await loadChapter("rcuv", { book: "Matt", chapter: 5 });
  assert.ok(!("external" in rcuv5));
  assert.ok(rcuv5.verses.length >= 48);

  const ccb5 = await loadChapter("ccb", { book: "Matt", chapter: 5 });
  assert.ok(!("external" in ccb5));
  assert.ok(ccb5.verses.length >= 48);
  assert.match(ccb5.verses.find((v) => v.verse === 11)?.text ?? "", /迫害|辱骂|逼迫/);

  const lzz5 = await loadChapter("lzz", { book: "Matt", chapter: 5 });
  assert.ok(!("external" in lzz5));
  assert.ok(lzz5.verses.length >= 48);

  const kougo5 = await loadChapter("kougo", { book: "Matt", chapter: 5 });
  assert.ok(!("external" in kougo5));
  assert.ok(kougo5.verses.length >= 48);
  assert.equal(kougo5.verses[kougo5.verses.length - 1]?.verse, 48);
  assert.match(kougo5.verses.find((v) => v.verse === 3)?.text ?? "", /心の貧しい|さいわい/);
  assert.match(kougo5.verses.find((v) => v.verse === 9)?.text ?? "", /平和|神の子/);
  assert.match(kougo5.verses.find((v) => v.verse === 12)?.text ?? "", /報い|預言者/);
  assert.match(kougo5.verses.find((v) => v.verse === 13)?.text ?? "", /塩/);
  assert.match(kougo5.verses.find((v) => v.verse === 44)?.text ?? "", /敵を愛し/);
  assert.match(kougo5.verses.find((v) => v.verse === 48)?.text ?? "", /完全/);

  const shinkaiyaku5 = await loadChapter("shinkaiyaku", { book: "Matt", chapter: 5 });
  assert.ok(!("external" in shinkaiyaku5));
  assert.ok(shinkaiyaku5.verses.length >= 48);
  assert.match(shinkaiyaku5.verses.find((v) => v.verse === 12)?.text ?? "", /報い|預言者/);
  assert.match(shinkaiyaku5.verses.find((v) => v.verse === 48)?.text ?? "", /完全/);

  const shinKyoudou5 = await loadChapter("shinKyoudou", { book: "Matt", chapter: 5 });
  assert.ok(!("external" in shinKyoudou5));
  assert.ok(shinKyoudou5.verses.length >= 48);
  assert.match(shinKyoudou5.verses.find((v) => v.verse === 12)?.text ?? "", /報い|預言者/);
  assert.match(shinKyoudou5.verses.find((v) => v.verse === 48)?.text ?? "", /完全/);
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
  assert.ok(gen1.verses.length >= 31);
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
