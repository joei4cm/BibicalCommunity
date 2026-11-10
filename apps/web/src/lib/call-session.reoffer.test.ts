import { describe, it } from "node:test";
import assert from "node:assert/strict";

/**
 * Documents the PWA-safe reoffer contract:
 * late peer-join must restart ICE + createOffer — never a second `ring`,
 * which reopens Accept UI mid-answer on installed web apps.
 * Resending a stale SDP without new candidates leaves the callee without
 * usable ICE after listen-socket candidates were dropped.
 *
 * Reoffer is debounced so Accept handoff peer-joined does not glare with
 * the callee answering the buffered offer.
 */
function reofferSignals(hasLocalSdp: boolean): Array<"ring" | "restartIce" | "createOffer"> {
  if (hasLocalSdp) return ["restartIce", "createOffer"];
  return ["createOffer"];
}

function shouldApplyRemoteOffer(opts: {
  asScreen: boolean;
  remoteSdp: string | null;
  remoteType: string | null;
  incomingSdp: string;
}): boolean {
  if (
    !opts.asScreen &&
    opts.remoteType === "offer" &&
    opts.remoteSdp === opts.incomingSdp
  ) {
    return false;
  }
  return true;
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

  it("answers ICE-restart offers after the first remote description", () => {
    assert.equal(
      shouldApplyRemoteOffer({
        asScreen: false,
        remoteSdp: "offer-v1",
        remoteType: "offer",
        incomingSdp: "offer-v2-ice-restart",
      }),
      true,
    );
  });

  it("skips exact duplicate buffered offer replay", () => {
    assert.equal(
      shouldApplyRemoteOffer({
        asScreen: false,
        remoteSdp: "offer-v1",
        remoteType: "offer",
        incomingSdp: "offer-v1",
      }),
      false,
    );
  });
});
