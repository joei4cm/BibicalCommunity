import { test } from "node:test";
import assert from "node:assert/strict";
import { HOSTILE_PRIVACY_FLOORS, mergeHostilePrivacy } from "./schemas.js";

test("mergeHostilePrivacy forces floors over open discovery settings", () => {
  const merged = mergeHostilePrivacy({
    discoverableByHandle: true,
    discoverableByUid: true,
    showInChurchDirectory: true,
    allowMessageRequests: "everyone",
    shareReadReceipts: true,
    shareTypingIndicators: true,
    shareLastActive: true,
  });
  assert.equal(merged.discoverableByHandle, HOSTILE_PRIVACY_FLOORS.discoverableByHandle);
  assert.equal(merged.discoverableByUid, HOSTILE_PRIVACY_FLOORS.discoverableByUid);
  assert.equal(merged.showInChurchDirectory, HOSTILE_PRIVACY_FLOORS.showInChurchDirectory);
  assert.equal(merged.allowMessageRequests, HOSTILE_PRIVACY_FLOORS.allowMessageRequests);
  // Non-floor fields preserved
  assert.equal(merged.shareLastActive, true);
});
