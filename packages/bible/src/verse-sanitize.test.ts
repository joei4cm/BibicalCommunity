import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatVerseNumLabel,
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

  it("absorbs Esth.1:14 marker into a 13-14 range label", () => {
    const verses = sanitizeCorpusVerses([
      {
        verse: 13,
        text: "那时，在王左右常见王面、国中坐高位的，有波斯和米底亚的七个大臣，就是甲示拿、示达、押玛他、他施斯、米力、玛西拿、米母干，都是达时务的明哲人。按王的常规，办事必先询问知例明法的人。王问他们说：",
      },
      { verse: 14, text: "a" },
      { verse: 15, text: "「王后瓦实提不遵太监所传的王命，照例应当怎样办理呢？」" },
    ]);
    assert.equal(verses.length, 2);
    assert.equal(verses[0]?.verse, 13);
    assert.equal(verses[0]?.verseEnd, 14);
    assert.equal(verses[1]?.verse, 15);
    assert.equal(formatVerseNumLabel(verses[0]!.verse, verses[0]!.verseEnd), "13-14");
    assert.ok(!verses.some((v) => v.text === "a"));
  });

  it("absorbs consecutive Psalm 8 style markers into one range", () => {
    const verses = sanitizeCorpusVerses([
      { verse: 6, text: "你派他管理你手所造的，使万物，就是一切的牛羊、田野的兽、空中的鸟、海里的鱼，凡经行海道的，都服在他的脚下。" },
      { verse: 7, text: "a" },
      { verse: 8, text: "a" },
      { verse: 9, text: "耶和华―我们的主啊，你的名在全地何其美！" },
    ]);
    assert.deepEqual(
      verses.map((v) => ({ verse: v.verse, verseEnd: v.verseEnd, label: formatVerseNumLabel(v.verse, v.verseEnd) })),
      [
        { verse: 6, verseEnd: 8, label: "6-8" },
        { verse: 9, verseEnd: undefined, label: "9" },
      ],
    );
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
        { verse: 13, text: "王问他们说：" },
        { verse: 14, text: "a" },
        { verse: 15, text: "「王后瓦实提不遵太监所传的王命，照例应当怎样办理呢？」" },
      ],
    });
    assert.equal(ch.verses.length, 2);
    assert.equal(ch.verses[0]?.verseEnd, 14);
    assert.equal(ch.verses[1]?.verse, 15);
  });

  it("formatVerseNumLabel stays single when no end", () => {
    assert.equal(formatVerseNumLabel(3), "3");
    assert.equal(formatVerseNumLabel(3, 3), "3");
    assert.equal(formatVerseNumLabel(3, 5), "3-5");
  });
});
