#!/usr/bin/env node
/**
 * Seed R2 bible chapters from fixtures/corpus/{tid}/*.json — not TypeScript packs.
 * Usage: node scripts/seed-r2-from-json-fixtures.mjs <BASE> <TOKEN>
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  buildR2ChapterJson,
  parseR2ChapterJson,
  r2ChapterObjectKey,
} from "../packages/bible/dist/index.js";

const BASE = process.argv[2] ?? "http://127.0.0.1:8787";
const TOKEN = process.argv[3];
const ROOT = new URL("..", import.meta.url).pathname;
const FIXTURES = join(ROOT, "fixtures", "corpus");

if (!TOKEN) {
  console.error("usage: seed-r2-from-json-fixtures.mjs <BASE> <TOKEN>");
  process.exit(1);
}

if (!existsSync(FIXTURES)) {
  throw new Error(`missing fixtures dir: ${FIXTURES}`);
}

const tids = readdirSync(FIXTURES, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

if (tids.length < 3) {
  throw new Error(`expected >=3 fixture translation dirs, got ${tids.length}`);
}

let seeded = 0;
const seededKeys = [];

for (const tid of tids) {
  const dir = join(FIXTURES, tid);
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort();
  for (const file of files) {
    const raw = readFileSync(join(dir, file), "utf8");
    const chapter = parseR2ChapterJson(raw);
    const key = r2ChapterObjectKey(tid, chapter.book, chapter.chapter);
    const body = buildR2ChapterJson(chapter);
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
    seededKeys.push(key);
    console.log(`CORPUS_JSON_PUT_OK key=${key} verses=${chapter.verses.length}`);
  }
}

if (seeded < 8) {
  throw new Error(`expected >=8 fixture chapters seeded, got ${seeded}`);
}

// Verify one chapter reads back as source=r2
const sample = seededKeys.find((k) => k.includes("/cuvs/John.1.json"));
if (!sample) throw new Error("missing cuvs John.1 seed");
const ch = await fetch(`${BASE}/v1/bible/chapter?translation=cuvs&ref=John.1`);
if (!ch.ok) throw new Error(`chapter get failed ${ch.status}`);
const json = await ch.json();
if (json.source !== "r2") throw new Error(`expected source=r2 got ${json.source}`);
if (!JSON.stringify(json.verses).includes("fixture")) {
  throw new Error("expected fixture marker in cuvs John.1 verses");
}

console.log(
  `CORPUS_JSON_IMPORT_OK seeded=${seeded} tids=${tids.join(",")} sample=${sample}`,
);
