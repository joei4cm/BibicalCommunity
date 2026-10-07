import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeLocale, registerSchema } from "./schemas.js";

test("normalizeLocale maps language tags", () => {
  assert.equal(normalizeLocale("zh"), "zh-CN");
  assert.equal(normalizeLocale("zh-CN"), "zh-CN");
  assert.equal(normalizeLocale("zh-TW"), "zh-CN");
  assert.equal(normalizeLocale("en"), "en");
  assert.equal(normalizeLocale("en-US"), "en");
  assert.equal(normalizeLocale("ja"), "ja");
  assert.equal(normalizeLocale("ja-JP"), "ja");
  assert.equal(normalizeLocale(""), "zh-CN");
});

test("registerSchema accepts short locale tags", () => {
  const parsed = registerSchema.parse({
    handle: "demouser1",
    password: "password12345",
    nickname: "Demo",
    locale: "zh",
  });
  assert.equal(parsed.locale, "zh-CN");
});
