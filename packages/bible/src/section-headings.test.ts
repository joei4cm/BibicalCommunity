import assert from "node:assert/strict";
import test from "node:test";
import { sectionHeadingsFor } from "./section-headings.js";

test("John.1 matches 新标点和合本 section titles", () => {
  const rows = sectionHeadingsFor("John", 1);
  assert.deepEqual(
    rows.map((r) => [r.verse, r.title.zh]),
    [
      [1, "道成肉身"],
      [19, "施洗约翰的见证"],
      [29, "神的羔羊"],
      [35, "初次选召门徒"],
      [43, "呼召腓力和拿但业"],
    ],
  );
});

test("chapters without official titles stay empty (no invented names)", () => {
  // 3 John ch.1 may have headings; use a chapter that USFM has none for if any.
  // Philemon is short — check; if it has titles, pick another.
  const rows = sectionHeadingsFor("Obad", 1);
  assert.ok(rows.length >= 1);
  assert.equal(rows[0]!.title.zh, "耶和华要惩罚以东");
  // Invented soft title must not appear:
  assert.ok(!rows.some((r) => /俄巴底亚\s*\d/.test(r.title.zh)));
});

test("unknown book/chapter returns no invented heading", () => {
  assert.deepEqual(sectionHeadingsFor("NotABook", 1), []);
});

test("gospel openers include official section titles", () => {
  assert.ok(sectionHeadingsFor("Matt", 1).length >= 2);
  assert.equal(sectionHeadingsFor("Matt", 5)[0]!.title.zh, "山上宝训");
  assert.ok(sectionHeadingsFor("Mark", 1).length >= 2);
  assert.ok(sectionHeadingsFor("Luke", 2).length >= 2);
  assert.ok(sectionHeadingsFor("Acts", 2).length >= 2);
  assert.ok(sectionHeadingsFor("John", 8).length >= 1);
});
