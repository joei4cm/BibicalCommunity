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
});
