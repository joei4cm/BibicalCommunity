import { describe, it } from "node:test";
import assert from "node:assert/strict";

/**
 * Documents favorite toggle contract:
 * - POST is idempotent per (user, messageId)
 * - DELETE removes by messageId so bubble ★ and archive list share one path
 */
function favoriteAction(alreadyFavorited: boolean): "post" | "delete" {
  return alreadyFavorited ? "delete" : "post";
}

describe("chat favorites toggle", () => {
  it("posts when not favorited", () => {
    assert.equal(favoriteAction(false), "post");
  });

  it("deletes when already favorited", () => {
    assert.equal(favoriteAction(true), "delete");
  });
});
