#!/usr/bin/env bash
# Prove corpus-pack pipeline: R2 download/boot packs (no TypeScript densify).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
pnpm --filter @logoshome/bible build >/dev/null
node --input-type=module -e '
import {
  listCorpusPacks,
  probeCorpusPackPipeline,
  r2CorpusPackPrefix,
  getCorpusPack,
  buildCorpusPackManifestJson,
  parseCorpusPackManifest,
  buildLocalCorpusPacks,
  listLocalScaffoldInventory,
  BOOT_DEFAULT_TRANSLATION_IDS,
} from "./packages/bible/dist/index.js";
import { r2ChapterObjectKey } from "./packages/bible/dist/index.js";
import { existsSync } from "node:fs";
import { join } from "node:path";

if (existsSync(join("packages/bible/src/packs"))) {
  throw new Error("packages/bible/src/packs must not exist — corpora are JSON/R2 only");
}
if (buildLocalCorpusPacks().length !== 0) {
  throw new Error("local TS corpus packs must be empty");
}
if (listLocalScaffoldInventory().length !== 0) {
  throw new Error("scaffold inventory must be empty (no TS densify)");
}

const probe = probeCorpusPackPipeline();
if (!probe.ok) throw new Error("corpus pack pipeline probe failed");
if (probe.bootCount !== BOOT_DEFAULT_TRANSLATION_IDS.length) {
  throw new Error("bootCount must be " + BOOT_DEFAULT_TRANSLATION_IDS.length + " (和合本+NASB)");
}
if (probe.downloadableCount < 8) throw new Error("need >=8 downloadable packs");
if (!probe.noTsPacks) throw new Error("noTsPacks must be true");

const web = getCorpusPack("web-r2");
if (!web?.available) throw new Error("missing web-r2 pack");
if (!web.chapterRefs.includes("John.1")) throw new Error("web-r2 missing John.1");
if (web.provider !== "r2") throw new Error("web pack must be r2");

for (const id of BOOT_DEFAULT_TRANSLATION_IDS) {
  const p = getCorpusPack(id + "-r2");
  if (!p || p.installMode !== "boot") throw new Error("missing boot pack " + id);
}

const packs = listCorpusPacks({ provider: "r2", availableOnly: true });
if (packs.length < 8) throw new Error("expected >=8 available r2 packs");
for (const p of packs) {
  if (p.r2Prefix !== r2CorpusPackPrefix(p.translationId)) {
    throw new Error("r2 prefix mismatch " + p.id);
  }
  if (!p.sampleR2Keys.includes(r2ChapterObjectKey(p.translationId, "John", 1))) {
    throw new Error("missing John.1 sample key " + p.id);
  }
}

const raw = buildCorpusPackManifestJson(web);
const again = parseCorpusPackManifest(raw);
if (again.id !== "web-r2") throw new Error("roundtrip failed");

console.log(
  "CORPUS_PACK_PIPELINE_OK boot=" +
    probe.bootCount +
    " downloadable=" +
    probe.downloadableCount +
    " chapters=" +
    probe.localChapterTotal +
    " noTsPacks=" +
    probe.noTsPacks +
    " langs=en:" +
    probe.languages.en +
    ",zh:" +
    probe.languages.zh +
    ",ja:" +
    probe.languages.ja,
);
'
