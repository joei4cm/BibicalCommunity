#!/usr/bin/env bash
# Prove theme-pack pipeline: first-party local packs + licensed R2 stub shape.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
pnpm --filter @logoshome/bible build >/dev/null
node --input-type=module -e '
import {
  listThemePacks,
  parseThemePackManifest,
  buildThemePackManifestJson,
  probeThemePackPipeline,
  r2ThemePackObjectKey,
  getThemePack,
} from "./packages/bible/dist/index.js";

const probe = probeThemePackPipeline();
if (!probe.ok) throw new Error("theme pack pipeline probe failed");
if (probe.firstPartyCount < 4) throw new Error("need >=4 first-party packs");

for (const id of ["default", "parchment", "paper", "ink"]) {
  const p = getThemePack(id);
  if (!p || p.provider !== "local" || !p.available) {
    throw new Error("missing first-party pack " + id);
  }
}

const licensed = listThemePacks({ license: "licensed" });
if (!licensed.length) throw new Error("expected licensed stub");
const stub = licensed[0];
if (stub.provider !== "r2") throw new Error("licensed stub must be r2");
if (stub.r2Key !== r2ThemePackObjectKey(stub.id)) {
  throw new Error("r2 key mismatch");
}

// Roundtrip JSON is the R2 drop format for future publisher packs.
const raw = buildThemePackManifestJson(getThemePack("parchment"));
const again = parseThemePackManifest(raw);
if (again.id !== "parchment") throw new Error("roundtrip failed");

console.log(
  "THEME_PACK_PIPELINE_OK firstParty=" +
    probe.firstPartyCount +
    " licensedStubs=" +
    probe.licensedStubCount +
    " ids=" +
    probe.sampleIds.join(","),
);
'
