import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isUnauthorizedError } from "./auth-session";

describe("isUnauthorizedError", () => {
  it("treats HTTP 401 as unauthorized", () => {
    assert.equal(isUnauthorizedError(401, "anything"), true);
  });

  it("treats unauthorized / 401 error codes as unauthorized", () => {
    assert.equal(isUnauthorizedError(403, "unauthorized"), true);
    assert.equal(isUnauthorizedError(500, "401"), true);
  });

  it("ignores other failures", () => {
    assert.equal(isUnauthorizedError(403, "forbidden"), false);
    assert.equal(isUnauthorizedError(500, "request_failed"), false);
  });
});
