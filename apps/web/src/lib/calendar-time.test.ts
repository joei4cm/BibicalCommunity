import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseEventStartMs,
  toDateInputValue,
  toDateTimeLocalValue,
} from "./calendar-time.ts";

describe("calendar-time", () => {
  it("formats date and datetime-local values", () => {
    const d = new Date(2026, 9, 13, 15, 30);
    assert.equal(toDateInputValue(d), "2026-10-13");
    assert.equal(toDateTimeLocalValue(d), "2026-10-13T15:30");
  });

  it("parses all-day date as local midnight", () => {
    const ms = parseEventStartMs("2026-10-13", true);
    assert.ok(ms != null);
    const d = new Date(ms!);
    assert.equal(d.getFullYear(), 2026);
    assert.equal(d.getMonth(), 9);
    assert.equal(d.getDate(), 13);
    assert.equal(d.getHours(), 0);
  });

  it("rejects invalid start", () => {
    assert.equal(parseEventStartMs("", false), null);
    assert.equal(parseEventStartMs("not-a-date", false), null);
  });
});
