#!/usr/bin/env node
/**
 * Fetch public-domain Bible chapters into fixtures/corpus/{tid}/ — not TypeScript packs.
 * Uses getbible.net (WEB / KJV / ASV). Licensed zh/ja tids are never overwritten.
 *
 * Usage:
 *   node scripts/fetch-pd-corpus-fixtures.mjs
 *   node scripts/fetch-pd-corpus-fixtures.mjs web kjv asv
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const FIX = join(ROOT, "fixtures", "corpus");

/** getbible.net book numbers (Protestant canon). */
const BOOK_NR = {
  Gen: 1,
  Exod: 2,
  Lev: 3,
  Num: 4,
  Deut: 5,
  Josh: 6,
  Judg: 7,
  Ruth: 8,
  "1Sam": 9,
  "2Sam": 10,
  "1Kgs": 11,
  "2Kgs": 12,
  "1Chr": 13,
  "2Chr": 14,
  Ezra: 15,
  Neh: 16,
  Esth: 17,
  Job: 18,
  Ps: 19,
  Prov: 20,
  Eccl: 21,
  Song: 22,
  Isa: 23,
  Jer: 24,
  Lam: 25,
  Ezek: 26,
  Dan: 27,
  Hos: 28,
  Joel: 29,
  Amos: 30,
  Obad: 31,
  Jonah: 32,
  Mic: 33,
  Nah: 34,
  Hab: 35,
  Zeph: 36,
  Hag: 37,
  Zech: 38,
  Mal: 39,
  Matt: 40,
  Mark: 41,
  Luke: 42,
  John: 43,
  Acts: 44,
  Rom: 45,
  "1Cor": 46,
  "2Cor": 47,
  Gal: 48,
  Eph: 49,
  Phil: 50,
  Col: 51,
  "1Thess": 52,
  "2Thess": 53,
  "1Tim": 54,
  "2Tim": 55,
  Titus: 56,
  Phlm: 57,
  Heb: 58,
  Jas: 59,
  "1Pet": 60,
  "2Pet": 61,
  "1John": 62,
  "2John": 63,
  "3John": 64,
  Jude: 65,
  Rev: 66,
};

/** Teaching set + extra key chapters for denser PD download packs. */
const CHAPTER_REFS = [
  "Gen.1",
  "Exod.20",
  "Ps.1",
  "Ps.23",
  "Prov.3",
  "Isa.53",
  "Matt.5",
  "Matt.6",
  "Matt.28",
  "Mark.1",
  "Luke.2",
  "John.1",
  "John.3",
  "John.14",
  "John.15",
  "Acts.2",
  "Rom.8",
  "Rom.12",
  "1Cor.13",
  "Eph.2",
  "Phil.4",
  "Col.3",
  "Heb.11",
  "Jas.1",
  "1John.4",
  "Rev.21",
];

const ALLOWED_TIDS = new Set(["web", "kjv", "asv"]);
const tids = (process.argv.slice(2).length ? process.argv.slice(2) : ["web", "kjv", "asv"]).filter(
  (t) => ALLOWED_TIDS.has(t),
);

if (tids.length === 0) {
  console.error("usage: fetch-pd-corpus-fixtures.mjs [web|kjv|asv...]");
  process.exit(1);
}

function parseRef(ref) {
  const i = ref.lastIndexOf(".");
  const book = ref.slice(0, i);
  const chapter = Number(ref.slice(i + 1));
  const nr = BOOK_NR[book];
  if (!nr || !Number.isFinite(chapter)) throw new Error(`bad ref ${ref}`);
  return { book, chapter, nr };
}

async function fetchChapter(tid, ref) {
  const { book, chapter, nr } = parseRef(ref);
  const url = `https://api.getbible.net/v2/${tid}/${nr}/${chapter}.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} → ${res.status}`);
  const json = await res.json();
  const verses = (json.verses ?? []).map((v) => ({
    verse: Number(v.verse),
    text: String(v.text ?? "").replace(/\s+/g, " ").trim(),
  }));
  if (verses.length < 1) throw new Error(`empty verses ${tid} ${ref}`);
  return { book, chapter, verses };
}

let written = 0;
for (const tid of tids) {
  const dir = join(FIX, tid);
  mkdirSync(dir, { recursive: true });
  for (const ref of CHAPTER_REFS) {
    const chapter = await fetchChapter(tid, ref);
    const path = join(dir, `${chapter.book}.${chapter.chapter}.json`);
    writeFileSync(path, `${JSON.stringify(chapter, null, 2)}\n`);
    written += 1;
    console.log(
      `PD_FIXTURE_OK tid=${tid} ref=${chapter.book}.${chapter.chapter} verses=${chapter.verses.length}`,
    );
    // polite pacing
    await new Promise((r) => setTimeout(r, 80));
  }
}

console.log(`PD_CORPUS_FIXTURES_OK tids=${tids.join(",")} files=${written} refs=${CHAPTER_REFS.length}`);
