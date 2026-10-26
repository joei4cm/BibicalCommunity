import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseBookPickerMode } from "./reader-book-picker.ts";

describe("book picker mode", () => {
  it("defaults to abbreviated layout", () => {
    assert.equal(parseBookPickerMode(null), "abbr");
    assert.equal(parseBookPickerMode(""), "abbr");
    assert.equal(parseBookPickerMode("abbr"), "abbr");
  });

  it("accepts full-name layout", () => {
    assert.equal(parseBookPickerMode("full"), "full");
  });
});
