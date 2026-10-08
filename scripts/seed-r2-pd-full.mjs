#!/usr/bin/env node
/**
 * Seed FULL public-domain translations into R2 via platform-admin API.
 * Fetches from getbible.net book-by-book (Workers-safe); does NOT commit
 * verse text into git — corpora live on R2 and clients install via
 * /v1/bible/corpus-download → local DB.
 *
 * Allowed tids: web, kjv, asv only (never licensed zh/ja dumps).
 *
 * Usage:
 *   node scripts/seed-r2-pd-full.mjs <BASE> <TOKEN> [web|kjv|asv...]
 *
 * TOKEN must be a platform_admin session (POST /v1/admin/platform/bootstrap first).
 */
const BASE = process.argv[2] ?? "http://127.0.0.1:8787";
const TOKEN = process.argv[3];
const ALLOWED = new Set(["web", "kjv", "asv"]);
const tids = (process.argv.slice(4).length ? process.argv.slice(4) : ["web"]).filter((t) =>
  ALLOWED.has(t),
);

if (!TOKEN || tids.length === 0) {
  console.error("usage: seed-r2-pd-full.mjs <BASE> <TOKEN> [web|kjv|asv...]");
  console.error("(TOKEN must be platform_admin — bootstrap via /v1/admin/platform/bootstrap)");
  process.exit(1);
}

const AUTH = { Authorization: `Bearer ${TOKEN}`, "content-type": "application/json" };

async function seedBook(tid, bookNr) {
  const res = await fetch(`${BASE}/v1/admin/corpus/pd-seed`, {
    method: "POST",
    headers: AUTH,
    body: JSON.stringify({ tid, bookNr }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`pd-seed ${tid} bookNr=${bookNr} → ${res.status} ${text}`);
  }
  return JSON.parse(text);
}

let putCount = 0;
for (const tid of tids) {
  console.log(`PD_FULL_SEED_START tid=${tid}`);
  for (let bookNr = 1; bookNr <= 66; bookNr += 1) {
    const r = await seedBook(tid, bookNr);
    putCount += r.chaptersPut ?? 0;
    if (bookNr % 10 === 0 || r.done) {
      console.log(
        `PD_FULL_PUT_PROGRESS tid=${tid} book=${r.book} bookNr=${bookNr} chaptersPut=${putCount}`,
      );
    }
  }
  console.log(`PD_FULL_SEED_OK tid=${tid}`);
}

console.log(`PD_FULL_R2_SEED_OK tids=${tids.join(",")} chapters=${putCount}`);
