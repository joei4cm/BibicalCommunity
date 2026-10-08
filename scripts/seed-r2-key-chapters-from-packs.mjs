#!/usr/bin/env node
/**
 * @deprecated TypeScript densify packs are removed.
 * Delegates to fixtures/corpus JSON seeding.
 *
 * Usage: node scripts/seed-r2-key-chapters-from-packs.mjs <BASE> <TOKEN>
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.argv[2] ?? "http://127.0.0.1:8787";
const TOKEN = process.argv[3];

if (!TOKEN) {
  console.error("usage: seed-r2-key-chapters-from-packs.mjs <BASE> <TOKEN>");
  console.error("(delegates to seed-r2-from-json-fixtures.mjs — no TS packs)");
  process.exit(1);
}

console.log("NOTE: TS packs removed; seeding from fixtures/corpus JSON…");
const result = spawnSync(
  process.execPath,
  [join(ROOT, "scripts/seed-r2-from-json-fixtures.mjs"), BASE, TOKEN],
  { stdio: "inherit", cwd: ROOT },
);
process.exit(result.status ?? 1);
