import assert from "node:assert/strict";
import test from "node:test";
import { decideLicensedChapterAccess } from "./bible-entitlement.js";

test("non-licensed translations always pass", () => {
  const d = decideLicensedChapterAccess({
    license: "public-domain",
    environment: "production",
    userId: null,
    entitled: false,
  });
  assert.deepEqual(d, { ok: true, reason: "not_licensed" });
});

test("development skips entitlement for licensed translations", () => {
  const d = decideLicensedChapterAccess({
    license: "licensed",
    environment: "development",
    userId: null,
    entitled: false,
  });
  assert.deepEqual(d, { ok: true, reason: "development_skip" });
});

test("production licensed without auth is unauthorized", () => {
  const d = decideLicensedChapterAccess({
    license: "licensed",
    environment: "production",
    userId: null,
    entitled: false,
  });
  assert.deepEqual(d, { ok: false, status: 401, error: "unauthorized" });
});

test("production licensed without entitlement is forbidden", () => {
  const d = decideLicensedChapterAccess({
    license: "licensed",
    environment: "production",
    userId: "u1",
    entitled: false,
  });
  assert.deepEqual(d, { ok: false, status: 403, error: "entitlement_required" });
});

test("production licensed with entitlement passes", () => {
  const d = decideLicensedChapterAccess({
    license: "licensed",
    environment: "production",
    userId: "u1",
    entitled: true,
  });
  assert.deepEqual(d, { ok: true, reason: "entitled" });
});
