import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { loadReaderHistory, recordReaderVisitLocal } from "./reader-history.ts";

describe("reader history local", () => {
  const mem = new Map<string, string>();

  beforeEach(() => {
    mem.clear();
    (globalThis as { localStorage?: Storage }).localStorage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => {
        mem.set(k, v);
      },
      removeItem: (k: string) => {
        mem.delete(k);
      },
      clear: () => mem.clear(),
      key: () => null,
      length: 0,
    };
  });

  afterEach(() => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
  });

  it("records visits and dedupes by place", () => {
    recordReaderVisitLocal({ tid: "cuvs", bookSlug: "esth", chapter: 1 });
    recordReaderVisitLocal({ tid: "cuvs", bookSlug: "john", chapter: 3 });
    recordReaderVisitLocal({ tid: "cuvs", bookSlug: "esth", chapter: 1 });
    const hist = loadReaderHistory();
    assert.equal(hist[0]?.bookSlug, "esth");
    assert.equal(hist.filter((h) => h.bookSlug === "esth" && h.chapter === 1).length, 1);
    assert.ok(hist.some((h) => h.bookSlug === "john"));
  });
});
