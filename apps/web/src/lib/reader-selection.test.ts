import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyVerseTap,
  highlightIdsInRange,
  isChapterSwipeGesture,
  normalizeVerseRange,
  rangeForHighlightAt,
} from "./reader-selection.ts";

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

  it("selects a whole highlight when tapping while idle", () => {
    const next = applyVerseTap(null, null, 2, { start: 1, end: 4 });
    assert.deepEqual(next, { selection: { start: 1, end: 4 }, anchor: 1 });
  });

  it("normalizes a backward range", () => {
    assert.deepEqual(normalizeVerseRange(8, 2), { start: 2, end: 8 });
  });

  it("returns each highlight id once for a shared range", () => {
    const ids = highlightIdsInRange({ 1: "h1", 2: "h1", 3: "h2", 4: "h2" }, { start: 2, end: 4 });
    assert.deepEqual(ids, ["h1", "h2"]);
  });

  it("finds the full annotation span for a verse", () => {
    assert.deepEqual(rangeForHighlightAt({ 1: "h1", 2: "h1", 3: "h1", 5: "h2" }, 2), {
      start: 1,
      end: 3,
    });
    assert.equal(rangeForHighlightAt({ 1: "h1" }, 9), null);
  });

  it("treats dominant horizontal moves as chapter swipes", () => {
    assert.equal(isChapterSwipeGesture(64, 10), true);
    assert.equal(isChapterSwipeGesture(-50, 5), true);
    assert.equal(isChapterSwipeGesture(20, 5), false);
    assert.equal(isChapterSwipeGesture(60, 55), false);
    assert.equal(isChapterSwipeGesture(30, 40), false);
  });
});
