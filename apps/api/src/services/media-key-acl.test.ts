import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mediaKeyOwnerUserId } from "./access-graph.js";

describe("mediaKeyOwnerUserId", () => {
  it("parses media/{userId}/… owners", () => {
    assert.equal(mediaKeyOwnerUserId("media/user_abc/obj1"), "user_abc");
    assert.equal(mediaKeyOwnerUserId("media/u1/nested/path"), "u1");
  });

  it("rejects traversal and non-media keys", () => {
    assert.equal(mediaKeyOwnerUserId("media/../evil/x"), null);
    assert.equal(mediaKeyOwnerUserId("other/user/x"), null);
    assert.equal(mediaKeyOwnerUserId("media/"), null);
  });
});
