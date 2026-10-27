import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  CORPUS_REVISION_CHECK_MS,
  corpusRevisionCheckDue,
  loadStoredCorpusRevision,
  parseCorpusRevision,
  saveStoredCorpusRevision,
} from "./bible-corpus-revision-store.ts";

const mem = new Map<string, string>();
const localStorageMock = {
  getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: (k: string, v: string) => {
    mem.set(k, String(v));
  },
  removeItem: (k: string) => {
    mem.delete(k);
  },
  clear: () => mem.clear(),
};
Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  configurable: true,
});

describe("corpus revision helpers", () => {
  beforeEach(() => {
    mem.clear();
  });

  it("parses revision strings", () => {
    assert.equal(parseCorpusRevision({ revision: "catalog:cuvs:1" }), "catalog:cuvs:1");
    assert.equal(parseCorpusRevision({ revision: "  " }), null);
    assert.equal(parseCorpusRevision(null), null);
  });

  it("stores revision and schedules the next check window", () => {
    assert.equal(loadStoredCorpusRevision("cuvs"), null);
    assert.equal(corpusRevisionCheckDue("cuvs", 1_000), true);
    saveStoredCorpusRevision("cuvs", "catalog:cuvs:1", 1_000);
    assert.equal(loadStoredCorpusRevision("cuvs"), "catalog:cuvs:1");
    assert.equal(corpusRevisionCheckDue("cuvs", 2_000), false);
    assert.equal(corpusRevisionCheckDue("cuvs", 1_000 + CORPUS_REVISION_CHECK_MS), true);
  });
});
