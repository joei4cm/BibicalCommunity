import { test } from "node:test";
import assert from "node:assert/strict";
import { CALL_SIGNAL_TYPES, isCallSignalType } from "./call-signaling.js";

test("CALL_SIGNAL_TYPES includes core SDP/ICE and screen-share variants", () => {
  for (const t of [
    "offer",
    "answer",
    "ice",
    "hangup",
    "screen",
    "screen-offer",
    "screen-answer",
  ]) {
    assert.ok(CALL_SIGNAL_TYPES.includes(t as (typeof CALL_SIGNAL_TYPES)[number]), t);
    assert.equal(isCallSignalType(t), true, t);
  }
});

test("isCallSignalType rejects unknown / media-smuggling types", () => {
  assert.equal(isCallSignalType("media"), false);
  assert.equal(isCallSignalType("track"), false);
  assert.equal(isCallSignalType(""), false);
  assert.equal(isCallSignalType(null), false);
  assert.equal(isCallSignalType(undefined), false);
});
