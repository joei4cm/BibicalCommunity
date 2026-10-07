import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { HOSTILE_PRIVACY_FLOORS, mergeHostilePrivacy, type PrivacySettings } from "@logoshome/shared";

/**
 * Mirrors applyHostilePrivacyFloors JSON merge without D1:
 * parse privacy_json → mergeHostilePrivacy → stringify for storage.
 */
function applyFloorsToPrivacyJson(privacyJson: string): PrivacySettings {
  let current: Partial<PrivacySettings> = {};
  try {
    current = JSON.parse(privacyJson) as Partial<PrivacySettings>;
  } catch {
    current = {};
  }
  return mergeHostilePrivacy(current);
}

describe("hostile church privacy floor merge (service path)", () => {
  it("rewrites open privacy_json to hostile floors", () => {
    const before = JSON.stringify({
      discoverableByHandle: true,
      discoverableByUid: true,
      showInChurchDirectory: true,
      allowMessageRequests: "everyone",
      shareReadReceipts: true,
      shareTypingIndicators: true,
      shareLastActive: false,
    });
    const merged = applyFloorsToPrivacyJson(before);
    assert.equal(merged.discoverableByHandle, false);
    assert.equal(merged.discoverableByUid, false);
    assert.equal(merged.showInChurchDirectory, false);
    assert.equal(merged.allowMessageRequests, "admin-approved");
    assert.deepEqual(
      {
        discoverableByHandle: merged.discoverableByHandle,
        discoverableByUid: merged.discoverableByUid,
        showInChurchDirectory: merged.showInChurchDirectory,
        allowMessageRequests: merged.allowMessageRequests,
      },
      { ...HOSTILE_PRIVACY_FLOORS },
    );
  });

  it("applies floors when privacy_json is empty object", () => {
    const merged = applyFloorsToPrivacyJson("{}");
    assert.equal(merged.discoverableByHandle, HOSTILE_PRIVACY_FLOORS.discoverableByHandle);
    assert.equal(merged.discoverableByUid, HOSTILE_PRIVACY_FLOORS.discoverableByUid);
    assert.equal(merged.showInChurchDirectory, HOSTILE_PRIVACY_FLOORS.showInChurchDirectory);
    assert.equal(merged.allowMessageRequests, HOSTILE_PRIVACY_FLOORS.allowMessageRequests);
  });

  it("applies floors when privacy_json is invalid JSON", () => {
    const merged = applyFloorsToPrivacyJson("not-json");
    assert.equal(merged.discoverableByHandle, false);
    assert.equal(merged.discoverableByUid, false);
    assert.equal(merged.showInChurchDirectory, false);
    assert.equal(merged.allowMessageRequests, "admin-approved");
  });

  it("keeps non-floor fields while overwriting discovery floors", () => {
    const merged = applyFloorsToPrivacyJson(
      JSON.stringify({
        discoverableByHandle: true,
        discoverableByUid: true,
        showInChurchDirectory: true,
        allowMessageRequests: "church-only",
        shareReadReceipts: false,
        shareTypingIndicators: false,
        shareLastActive: true,
      }),
    );
    assert.equal(merged.discoverableByHandle, false);
    assert.equal(merged.discoverableByUid, false);
    assert.equal(merged.showInChurchDirectory, false);
    assert.equal(merged.allowMessageRequests, "admin-approved");
    assert.equal(merged.shareReadReceipts, false);
    assert.equal(merged.shareTypingIndicators, false);
    assert.equal(merged.shareLastActive, true);
  });
});
