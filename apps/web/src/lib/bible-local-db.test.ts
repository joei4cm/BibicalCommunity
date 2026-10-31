import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  chapterHasPlaceholderVerses,
  densifyChapterVerses,
  isIncompleteLocalChapter,
  isPlaceholderVerseText,
} from "./bible-local-db.ts";

describe("placeholder corpus guards", () => {
  it("detects preview stub copy", () => {
    assert.equal(
      isPlaceholderVerseText(
        "（预览）John 4 章全文尚未载入。可继续选书选章；安装完整译本后显示经文。",
      ),
      true,
    );
    assert.equal(isPlaceholderVerseText("太初有道，道与 神同在，道就是 神。"), false);
  });

  it("marks placeholder chapters incomplete", () => {
    assert.equal(
      isIncompleteLocalChapter({
        verses: [
          {
            verse: 1,
            text: "（预览）John 4 章全文尚未载入。可继续选书选章；安装完整译本后显示经文。",
          },
        ],
      }),
      true,
    );
  });

  it("densify never invents placeholder text", () => {
    const out = densifyChapterVerses("cuvs", "John", 4, []);
    assert.equal(chapterHasPlaceholderVerses(out), false);
  });

  it("keeps real network verses over stubs", () => {
    const real = [{ verse: 1, text: "主知道法利赛人听见他收门徒，施洗，比约翰还多，" }];
    const out = densifyChapterVerses("cuvs", "John", 4, real);
    assert.deepEqual(out, real);
  });

  it("strips CrossWire footnote-marker verses from cached chapters", () => {
    const out = densifyChapterVerses("cuvs", "Esth", 1, [
      {
        verse: 13,
        text: "那时，在王左右常见王面、国中坐高位的，有波斯和米底亚的七个大臣，就是甲示拿、示达、押玛他、他施斯、米力、玛西拿、米母干，都是达时务的明哲人。按王的常规，办事必先询问知例明法的人。王问他们说：",
      },
      { verse: 14, text: "a" },
      { verse: 15, text: "「王后瓦实提不遵太监所传的王命，照例应当怎样办理呢？」" },
    ]);
    assert.deepEqual(
      out.map((v) => v.verse),
      [13, 15],
    );
  });
});
