import assert from "node:assert/strict";
import test from "node:test";
import { resolveBookId } from "./book-aliases.js";
import { parseVerseCite, splitVerseCites } from "./verse-cites.js";

test("resolveBookId: Chinese short forms", () => {
  assert.equal(resolveBookId("约一"), "1John");
  assert.equal(resolveBookId("约"), "John");
  assert.equal(resolveBookId("太"), "Matt");
  assert.equal(resolveBookId("约翰一书"), "1John");
});

test("parseVerseCite: #约一1:2 → 1 John 1:2 reader href", () => {
  const cite = parseVerseCite("#约一1:2");
  assert.ok(cite);
  assert.equal(cite!.bookId, "1John");
  assert.equal(cite!.chapter, 1);
  assert.equal(cite!.verseStart, 2);
  assert.equal(cite!.href, "/app/bible/cuvs/1john/1?verse=2");
});

test("parseVerseCite: English forms", () => {
  const a = parseVerseCite("#John3:16");
  assert.equal(a?.href, "/app/bible/cuvs/john/3?verse=16");
  const b = parseVerseCite("#1John.1.2");
  assert.equal(b?.bookId, "1John");
  assert.equal(b?.href, "/app/bible/cuvs/1john/1?verse=2");
});

test("splitVerseCites mixes text and links", () => {
  const parts = splitVerseCites("看这里 #约一1:2 和 #约3:16 好吗");
  assert.equal(parts.length, 5);
  assert.equal(parts[0]?.type, "text");
  assert.equal(parts[1]?.type, "cite");
  if (parts[1]?.type === "cite") {
    assert.equal(parts[1].href, "/app/bible/cuvs/1john/1?verse=2");
  }
  assert.equal(parts[3]?.type, "cite");
  if (parts[3]?.type === "cite") {
    assert.equal(parts[3].href, "/app/bible/cuvs/john/3?verse=16");
  }
});
