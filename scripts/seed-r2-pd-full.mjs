#!/usr/bin/env node
/**
 * Seed FULL public-domain translations into R2 from getbible.net.
 * Does NOT commit verse text into the git repo — corpora live on R2 and
 * clients install via /v1/bible/corpus-download → local DB.
 *
 * Allowed tids: web, kjv, asv, cuvs (cuvs ← getbible cus 和合本简体公版).
 * Never proprietary licensed dumps (NASB, etc.).
 *
 * Usage: node scripts/seed-r2-pd-full.mjs <BASE> <TOKEN> [web|kjv|asv|cuvs...]
 */
import { BOOK_LIST } from "../packages/bible/dist/index.js";

const BASE = process.argv[2] ?? "http://127.0.0.1:8787";
const TOKEN = process.argv[3];
/** Product tid → getbible abbreviation */
const SOURCE = { web: "web", kjv: "kjv", asv: "asv", cuvs: "cus" };
const ALLOWED = new Set(Object.keys(SOURCE));
const tids = (process.argv.slice(4).length ? process.argv.slice(4) : ["web", "cuvs"]).filter((t) =>
  ALLOWED.has(t),
);

if (!TOKEN || tids.length === 0) {
  console.error("usage: seed-r2-pd-full.mjs <BASE> <TOKEN> [web|kjv|asv|cuvs...]");
  process.exit(1);
}

/** getbible book nr → OSIS id (Protestant order matches BOOK_LIST). */
const NR_TO_OSIS = Object.fromEntries(BOOK_LIST.map((b, i) => [i + 1, b.id]));

async function fetchFull(tid) {
  const source = SOURCE[tid] ?? tid;
  const url = `https://api.getbible.net/v2/${source}.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} → ${res.status}`);
  return res.json();
}

let putCount = 0;
for (const tid of tids) {
  console.log(`PD_FULL_FETCH_START tid=${tid}`);
  const full = await fetchFull(tid);
  const books = full.books ?? [];
  if (books.length < 66) throw new Error(`${tid} expected 66 books, got ${books.length}`);

  for (const book of books) {
    const osis = NR_TO_OSIS[book.nr];
    if (!osis) {
      console.warn(`skip unknown book nr=${book.nr} name=${book.name}`);
      continue;
    }
    for (const ch of book.chapters ?? []) {
      const chapter = Number(ch.chapter);
      // Drop CrossWire footnote-marker leaks (`a`) — real text lives in the prior verse.
      const verses = (ch.verses ?? [])
        .map((v) => ({
          verse: Number(v.verse),
          text: String(v.text ?? "").replace(/\s+/g, " ").trim(),
        }))
        .filter(
          (v) =>
            Number.isFinite(v.verse) &&
            v.verse > 0 &&
            v.text.length > 0 &&
            !/^[a-z]{1,3}$/i.test(v.text),
        );
      if (!verses.length) continue;
      const key = `bible/${tid}/${osis}.${chapter}.json`;
      const body = JSON.stringify({ book: osis, chapter, verses });
      const put = await fetch(`${BASE}/v1/media/put/${key}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "content-type": "application/json",
        },
        body,
      });
      if (!put.ok) throw new Error(`put failed ${key} status=${put.status}`);
      putCount += 1;
      if (putCount % 100 === 0) console.log(`PD_FULL_PUT_PROGRESS tid=${tid} n=${putCount}`);
    }
  }
  console.log(`PD_FULL_SEED_OK tid=${tid}`);
}

console.log(`PD_FULL_R2_SEED_OK tids=${tids.join(",")} chapters=${putCount}`);
