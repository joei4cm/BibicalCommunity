#!/usr/bin/env bash
# Prove devotion-pack pipeline: local CC0 packs + licensed R2 stub shape.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
pnpm --filter @logoshome/bible build >/dev/null
node --input-type=module -e '
import {
  listDevotionPacks,
  listDevotionMaterials,
  probeDevotionPackPipeline,
  r2DevotionPackObjectKey,
  getDevotionPack,
  buildDevotionPackManifestJson,
  parseDevotionPackManifest,
} from "./packages/bible/dist/index.js";

const probe = probeDevotionPackPipeline();
if (!probe.ok) throw new Error("devotion pack pipeline probe failed");
if (probe.localCount < 5) throw new Error("need >=5 local devotion packs");

// Pack catalog must cover the legacy material list used by plans UI.
const materials = listDevotionMaterials();
for (const m of materials) {
  const pack = getDevotionPack(m.id);
  if (!pack || !pack.available || pack.provider !== "local") {
    throw new Error("missing local pack for material " + m.id);
  }
}

const licensed = listDevotionPacks({ provider: "r2" });
if (!licensed.length) throw new Error("expected licensed stub");
if (licensed[0].r2Key !== r2DevotionPackObjectKey(licensed[0].id)) {
  throw new Error("r2 key mismatch");
}

const raw = buildDevotionPackManifestJson(getDevotionPack("lectio-breve"));
const again = parseDevotionPackManifest(raw);
if (again.id !== "lectio-breve") throw new Error("roundtrip failed");

console.log(
  "DEVOTION_PACK_PIPELINE_OK local=" +
    probe.localCount +
    " licensedStubs=" +
    probe.licensedStubCount +
    " ids=" +
    probe.sampleIds.join(","),
);
'
