import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyVerseTap, highlightIdsInRange, normalizeVerseRange } from "./reader-selection.ts";

describe("verse selection", () => {
  it("selects one verse, then a range, then clears on the same verse", () => {
    const first = applyVerseTap(null, null, 3);
    assert.deepEqual(first, { selection: { start: 3, end: 3 }, anchor: 3 });
    const range = applyVerseTap(first.selection, first.anchor, 7);
    assert.deepEqual(range, { selection: { start: 3, end: 7 }, anchor: 3 });
    const shrunk = applyVerseTap(range.selection, range.anchor, 3);
    assert.deepEqual(shrunk, { selection: { start: 3, end: 3 }, anchor: 3 });
    const cleared = applyVerseTap(shrunk.selection, shrunk.anchor, 3);
    assert.deepEqual(cleared, { selection: null, anchor: null });
  });

  it("normalizes a backward range", () => {
    assert.deepEqual(normalizeVerseRange(8, 2), { start: 2, end: 8 });
  });

  it("returns each highlight id once for a shared range", () => {
    const ids = highlightIdsInRange({ 1: "h1", 2: "h1", 3: "h2", 4: "h2" }, { start: 2, end: 4 });
    assert.deepEqual(ids, ["h1", "h2"]);
  });
});