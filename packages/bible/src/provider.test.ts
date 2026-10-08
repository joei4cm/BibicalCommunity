import { test } from "node:test";
import assert from "node:assert/strict";
import { loadChapter, listLocalScaffoldInventory, normalizeBookKey, canonicalBookId } from "./provider.js";
import { getTranslation, listTranslations } from "./translations.js";
import {
  BOOT_DEFAULT_TRANSLATION_IDS,
  listDownloadableCorpusCatalog,
} from "./local-corpus-db.js";

test("loadChapter returns empty R2 stub for boot/download translations (no TS verses)", async () => {
  for (const id of ["web", "cuvs", "shinKyoudou", "kjv", "asv", "cuvt", "kougo"]) {
    const result = await loadChapter(id, { book: "John", chapter: 1 });
    assert.ok(!("external" in result), id);
    assert.equal(result.source, "r2", id);
    assert.equal(result.verses.length, 0, id);
    assert.equal(result.translationId, id);
    assert.equal(result.book, "John");
  }
});

test("loadChapter returns external deep-links for ESV/NIV and partners", async () => {
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

test("PD + licensed downloadable translations use provider r2 (not local TS)", () => {
  for (const id of ["web", "kjv", "asv", "kougoyaku-pd", "cuvs", "kougo", "shinKyoudou"]) {
    const meta = getTranslation(id);
    assert.ok(meta, `missing translation ${id}`);
    assert.equal(meta.available, true);
    assert.equal(meta.provider, "r2");
  }
});

test("boot catalog is cuvs + web + shinKyoudou; ESV is external", () => {
  const catalog = listDownloadableCorpusCatalog();
  const boot = catalog.filter((p) => p.installMode === "boot");
  assert.equal(boot.length, 3);
  assert.deepEqual(
    boot.map((b) => b.translationId).sort(),
    [...BOOT_DEFAULT_TRANSLATION_IDS].sort(),
  );
  const esv = catalog.find((p) => p.translationId === "esv");
  assert.ok(esv);
  assert.equal(esv.installMode, "external");
});

test("listLocalScaffoldInventory is empty (no TS densify packs)", () => {
  assert.deepEqual(listLocalScaffoldInventory(), []);
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

test("normalizeBookKey + canonicalBookId cover common aliases", () => {
  assert.equal(normalizeBookKey("马太福音"), "matt");
  assert.equal(canonicalBookId("matt"), "Matt");
  assert.equal(normalizeBookKey("ヨハネ"), "john");
  assert.equal(canonicalBookId("1john"), "1John");
});
