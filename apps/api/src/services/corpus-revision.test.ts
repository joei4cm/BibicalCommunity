import { describe, it } from "node:test";
import assert from "node:assert/strict";

/** Mirror of catalog fallback revision shape used by GET /corpus-revision. */
function catalogRevision(translationId: string, version = 1): string {
  return `catalog:${translationId}:${version}`;
}

describe("corpus revision shape", () => {
  it("is stable for unchanged public-domain packs", () => {
    assert.equal(catalogRevision("cuvs", 1), "catalog:cuvs:1");
    assert.equal(catalogRevision("cuvs", 1), catalogRevision("cuvs", 1));
  });

  it("changes when catalog version bumps", () => {
    assert.notEqual(catalogRevision("cuvs", 1), catalogRevision("cuvs", 2));
  });
});
