import assert from "node:assert/strict";
import test from "node:test";
import {
  panshiAudioRelativePath,
  panshiAudioUpstreamUrl,
  protestantBookNumber,
} from "./audio-panshi.js";

test("protestant book numbers match canon order", () => {
  assert.equal(protestantBookNumber("Gen"), 1);
  assert.equal(protestantBookNumber("Ps"), 19);
  assert.equal(protestantBookNumber("Matt"), 40);
  assert.equal(protestantBookNumber("John"), 43);
  assert.equal(protestantBookNumber("Rev"), 66);
  assert.equal(protestantBookNumber("Nope"), null);
});

test("panshi paths pad book and leave chapter unpadded", () => {
  assert.equal(panshiAudioRelativePath("Gen", 1), "panshi/01-1.mp3");
  assert.equal(panshiAudioRelativePath("Gen", 10), "panshi/01-10.mp3");
  assert.equal(panshiAudioRelativePath("John", 1), "panshi/43-1.mp3");
  assert.ok(panshiAudioUpstreamUrl("John", 1)?.endsWith("panshi/43-1.mp3"));
});
