#!/usr/bin/env bash
# Inventory local dual-pane scaffolds across zh/en/ja mainstream translations.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
pnpm --filter @logoshome/bible build >/dev/null
node --input-type=module -e '
import { listLocalScaffoldInventory, listTranslations, listDevotionMaterials } from "./packages/bible/dist/index.js";

const inv = listLocalScaffoldInventory();
if (inv.length < 100) throw new Error("expected >=100 local scaffold chapters, got " + inv.length);

const byLang = { zh: 0, en: 0, ja: 0 };
const metas = Object.fromEntries(listTranslations().map((t) => [t.id, t]));
for (const row of inv) {
  const lang = metas[row.translationId]?.language;
  if (lang === "zh" || lang === "en" || lang === "ja") byLang[lang]++;
}
if (byLang.en < 20) throw new Error("en scaffolds too few: " + byLang.en);
if (byLang.zh < 10) throw new Error("zh scaffolds too few: " + byLang.zh);
if (byLang.ja < 10) throw new Error("ja scaffolds too few: " + byLang.ja);

const needRefs = [
  "John.15",
  "Rev.21",
  "Phil.4",
  "1Cor.13",
  "Matt.6",
  "Gal.5",
  "Jas.1",
  "Col.3",
  "Matt.28",
  "Eph.2",
  "John.14",
  "Rom.12",
  "1John.4",
];
for (const ref of needRefs) {
  if (!inv.some((r) => r.ref === ref && r.translationId === "web")) {
    throw new Error("missing web scaffold " + ref);
  }
}
for (const tid of ["web", "kjv", "asv"]) {
  for (const ref of ["John.14", "Rom.12", "1John.4"]) {
    if (!inv.some((r) => r.ref === ref && r.translationId === tid)) {
      throw new Error("missing PD triad scaffold " + tid + " " + ref);
    }
  }
}
const devotion = listDevotionMaterials();
if (devotion.length < 5) throw new Error("expected >=5 devotion materials, got " + devotion.length);
for (const m of devotion) {
  for (const loc of ["zh-CN", "en", "ja"]) {
    if (!m.title[loc]?.trim() || !m.body[loc]?.trim()) throw new Error("devotion incomplete " + m.id + " " + loc);
  }
}

console.log("CORPUS_SCAFFOLD_COUNT=" + inv.length);
console.log("CORPUS_SCAFFOLD_LANG en=" + byLang.en + " zh=" + byLang.zh + " ja=" + byLang.ja);
console.log("CORPUS_SCAFFOLD_INVENTORY_OK");
console.log("DEVOTION_MATERIALS_OK count=" + devotion.length);
'
