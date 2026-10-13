import { describe, it } from "node:test";
import assert from "node:assert/strict";

/**
 * Documents the caller/callee contract that mobile must match web:
 * - caller: send ring + offer
 * - callee: answer existing offer (never create a second offer)
 */
function shouldCreateOffer(role: "caller" | "callee", initialOfferSdp: string | null): boolean {
  return role === "caller";
}

function shouldAnswerInitial(
  role: "caller" | "callee",
  initialOfferSdp: string | null,
): boolean {
  return role === "callee" && Boolean(initialOfferSdp);
}

function shouldIgnoreRemoteOfferWhileCalling(
  role: "caller" | "callee",
  hasLocalDescription: boolean,
): boolean {
  return role === "caller" && hasLocalDescription;
}

describe("mobile call role contract", () => {
  it("caller creates offer; callee does not", () => {
    assert.equal(shouldCreateOffer("caller", null), true);
    assert.equal(shouldCreateOffer("callee", "v=0"), false);
    assert.equal(shouldCreateOffer("callee", null), false);
  });

  it("callee answers buffered initial offer", () => {
    assert.equal(shouldAnswerInitial("callee", "v=0"), true);
    assert.equal(shouldAnswerInitial("callee", null), false);
    assert.equal(shouldAnswerInitial("caller", "v=0"), false);
  });

  it("caller ignores glare offers once local description exists", () => {
    assert.equal(shouldIgnoreRemoteOfferWhileCalling("caller", true), true);
    assert.equal(shouldIgnoreRemoteOfferWhileCalling("caller", false), false);
    assert.equal(shouldIgnoreRemoteOfferWhileCalling("callee", true), false);
  });
});
