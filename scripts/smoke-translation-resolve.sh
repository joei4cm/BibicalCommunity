#!/usr/bin/env bash
# Prove every registry translation has a loadChapter resolve path
# (local verses | external URL | r2 stub-or-scaffold).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
pnpm --filter @logoshome/bible build >/dev/null
node --input-type=module -e '
import { listTranslations, loadChapter } from "./packages/bible/dist/index.js";

const all = listTranslations();
if (all.length < 20) throw new Error("registry too small: " + all.length);

const summary = { localProvider: 0, external: 0, r2: 0, localHit: 0, r2Stub: 0 };
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
    if (result.source !== "local" || !result.verses?.length) {
      throw new Error(t.id + ": local provider must return local verses");
    }
    summary.localProvider++;
    summary.localHit++;
    continue;
  }

  if (t.provider === "r2") {
    // Prefer in-repo scaffold; otherwise package-level R2 stub (Worker MEDIA fills it).
    if (result.source === "local") {
      if (!result.verses?.length) throw new Error(t.id + ": empty local scaffold");
      summary.localHit++;
    } else if (result.source === "r2") {
      summary.r2Stub++;
    } else {
      throw new Error(t.id + ": r2 provider unresolved source=" + result.source);
    }
    summary.r2++;
    continue;
  }

  throw new Error(t.id + ": unknown provider " + t.provider);
}

if (summary.localProvider < 4) {
  throw new Error("expected >=4 local providers, got " + summary.localProvider);
}
if (summary.external < 8) {
  throw new Error("expected >=8 external providers, got " + summary.external);
}
if (summary.r2 < 5) {
  throw new Error("expected >=5 r2 providers, got " + summary.r2);
}

// PD triad denser chapters must resolve locally.
for (const ref of [
  { book: "John", chapter: 14 },
  { book: "Rom", chapter: 12 },
  { book: "1John", chapter: 4 },
]) {
  for (const id of ["web", "kjv", "asv"]) {
    const ch = await loadChapter(id, ref);
    if ("external" in ch) throw new Error(id + " " + ref.book + "." + ref.chapter + " external");
    if (ch.source !== "local" || !ch.verses.length) {
      throw new Error(id + " missing local " + ref.book + "." + ref.chapter);
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
    " localHit=" +
    summary.localHit +
    " r2Stub=" +
    summary.r2Stub,
);
'
