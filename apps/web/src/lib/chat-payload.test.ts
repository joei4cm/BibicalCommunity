import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  encodeChatPayload,
  formatCallDuration,
  parseChatPayload,
} from "./chat-payload.ts";

describe("chat-payload call records", () => {
  it("round-trips call control payloads", () => {
    const raw = encodeChatPayload({
      v: 1,
      kind: "call",
      event: "ended",
      callId: "call_x",
      durationSec: 95,
      video: false,
      direction: "out",
    });
    const p = parseChatPayload(raw);
    assert.equal(p?.kind, "call");
    if (p?.kind === "call") {
      assert.equal(p.event, "ended");
      assert.equal(p.durationSec, 95);
      assert.equal(p.callId, "call_x");
    }
  });

  it("formats duration", () => {
    assert.equal(formatCallDuration(95), "1:35");
    assert.equal(formatCallDuration(0), "0:00");
  });
});
