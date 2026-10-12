import { test } from "node:test";
import assert from "node:assert/strict";
import { formatBadgeCount } from "./comms-badges-format.js";

test("formatBadgeCount hides zero", () => {
  assert.equal(formatBadgeCount(0), "");
  assert.equal(formatBadgeCount(-1), "");
});

test("formatBadgeCount shows small counts", () => {
  assert.equal(formatBadgeCount(1), "1");
  assert.equal(formatBadgeCount(12), "12");
  assert.equal(formatBadgeCount(99), "99");
});

test("formatBadgeCount caps at 99+", () => {
  assert.equal(formatBadgeCount(100), "99+");
  assert.equal(formatBadgeCount(1000), "99+");
});
