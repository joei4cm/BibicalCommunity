#!/usr/bin/env bash
# Prove JSON fixture → local DB / R2 import path (no TypeScript densify).
# Tokens: CORPUS_JSON_IMPORT_OK / CORPUS_JSON_FIXTURE_OK
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
BASE="${1:-http://127.0.0.1:8787}"

pnpm --filter @logoshome/bible build >/dev/null

# Offline: fixtures on disk + LocalCorpusDb import
node --input-type=module -e '
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  parseCorpusFixtureChapter,
  inventoryFromChapterMap,
  importFixturesIntoLocalDb,
  probeCorpusJsonImport,
  MemoryLocalCorpusStore,
  LocalCorpusDb,
} from "./packages/bible/dist/index.js";

const FIX = join(process.cwd(), "fixtures", "corpus");
if (!existsSync(FIX)) throw new Error("missing fixtures/corpus");
const tids = readdirSync(FIX, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
if (tids.length < 8) throw new Error("need >=8 fixture tids (boot + downloadable peers)");
if (!tids.includes("cuvs") || !tids.includes("web") || !tids.includes("shinKyoudou")) {
  throw new Error("boot defaults must have fixtures");
}
for (const need of ["cuvt", "rcuv", "ccb", "lzz", "kougo", "shinkaiyaku", "kjv", "asv"]) {
  if (!tids.includes(need)) throw new Error("missing downloadable fixture tid=" + need);
}

const byTid = {};
let fileCount = 0;
for (const tid of tids) {
  const files = readdirSync(join(FIX, tid)).filter((f) => f.endsWith(".json"));
  byTid[tid] = files.map((f) => parseCorpusFixtureChapter(readFileSync(join(FIX, tid, f), "utf8")));
  fileCount += files.length;
}
if (fileCount < 20) throw new Error("need >=20 fixture chapter files, got " + fileCount);

const teaching = ["John.1.json", "John.3.json", "John.14.json", "Ps.23.json", "Rom.8.json", "Matt.5.json", "Gen.1.json"];
for (const tid of ["cuvs", "web", "shinKyoudou"]) {
  const files = readdirSync(join(FIX, tid)).filter((f) => f.endsWith(".json"));
  for (const need of teaching) {
    if (!files.includes(need)) throw new Error("boot teaching parity missing " + tid + "/" + need);
  }
}
for (const tid of ["kjv", "asv", "cuvt", "kougo"]) {
  const files = readdirSync(join(FIX, tid)).filter((f) => f.endsWith(".json"));
  for (const need of teaching) {
    if (!files.includes(need)) throw new Error("download teaching parity missing " + tid + "/" + need);
  }
}
console.log("CORPUS_BOOT_TEACHING_PARITY_OK");

const probe = await probeCorpusJsonImport(byTid);
if (!probe.ok) throw new Error("probeCorpusJsonImport failed " + JSON.stringify(probe));

const store = new MemoryLocalCorpusStore();
const inv = inventoryFromChapterMap("kougo", byTid.kougo ?? []);
if (inv.chapters.length < 1) throw new Error("kougo downloadable fixture missing");
await importFixturesIntoLocalDb(inv, store);
const db = new LocalCorpusDb(store);
const ch = await db.getChapter("kougo", "John", 1);
if (!ch?.verses[0]?.text.includes("fixture")) throw new Error("kougo local-db missing fixture text");

console.log(
  "CORPUS_JSON_FIXTURE_OK tids=" +
    tids.sort().join(",") +
    " files=" +
    fileCount +
    " probeChapters=" +
    probe.totalChapters,
);
'

# Live: seed fixtures into R2 when API is up
if curl -sf "$BASE/health" >/dev/null 2>&1; then
  HANDLE="jsonimp$(date +%s)"
  REG=$(curl -sf -X POST "$BASE/v1/auth/register" -H 'content-type: application/json' \
    -d "{\"handle\":\"$HANDLE\",\"password\":\"JsonImportPass123!\",\"nickname\":\"JsonImp\",\"locale\":\"zh\"}")
  TOKEN=$(echo "$REG" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
  test -n "$TOKEN"
  node "$ROOT/scripts/seed-r2-from-json-fixtures.mjs" "$BASE" "$TOKEN"

  # Download pack should now come from R2 (fixture text)
  DL=$(curl -sf "$BASE/v1/bible/corpus-download/cuvs")
  echo "$DL" | grep -q '"source":"r2"'
  echo "$DL" | grep -q 'fixture'
  echo "CORPUS_DOWNLOAD_FROM_FIXTURE_OK"

  for tid in web cuvs shinKyoudou; do
    DL_T=$(curl -sf "$BASE/v1/bible/corpus-download/$tid")
    echo "$DL_T" | grep -q '"source":"r2"'
    node -e 'const j=JSON.parse(process.argv[1]); if((j.chapterCount??j.chapters.length)<7) process.exit(2)' "$DL_T" || {
      echo "expected $tid pack >=7 teaching chapters after fixture expand"; exit 1
    }
    echo "CORPUS_BOOT_TEACHING_PACK_OK tid=$tid"
  done
  echo "CORPUS_WEB_TEACHING_PACK_OK"
else
  echo "CORPUS_JSON_IMPORT_SKIP_LIVE (api not running at $BASE)"
fi
