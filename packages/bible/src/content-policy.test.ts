import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertAllowedContentSource,
  classifyDisallowedContent,
  isBlockedContentId,
  isDisallowedContentSource,
} from "./content-policy.js";

test("blocks JW translation ids and New World / Watchtower naming", () => {
  assert.equal(isBlockedContentId("nwt"), true);
  assert.equal(isBlockedContentId("nwt-zh"), true);
  assert.ok(isDisallowedContentSource("New World Translation"));
  assert.ok(isDisallowedContentSource("https://www.jw.org/en/library/bible/"));
  assert.ok(isDisallowedContentSource("耶和华见证人 新世界译本"));
  assert.equal(classifyDisallowedContent("watchtower study bible")?.kind, "jw");
});

test("blocks Mormon / LDS ids and titles", () => {
  assert.equal(isBlockedContentId("lds"), true);
  assert.equal(isBlockedContentId("jst"), true);
  assert.ok(isDisallowedContentSource("Book of Mormon"));
  assert.ok(isDisallowedContentSource("Doctrine and Covenants"));
  assert.ok(isDisallowedContentSource("后期圣徒 摩门经"));
  assert.equal(classifyDisallowedContent("churchofjesuschrist.org")?.kind, "mormon");
});

test("does not flag historic Protestant Jehovah wording or mainstream tids", () => {
  assert.equal(isBlockedContentId("asv"), false);
  assert.equal(isBlockedContentId("web"), false);
  assert.equal(isBlockedContentId("kjv"), false);
  assert.equal(isDisallowedContentSource("Jehovah is my shepherd; I shall not want."), false);
  assert.equal(isDisallowedContentSource("马太·亨利简明（中文）"), false);
  assert.equal(isDisallowedContentSource("https://commentaries.getbible.net/v1/mhcc/43/14.json"), false);
});

test("assertAllowedContentSource throws for blocked sources", () => {
  assert.throws(() => assertAllowedContentSource("nwt"), /jw/);
  assert.doesNotThrow(() => assertAllowedContentSource("asv", "American Standard Version"));
});
