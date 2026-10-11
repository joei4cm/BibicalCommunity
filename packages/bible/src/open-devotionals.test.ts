import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SAMPLE_OPEN_DEVOTIONALS,
  calendarMd,
  getCalendarDevotion,
  setOpenDevotionalsBundle,
} from "./open-devotionals.js";

test("sample open devotionals has mornings and collects", () => {
  assert.ok(SAMPLE_OPEN_DEVOTIONALS.mornings.length >= 7);
  assert.ok(SAMPLE_OPEN_DEVOTIONALS.collects.length >= 1);
  assert.equal(SAMPLE_OPEN_DEVOTIONALS.meta.spurgeon.license, "public-domain");
});

test("getCalendarDevotion resolves by md and falls back", () => {
  setOpenDevotionalsBundle(SAMPLE_OPEN_DEVOTIONALS);
  const first = SAMPLE_OPEN_DEVOTIONALS.mornings[0]!;
  const hit = getCalendarDevotion(first.md);
  assert.equal(hit.md, first.md);
  assert.ok(hit.reflectBody.length > 20);
  assert.ok(hit.prayBody.length > 10);
  assert.match(hit.attribution.reflect, /Spurgeon/);

  const miss = getCalendarDevotion("99-99");
  assert.equal(miss.md, first.md);
});

test("calendarMd formats local date", () => {
  const md = calendarMd(new Date(2026, 0, 5));
  assert.equal(md, "01-05");
});
