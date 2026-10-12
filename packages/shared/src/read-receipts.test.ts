import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { messageReceiptState } from "./read-receipts.js";

describe("messageReceiptState", () => {
  it("is sent when peer has not read", () => {
    assert.equal(messageReceiptState(100, null), "sent");
    assert.equal(messageReceiptState(100, undefined), "sent");
    assert.equal(messageReceiptState(100, 99), "sent");
  });

  it("is read when peer lastReadAt covers the message", () => {
    assert.equal(messageReceiptState(100, 100), "read");
    assert.equal(messageReceiptState(100, 150), "read");
  });
});
