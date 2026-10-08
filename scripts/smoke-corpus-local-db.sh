#!/usr/bin/env bash
# Prove download→local corpus DB path (not TypeScript densify).
# Tokens: CORPUS_LOCAL_DB_OK / CORPUS_CATALOG_OK / CORPUS_DOWNLOAD_OK
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
BASE="${1:-http://127.0.0.1:8787}"

pnpm --filter @logoshome/bible build >/dev/null

node --input-type=module -e '
import {
  BOOT_DEFAULT_TRANSLATION_IDS,
  listDownloadableCorpusCatalog,
  probeLocalCorpusPipeline,
  buildDemoDownloadPack,
  LocalCorpusDb,
  MemoryLocalCorpusStore,
} from "./packages/bible/dist/index.js";

const probe = await probeLocalCorpusPipeline();
if (!probe.ok) throw new Error("local corpus pipeline probe failed: " + JSON.stringify(probe));
if (probe.bootDefaults.length !== 3) throw new Error("boot defaults must be exactly 3");
if (!probe.bootDefaults.includes("cuvs") || !probe.bootDefaults.includes("web") || !probe.bootDefaults.includes("shinKyoudou")) {
  throw new Error("boot defaults must be cuvs/web/shinKyoudou");
}
const catalog = listDownloadableCorpusCatalog();
const esv = catalog.find((p) => p.translationId === "esv");
if (!esv || esv.installMode !== "external") throw new Error("ESV must be external (not bundled)");
const downloadable = catalog.filter((p) => p.installMode === "download");
if (downloadable.length < 5) throw new Error("need >=5 downloadable tids");

const db = new LocalCorpusDb(new MemoryLocalCorpusStore());
const pack = buildDemoDownloadPack("kougo");
await db.installPack("kougo", pack.chapters);
const ch = await db.getChapter("kougo", "John", 1);
if (!ch || ch.verses.length < 1) throw new Error("install/read failed");

console.log(
  "CORPUS_LOCAL_DB_OK boot=" +
    BOOT_DEFAULT_TRANSLATION_IDS.join(",") +
    " downloadable=" +
    downloadable.length +
    " external=" +
    probe.externalCount +
    " installedChapters=" +
    probe.installedAfterBoot,
);
'

# Live API catalog + download when server is up
if curl -sf "$BASE/health" >/dev/null 2>&1; then
  CAT=$(curl -sf "$BASE/v1/bible/corpus-catalog")
  echo "$CAT" | grep -q '"ok":true'
  echo "$CAT" | grep -q '"cuvs"'
  echo "$CAT" | grep -q '"web"'
  echo "$CAT" | grep -q '"shinKyoudou"'
  echo "$CAT" | grep -q 'downloadableCount'
  echo "CORPUS_CATALOG_OK"

  DL=$(curl -sf "$BASE/v1/bible/corpus-download/cuvt")
  echo "$DL" | grep -q '"translationId":"cuvt"'
  echo "$DL" | grep -q '"chapters"'
  echo "$DL" | grep -q 'John'
  echo "CORPUS_DOWNLOAD_OK tid=cuvt"

  EXT=$(curl -s -o /tmp/corpus-esv.json -w "%{http_code}" "$BASE/v1/bible/corpus-download/esv")
  test "$EXT" = "400"
  grep -q external_translation /tmp/corpus-esv.json
  echo "CORPUS_EXTERNAL_BLOCK_OK tid=esv"
else
  echo "CORPUS_CATALOG_SKIP (api not running at $BASE)"
  echo "CORPUS_DOWNLOAD_SKIP (api not running at $BASE)"
fi
