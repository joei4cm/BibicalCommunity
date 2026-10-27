import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isPublicBibleGetPath } from "./api-public-path.ts";

describe("isPublicBibleGetPath", () => {
  it("allows public bible GETs", () => {
    assert.equal(isPublicBibleGetPath("/v1/bible/chapter?translation=cuvs&ref=John.1"), true);
    assert.equal(isPublicBibleGetPath("/v1/bible/corpus-download/cuvs?limit=20"), true);
    assert.equal(isPublicBibleGetPath("/v1/bible/corpus-revision/cuvs"), true);
    assert.equal(isPublicBibleGetPath("/v1/bible/audio/panshi?book=John&chapter=1"), true);
  });

  it("rejects mutating or private paths", () => {
    assert.equal(isPublicBibleGetPath("/v1/bible/corpus-warm/cuvs?bookNr=1", "POST"), false);
    assert.equal(isPublicBibleGetPath("/v1/annotations?translation=cuvs"), false);
    assert.equal(isPublicBibleGetPath("/v1/bible/entitlements", "POST"), false);
  });
});
