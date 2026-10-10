import assert from "node:assert/strict";
import test from "node:test";
import { sectionHeadingsFor } from "./section-headings.js";

test("John.1 has ordered section titles", () => {
  const rows = sectionHeadingsFor("John", 1);
  assert.ok(rows.length >= 2);
  assert.equal(rows[0]!.verse, 1);
  assert.ok(rows[0]!.title.zh.includes("道"));
  for (let i = 1; i < rows.length; i += 1) {
    assert.ok(rows[i]!.verse > rows[i - 1]!.verse);
  }
});

test("unknown chapters return empty", () => {
  assert.deepEqual(sectionHeadingsFor("Obad", 1), []);
});

test("gospel openers include section titles", () => {
  assert.ok(sectionHeadingsFor("Matt", 1).length >= 2);
  assert.ok(sectionHeadingsFor("Mark", 1).length >= 2);
  assert.ok(sectionHeadingsFor("Luke", 2).length >= 2);
  assert.ok(sectionHeadingsFor("Acts", 2).length >= 2);
});
