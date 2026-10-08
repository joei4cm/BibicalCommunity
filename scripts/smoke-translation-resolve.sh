#!/usr/bin/env bash
# Prove every registry translation has a loadChapter resolve path
# (external URL | r2 stub — verses come from R2/local DB, never TypeScript packs).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
pnpm --filter @logoshome/bible build >/dev/null
node --input-type=module -e '
import { existsSync } from "node:fs";
import { join } from "node:path";
import { listTranslations, loadChapter } from "./packages/bible/dist/index.js";

if (existsSync(join("packages/bible/src/packs"))) {
  throw new Error("packages/bible/src/packs must not exist");
}

const all = listTranslations();
if (all.length < 20) throw new Error("registry too small: " + all.length);

const summary = { localProvider: 0, external: 0, r2: 0, r2Stub: 0 };
for (const t of all) {
  const result = await loadChapter(t.id, { book: "John", chapter: 1 });

  if (t.provider === "external") {
    if (!("external" in result) || !result.external) {
      throw new Error(t.id + ": external provider must resolve to deep-link");
    }
    if (!result.url || result.url.length < 8) {
      throw new Error(t.id + ": external URL missing");
    }
    summary.external++;
    continue;
  }

  if ("external" in result && result.external) {
    throw new Error(t.id + ": non-external provider returned deep-link");
  }

  if (t.provider === "local") {
    throw new Error(t.id + ": provider=local is retired — use r2 + download");
  }

  if (t.provider === "r2") {
    if (result.source !== "r2") {
      throw new Error(t.id + ": r2 provider unresolved source=" + result.source);
    }
    if (result.verses.length !== 0) {
      throw new Error(t.id + ": package must not embed verses (got " + result.verses.length + ")");
    }
    summary.r2++;
    summary.r2Stub++;
    continue;
  }

  throw new Error(t.id + ": unknown provider " + t.provider);
}

if (summary.localProvider !== 0) {
  throw new Error("expected 0 local providers, got " + summary.localProvider);
}
if (summary.external < 8) {
  throw new Error("expected >=8 external providers, got " + summary.external);
}
if (summary.r2 < 10) {
  throw new Error("expected >=10 r2 providers, got " + summary.r2);
}

// PD triad chapters resolve as empty R2 stubs (content from fixtures/download).
for (const ref of [
  { book: "John", chapter: 14 },
  { book: "Rom", chapter: 12 },
  { book: "1John", chapter: 4 },
]) {
  for (const id of ["web", "kjv", "asv"]) {
    const ch = await loadChapter(id, ref);
    if ("external" in ch) throw new Error(id + " " + ref.book + "." + ref.chapter + " external");
    if (ch.source !== "r2") {
      throw new Error(id + " expected r2 stub for " + ref.book + "." + ref.chapter);
    }
  }
}

console.log(
  "TRANSLATION_RESOLVE_PATH_OK count=" +
    all.length +
    " localProvider=" +
    summary.localProvider +
    " external=" +
    summary.external +
    " r2=" +
    summary.r2 +
    " r2Stub=" +
    summary.r2Stub,
);
'
