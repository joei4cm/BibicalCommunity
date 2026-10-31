import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isFootnoteMarkerVerseText,
  sanitizeCorpusChapter,
  sanitizeCorpusVerses,
} from "./verse-sanitize.js";

describe("verse-sanitize", () => {
  it("detects CrossWire footnote-marker-only verses", () => {
    assert.equal(isFootnoteMarkerVerseText("a"), true);
    assert.equal(isFootnoteMarkerVerseText(" a "), true);
    assert.equal(isFootnoteMarkerVerseText("ab"), true);
    assert.equal(isFootnoteMarkerVerseText("说："), false);
    assert.equal(isFootnoteMarkerVerseText("王后瓦实提却不肯遵太监所传的王命而来"), false);
  });

  it("drops Esth.1-style footnote leaks while keeping neighbors", () => {
    const verses = sanitizeCorpusVerses([
      {
        verse: 13,
        text: "那时，在王左右常见王面、国中坐高位的，有波斯和米底亚的七个大臣，就是甲示拿、示达、押玛他、他施斯、米力、玛西拿、米母干，都是达时务的明哲人。按王的常规，办事必先询问知例明法的人。王问他们说：",
      },
      { verse: 14, text: "a" },
      { verse: 15, text: "「王后瓦实提不遵太监所传的王命，照例应当怎样办理呢？」" },
    ]);
    assert.deepEqual(
      verses.map((v) => v.verse),
      [13, 15],
    );
    assert.ok(!verses.some((v) => v.text === "a"));
  });

  it("keeps short real Chinese verses like Job 3:2", () => {
    assert.deepEqual(sanitizeCorpusVerses([{ verse: 2, text: "说：" }]), [
      { verse: 2, text: "说：" },
    ]);
  });

  it("sanitizes a chapter object in place shape", () => {
    const ch = sanitizeCorpusChapter({
      book: "Esth",
      chapter: 1,
      verses: [
        { verse: 14, text: "a" },
        { verse: 15, text: "「王后瓦实提不遵太监所传的王命，照例应当怎样办理呢？」" },
      ],
    });
    assert.equal(ch.verses.length, 1);
    assert.equal(ch.verses[0]?.verse, 15);
  });
});
