import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { PrivacySettings } from "@logoshome/shared";

/** Mirrors /v1/me/search eligibility for UID discovery. */
function uidSearchResult(
  candidate: { id: string; uid: string; nicknameCt: string | null; tombstoned: boolean; privacyJson: string } | undefined,
  q: string,
): { id: string; uid: string; nickname: string | null }[] {
  const trimmed = q.trim();
  if (!trimmed || !candidate || candidate.tombstoned) return [];
  if (candidate.uid !== trimmed.toUpperCase()) return [];
  let privacy: PrivacySettings;
  try {
    privacy = JSON.parse(candidate.privacyJson) as PrivacySettings;
  } catch {
    return [];
  }
  if (!privacy.discoverableByUid) return [];
  return [{ id: candidate.id, uid: candidate.uid, nickname: candidate.nicknameCt }];
}

describe("me/search uid discovery", () => {
  const user = {
    id: "usr_1",
    uid: "ABCD1234EFGH",
    nicknameCt: "Ada",
    tombstoned: false,
    privacyJson: JSON.stringify({ discoverableByUid: true }),
  };

  it("returns user when discoverableByUid and uid matches", () => {
    assert.deepEqual(uidSearchResult(user, "abcd1234efgh"), [
      { id: "usr_1", uid: "ABCD1234EFGH", nickname: "Ada" },
    ]);
  });

  it("returns empty when discoverableByUid is false", () => {
    const hidden = { ...user, privacyJson: JSON.stringify({ discoverableByUid: false }) };
    assert.deepEqual(uidSearchResult(hidden, "ABCD1234EFGH"), []);
  });

  it("returns empty for handle-like queries (no plaintext handle index)", () => {
    assert.deepEqual(uidSearchResult(user, "ada_test"), []);
  });

  it("returns empty for tombstoned users", () => {
    assert.deepEqual(uidSearchResult({ ...user, tombstoned: true }, "ABCD1234EFGH"), []);
  });
});
