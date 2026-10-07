#!/usr/bin/env bash
# Full i18n catalog parity audit across zh-CN / en / ja.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
pnpm --filter @logoshome/shared build >/dev/null
node --input-type=module -e '
import { catalogs } from "./packages/shared/dist/index.js";
const locs = ["zh-CN", "en", "ja"];
let fail = 0;
const keysBy = {};
for (const loc of locs) {
  const c = catalogs[loc];
  if (!c) { console.error("missing catalog", loc); fail++; continue; }
  keysBy[loc] = Object.keys(c).sort();
  for (const [k, v] of Object.entries(c)) {
    if (typeof v !== "string" || !v.trim()) {
      console.error("EMPTY", loc, k);
      fail++;
    }
  }
}
const all = new Set(locs.flatMap((l) => keysBy[l] || []));
for (const k of all) {
  for (const loc of locs) {
    if (!(keysBy[loc] || []).includes(k)) {
      console.error("PARITY_MISSING", loc, k);
      fail++;
    }
  }
}
if (fail) process.exit(1);
console.log("I18N_AUDIT_OK keys=" + all.size);
'
