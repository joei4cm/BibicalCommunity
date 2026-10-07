import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { HOSTILE_PRIVACY_FLOORS, mergeHostilePrivacy } from "./schemas.js";

describe("HOSTILE_PRIVACY_FLOORS", () => {
  it("locks discovery and directory off with admin-approved message requests", () => {
    assert.equal(HOSTILE_PRIVACY_FLOORS.discoverableByHandle, false);
    assert.equal(HOSTILE_PRIVACY_FLOORS.discoverableByUid, false);
    assert.equal(HOSTILE_PRIVACY_FLOORS.showInChurchDirectory, false);
    assert.equal(HOSTILE_PRIVACY_FLOORS.allowMessageRequests, "admin-approved");
  });
});

describe("mergeHostilePrivacy", () => {
  it("forces floors over open discovery settings", () => {
    const merged = mergeHostilePrivacy({
      discoverableByHandle: true,
      discoverableByUid: true,
      showInChurchDirectory: true,
      allowMessageRequests: "everyone",
      shareReadReceipts: true,
      shareTypingIndicators: true,
      shareLastActive: true,
    });
    assert.equal(merged.discoverableByHandle, false);
    assert.equal(merged.discoverableByUid, false);
    assert.equal(merged.showInChurchDirectory, false);
    assert.equal(merged.allowMessageRequests, "admin-approved");
    // Non-floor fields preserved
    assert.equal(merged.shareLastActive, true);
    assert.equal(merged.shareReadReceipts, true);
    assert.equal(merged.shareTypingIndicators, true);
  });

  it("applies floors when current privacy is empty", () => {
    const merged = mergeHostilePrivacy({});
    assert.equal(merged.discoverableByHandle, false);
    assert.equal(merged.discoverableByUid, false);
    assert.equal(merged.showInChurchDirectory, false);
    assert.equal(merged.allowMessageRequests, "admin-approved");
  });

  it("never raises discovery or directory above floors", () => {
    const merged = mergeHostilePrivacy({
      discoverableByHandle: false,
      discoverableByUid: false,
      showInChurchDirectory: false,
      allowMessageRequests: "off",
    });
    assert.equal(merged.discoverableByHandle, false);
    assert.equal(merged.discoverableByUid, false);
    assert.equal(merged.showInChurchDirectory, false);
    // Floor wins over member preference for message requests
    assert.equal(merged.allowMessageRequests, "admin-approved");
  });

  it("matches HOSTILE_PRIVACY_FLOORS constants exactly", () => {
    const merged = mergeHostilePrivacy({
      discoverableByHandle: true,
      discoverableByUid: true,
      showInChurchDirectory: true,
      allowMessageRequests: "church-only",
    });
    assert.equal(merged.discoverableByHandle, HOSTILE_PRIVACY_FLOORS.discoverableByHandle);
    assert.equal(merged.discoverableByUid, HOSTILE_PRIVACY_FLOORS.discoverableByUid);
    assert.equal(merged.showInChurchDirectory, HOSTILE_PRIVACY_FLOORS.showInChurchDirectory);
    assert.equal(merged.allowMessageRequests, HOSTILE_PRIVACY_FLOORS.allowMessageRequests);
  });
});
