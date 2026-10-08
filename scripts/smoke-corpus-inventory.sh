#!/usr/bin/env bash
# Inventory JSON fixtures (not TypeScript densify packs) + devotion materials.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
pnpm --filter @logoshome/bible build >/dev/null
node --input-type=module -e '
import { readdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  listLocalScaffoldInventory,
  listTranslations,
  listDevotionMaterials,
  listDownloadableCorpusCatalog,
  BOOT_DEFAULT_TRANSLATION_IDS,
} from "./packages/bible/dist/index.js";

if (existsSync(join("packages/bible/src/packs"))) {
  throw new Error("packages/bible/src/packs must not exist");
}
if (listLocalScaffoldInventory().length !== 0) {
  throw new Error("TS scaffold inventory must be empty");
}

const fixturesRoot = join("fixtures", "corpus");
const tidDirs = readdirSync(fixturesRoot, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();
if (tidDirs.length < 3) throw new Error("expected >=3 fixture translation dirs");

const metas = Object.fromEntries(listTranslations().map((t) => [t.id, t]));
const byLang = { zh: 0, en: 0, ja: 0 };
let chapterFiles = 0;
for (const tid of tidDirs) {
  const files = readdirSync(join(fixturesRoot, tid)).filter((f) => f.endsWith(".json"));
  chapterFiles += files.length;
  const lang = metas[tid]?.language;
  if (lang === "zh" || lang === "en" || lang === "ja") byLang[lang] += files.length;
  for (const f of files) {
    const raw = readFileSync(join(fixturesRoot, tid, f), "utf8");
    const data = JSON.parse(raw);
    if (!data.book || !Array.isArray(data.verses)) {
      throw new Error("invalid fixture " + tid + "/" + f);
    }
  }
}
if (chapterFiles < 40) throw new Error("expected >=40 fixture chapters, got " + chapterFiles);
const teaching = ["John.1.json", "John.3.json", "John.14.json", "Ps.23.json", "Rom.8.json", "Matt.5.json", "Gen.1.json"];
for (const tid of ["cuvs", "web", "shinKyoudou"]) {
  const files = readdirSync(join(fixturesRoot, tid)).filter((f) => f.endsWith(".json"));
  for (const need of teaching) {
    if (!files.includes(need)) throw new Error("boot teaching parity missing " + tid + "/" + need);
  }
}
if (byLang.en < 3) throw new Error("en fixtures too few: " + byLang.en);

const catalog = listDownloadableCorpusCatalog();
const boot = catalog.filter((p) => p.installMode === "boot");
if (boot.length !== 3) throw new Error("boot catalog must be 3");
for (const id of BOOT_DEFAULT_TRANSLATION_IDS) {
  if (!boot.some((b) => b.translationId === id)) throw new Error("missing boot " + id);
}
const esv = catalog.find((p) => p.translationId === "esv");
if (!esv || esv.installMode !== "external") throw new Error("ESV must be external");

const devotion = listDevotionMaterials();
if (devotion.length < 5) throw new Error("expected >=5 devotion materials");

console.log(
  "CORPUS_SCAFFOLD_INVENTORY_OK fixtures=" +
    chapterFiles +
    " tids=" +
    tidDirs.length +
    " langs=en:" +
    byLang.en +
    ",zh:" +
    byLang.zh +
    ",ja:" +
    byLang.ja +
    " boot=" +
    boot.map((b) => b.translationId).join("+"),
);
console.log("DEVOTION_MATERIALS_OK count=" + devotion.length);
'
