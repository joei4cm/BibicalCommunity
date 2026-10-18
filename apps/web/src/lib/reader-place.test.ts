import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseReaderPlace, readerPlacePath } from "./reader-place.ts";

describe("reader place", () => {
  it("keeps a valid passage", () => {
    const place = parseReaderPlace(
      JSON.stringify({ tid: "cuvs", bookSlug: "psalms", chapter: 23 }),
    );
    assert.deepEqual(place, { tid: "cuvs", bookSlug: "psalms", chapter: 23 });
    assert.equal(readerPlacePath(place), "/app/bible/cuvs/psalms/23");
  });

  it("rejects junk and falls back to John 1", () => {
    assert.equal(parseReaderPlace("{"), null);
    assert.equal(parseReaderPlace(JSON.stringify({ tid: "../x", bookSlug: "john", chapter: 1 })), null);
    assert.equal(readerPlacePath(null), "/app/bible/cuvs/john/1");
  });
});
