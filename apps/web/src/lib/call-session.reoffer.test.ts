import { describe, it } from "node:test";
import assert from "node:assert/strict";

/**
 * Documents the PWA-safe reoffer contract:
 * late peer-join must restart ICE + createOffer — never a second `ring`,
 * which reopens Accept UI mid-answer on installed web apps.
 * Resending a stale SDP without new candidates leaves the callee without
 * usable ICE after listen-socket candidates were dropped.
 */
function reofferSignals(hasLocalSdp: boolean): Array<"ring" | "restartIce" | "createOffer"> {
  if (hasLocalSdp) return ["restartIce", "createOffer"];
  return ["createOffer"];
}

describe("call-session reoffer (PWA)", () => {
  it("restarts ICE instead of replaying a stale offer", () => {
    assert.deepEqual(reofferSignals(true), ["restartIce", "createOffer"]);
    assert.equal(reofferSignals(true).includes("ring"), false);
  });

  it("does not emit ring when creating a fresh offer", () => {
    assert.deepEqual(reofferSignals(false), ["createOffer"]);
    assert.equal(reofferSignals(false).includes("ring"), false);
  });
});
