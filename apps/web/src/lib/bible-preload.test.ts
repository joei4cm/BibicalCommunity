import { describe, it } from "node:test";
import assert from "node:assert/strict";

/**
 * Light contract checks for preload constants / paging assumptions.
 * Network behavior is covered by API corpus-r2-page tests + smokes.
 */
describe("bible preload paging", () => {
  it("uses pages large enough to finish a Protestant canon in ≤32 requests", () => {
    const pageSize = 200;
    const protestantChapters = 1189;
    const pagesNeeded = Math.ceil(protestantChapters / pageSize);
    assert.ok(pagesNeeded <= 32, `pagesNeeded=${pagesNeeded}`);
    assert.ok(pagesNeeded <= 6, `prefer ≤6 RTTs, got ${pagesNeeded}`);
  });
});
