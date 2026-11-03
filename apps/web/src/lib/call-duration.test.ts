import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatCallDuration } from "./call-duration";

describe("formatCallDuration", () => {
  it("formats under an hour as m:ss", () => {
    assert.equal(formatCallDuration(0), "0:00");
    assert.equal(formatCallDuration(5), "0:05");
    assert.equal(formatCallDuration(65), "1:05");
    assert.equal(formatCallDuration(600), "10:00");
  });

  it("formats hours as h:mm:ss", () => {
    assert.equal(formatCallDuration(3600), "1:00:00");
    assert.equal(formatCallDuration(3661), "1:01:01");
  });
});
