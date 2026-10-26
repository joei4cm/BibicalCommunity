import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BOOK_LIST } from "./books.js";
import { bookAbbr } from "./book-abbr.js";
import { resolveBookId } from "./book-aliases.js";

describe("bookAbbr", () => {
  it("covers every canon book in zh/en/ja", () => {
    for (const b of BOOK_LIST) {
      assert.ok(bookAbbr(b.id, "zh").length >= 1, b.id);
      assert.ok(bookAbbr(b.id, "en").length >= 1, b.id);
      assert.ok(bookAbbr(b.id, "ja").length >= 1, b.id);
      assert.ok(bookAbbr(b.id, "zh").length <= 3, `${b.id} zh too long`);
    }
  });

  it("uses WeDevote-style Chinese short forms that resolve back", () => {
    assert.equal(bookAbbr("Gen", "zh"), "创");
    assert.equal(bookAbbr("1Sam", "zh"), "撒上");
    assert.equal(bookAbbr("Matt", "zh"), "太");
    assert.equal(bookAbbr("1John", "zh"), "约一");
    assert.equal(resolveBookId(bookAbbr("Ps", "zh")), "Ps");
    assert.equal(resolveBookId(bookAbbr("Rev", "zh")), "Rev");
  });
});
