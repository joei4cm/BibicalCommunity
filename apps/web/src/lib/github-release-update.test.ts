import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isRemoteNewer,
  parseSemverParts,
  pickAndroidApkAsset,
} from "./github-release-update.ts";

test("parseSemverParts strips v and build metadata", () => {
  assert.deepEqual(parseSemverParts("v0.1.11"), [0, 1, 11]);
  assert.deepEqual(parseSemverParts("0.1.11+abc123"), [0, 1, 11]);
});

test("isRemoteNewer compares triples", () => {
  assert.equal(isRemoteNewer("v0.1.12", "0.1.11+dead"), true);
  assert.equal(isRemoteNewer("0.1.11", "0.1.11+dead"), false);
  assert.equal(isRemoteNewer("0.1.10", "0.1.11"), false);
  assert.equal(isRemoteNewer("1.0.0", "0.9.9"), true);
});

test("pickAndroidApkAsset prefers LogosHome android apk", () => {
  const hit = pickAndroidApkAsset([
    { name: "LogosHome-0.1.11-web-dist.zip", browser_download_url: "a", size: 1 },
    {
      name: "LogosHome-0.1.11-android-debug.apk",
      browser_download_url: "https://example/apk",
      size: 2,
    },
    { name: "other.apk", browser_download_url: "b", size: 3 },
  ]);
  assert.equal(hit?.name, "LogosHome-0.1.11-android-debug.apk");
});
