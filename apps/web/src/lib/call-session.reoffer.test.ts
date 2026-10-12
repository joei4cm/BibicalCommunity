import { describe, it } from "node:test";
import assert from "node:assert/strict";

/**
 * Documents the PWA-safe reoffer contract:
 * late peer-join must resend SDP offer only — never a second `ring`,
 * which reopens Accept UI mid-answer on installed web apps.
 */
function reofferSignals(hasLocalSdp: boolean): Array<"ring" | "offer" | "createOffer"> {
  if (hasLocalSdp) return ["offer"];
  return ["createOffer"];
}

describe("call-session reoffer (PWA)", () => {
  it("does not emit ring when resending an existing local offer", () => {
    assert.deepEqual(reofferSignals(true), ["offer"]);
    assert.equal(reofferSignals(true).includes("ring"), false);
  });

  it("does not emit ring when creating a fresh offer", () => {
    assert.deepEqual(reofferSignals(false), ["createOffer"]);
    assert.equal(reofferSignals(false).includes("ring"), false);
  });
});
