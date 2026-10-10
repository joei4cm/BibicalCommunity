import assert from "node:assert/strict";
import test from "node:test";
import { BOOK_LIST } from "./books.js";
import { bookGroupId, listBooksGrouped } from "./book-groups.js";

test("every Protestant book maps to a group", () => {
  for (const b of BOOK_LIST) {
    assert.ok(bookGroupId(b.id), b.id);
  }
});

test("OT/NT grouped lists cover the canon", () => {
  const ot = listBooksGrouped({ testament: "ot" }).flatMap((g) => g.books);
  const nt = listBooksGrouped({ testament: "nt" }).flatMap((g) => g.books);
  assert.equal(ot.length, 39);
  assert.equal(nt.length, 27);
  assert.equal(ot.length + nt.length, BOOK_LIST.length);
});
