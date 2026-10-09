import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Avoid importing group-fanout.ts (pulls @logoshome/crypto) in Node unit tests. */
describe("group-fanout header", () => {
  it("exports group-fanout:v1 constant in source", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(here, "group-fanout.ts"), "utf8");
    assert.match(src, /GROUP_FANOUT_HEADER\s*=\s*"group-fanout:v1"/);
    assert.match(src, /isGroupFanoutHeader/);
    assert.match(src, /encryptGroupFanout/);
    assert.match(src, /decryptGroupFanout/);
  });
});
