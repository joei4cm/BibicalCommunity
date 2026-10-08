#!/usr/bin/env bash
# Prove corpus-pack pipeline: local scaffold packs + licensed R2 full-corpus stubs.
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
  listLocalScaffoldInventory,
} from "./packages/bible/dist/index.js";
import { r2ChapterObjectKey } from "./packages/bible/dist/index.js";

const probe = probeCorpusPackPipeline();
if (!probe.ok) throw new Error("corpus pack pipeline probe failed");
if (probe.localCount < 5) throw new Error("need >=5 local corpus packs");
if (probe.localChapterTotal < 100) throw new Error("local chapters too few");

const inv = listLocalScaffoldInventory();
const webLocal = getCorpusPack("web-local");
if (!webLocal?.available) throw new Error("missing web-local pack");
if (!webLocal.chapterRefs.includes("John.3")) throw new Error("web-local missing John.3");
if (webLocal.chapterRefs.length > inv.filter((r) => r.translationId === "web").length) {
  throw new Error("web-local chapterRefs exceed inventory");
}

const licensed = listCorpusPacks({ provider: "r2" });
if (licensed.length < 5) throw new Error("expected >=5 licensed stubs");
for (const p of licensed) {
  if (p.available) throw new Error("licensed stub must be unavailable: " + p.id);
  if (p.r2Prefix !== r2CorpusPackPrefix(p.translationId)) {
    throw new Error("r2 prefix mismatch " + p.id);
  }
  if (!p.sampleR2Keys.includes(r2ChapterObjectKey(p.translationId, "John", 1))) {
    throw new Error("missing John.1 sample key " + p.id);
  }
}

const raw = buildCorpusPackManifestJson(webLocal);
const again = parseCorpusPackManifest(raw);
if (again.id !== "web-local") throw new Error("roundtrip failed");

console.log(
  "CORPUS_PACK_PIPELINE_OK local=" +
    probe.localCount +
    " chapters=" +
    probe.localChapterTotal +
    " licensedStubs=" +
    probe.licensedStubCount +
    " langs=en:" +
    probe.languages.en +
    ",zh:" +
    probe.languages.zh +
    ",ja:" +
    probe.languages.ja,
);
'
