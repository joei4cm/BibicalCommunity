import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePlanCsv, serializePlanCsv } from "./csv-plans.js";

test("parsePlanCsv reads day/ref/title/note", () => {
  const rows = parsePlanCsv("day,ref,title,note\n1,John.1,Begin,Hi\n2,John.2,,");
  assert.equal(rows.length, 2);
  assert.equal(rows[0]?.ref, "John.1");
  assert.equal(rows[1]?.title, undefined);
});

test("serializePlanCsv roundtrip", () => {
  const csv = serializePlanCsv([{ day: 1, ref: "Ps.23", title: "Shepherd", note: "a,b" }]);
  const rows = parsePlanCsv(csv);
  assert.equal(rows[0]?.note, "a,b");
});
