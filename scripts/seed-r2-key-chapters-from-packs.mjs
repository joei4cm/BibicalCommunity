#!/usr/bin/env node
/**
 * Seed licensed R2 chapter objects from local scaffolds for high-traffic refs.
 * Usage: node scripts/seed-r2-key-chapters-from-packs.mjs <BASE> <TOKEN>
 */
import {
  buildR2ChapterJson,
  listTranslations,
  loadChapter,
  r2ChapterObjectKey,
} from "../packages/bible/dist/index.js";

const BASE = process.argv[2] ?? "http://127.0.0.1:8787";
const TOKEN = process.argv[3];
if (!TOKEN) {
  console.error("usage: seed-r2-key-chapters-from-packs.mjs <BASE> <TOKEN>");
  process.exit(1);
}

const KEY_REFS = [
  { book: "John", chapter: 14 },
  { book: "John", chapter: 15 },
  { book: "Matt", chapter: 5 },
  { book: "Matt", chapter: 6 },
  { book: "Gen", chapter: 1 },
  { book: "Ps", chapter: 1 },
  { book: "Ps", chapter: 23 },
  { book: "Prov", chapter: 3 },
  { book: "Rom", chapter: 8 },
  { book: "Rom", chapter: 12 },
  { book: "Heb", chapter: 11 },
  { book: "Isa", chapter: 53 },
  { book: "Acts", chapter: 2 },
  { book: "1John", chapter: 4 },
];

const tids = listTranslations()
  .filter((t) => t.provider === "r2" && t.license === "licensed")
  .map((t) => t.id);

let seeded = 0;
let skipped = 0;

for (const tid of tids) {
  for (const ref of KEY_REFS) {
    let chapter;
    try {
      chapter = await loadChapter(tid, ref);
    } catch {
      skipped += 1;
      continue;
    }
    if ("external" in chapter || chapter.source !== "local" || !chapter.verses?.length) {
      skipped += 1;
      continue;
    }
    const key = r2ChapterObjectKey(tid, chapter.book, chapter.chapter);
    const body = buildR2ChapterJson({
      book: chapter.book,
      chapter: chapter.chapter,
      verses: chapter.verses,
    });
    const res = await fetch(`${BASE}/v1/media/put/${key}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "content-type": "application/json",
      },
      body,
    });
    if (!res.ok) {
      throw new Error(`put failed ${key} status=${res.status}`);
    }
    seeded += 1;
    console.log(`SEED_PUT ok tid=${tid} ref=${chapter.book}.${chapter.chapter} key=${key} verses=${chapter.verses.length}`);
  }
}

console.log(`SEED_KEY_CHAPTERS_FROM_PACKS_OK seeded=${seeded} skipped=${skipped} tids=${tids.join(",")}`);
if (seeded < 80) {
  throw new Error(`expected >=80 seeded key chapters, got ${seeded}`);
}
