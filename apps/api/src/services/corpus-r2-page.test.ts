import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  fetchR2ChaptersByKeys,
  listR2ChapterKeyPage,
  mapPool,
} from "./corpus-r2-page.ts";

describe("mapPool", () => {
  it("preserves order with limited concurrency", async () => {
    const seen: number[] = [];
    const out = await mapPool([1, 2, 3, 4, 5], 2, async (n) => {
      seen.push(n);
      await new Promise((r) => setTimeout(r, 5));
      return n * 10;
    });
    assert.deepEqual(out, [10, 20, 30, 40, 50]);
    assert.equal(seen.length, 5);
  });
});

describe("listR2ChapterKeyPage", () => {
  it("pages with startAfter and skips non-chapter keys", async () => {
    const all = [
      "bible/cuvs/Gen.1.json",
      "bible/cuvs/Gen.2.json",
      "bible/cuvs/_pack.v1.json",
      "bible/cuvs/Exod.1.json",
      "bible/cuvs/Exod.2.json",
      "bible/cuvs/Matt.1.json",
    ];
    const media = {
      async list(opts: { startAfter?: string; limit?: number; cursor?: string }) {
        let start = 0;
        if (opts.startAfter) {
          const idx = all.findIndex((k) => k === opts.startAfter);
          start = idx === -1 ? all.length : idx + 1;
        }
        const limit = opts.limit ?? 1000;
        const slice = all.slice(start, start + limit);
        return {
          objects: slice.map((key) => ({ key })),
          truncated: start + slice.length < all.length,
          cursor: start + slice.length < all.length ? `c-${start + slice.length}` : undefined,
        };
      },
      async get() {
        return null;
      },
    };

    const page1 = await listR2ChapterKeyPage(media, "bible/cuvs/", { limit: 2 });
    assert.deepEqual(page1.keys, ["bible/cuvs/Gen.1.json", "bible/cuvs/Gen.2.json"]);
    assert.equal(page1.done, false);
    assert.equal(page1.nextAfter, "bible/cuvs/Gen.2.json");

    const page2 = await listR2ChapterKeyPage(media, "bible/cuvs/", {
      afterKey: page1.nextAfter!,
      limit: 2,
    });
    assert.deepEqual(page2.keys, ["bible/cuvs/Exod.1.json", "bible/cuvs/Exod.2.json"]);
    assert.equal(page2.done, false);

    const page3 = await listR2ChapterKeyPage(media, "bible/cuvs/", {
      afterKey: page2.nextAfter!,
      limit: 2,
    });
    assert.deepEqual(page3.keys, ["bible/cuvs/Matt.1.json"]);
    assert.equal(page3.done, true);
    assert.equal(page3.nextAfter, null);
  });
});

describe("fetchR2ChaptersByKeys", () => {
  it("loads chapters in parallel and drops bad keys", async () => {
    const bodies: Record<string, string> = {
      "bible/cuvs/Gen.1.json": JSON.stringify({
        book: "Gen",
        chapter: 1,
        verses: [{ verse: 1, text: "起初，神创造天地。" }],
      }),
      "bible/cuvs/Gen.2.json": "not-json",
      "bible/cuvs/Exod.1.json": JSON.stringify({
        book: "Exod",
        chapter: 1,
        verses: [{ verse: 1, text: "以色列的众子，各带家眷和雅各一同来到埃及。" }],
      }),
    };
    let inflight = 0;
    let maxInflight = 0;
    const media = {
      async list() {
        return { objects: [], truncated: false };
      },
      async get(key: string) {
        inflight += 1;
        maxInflight = Math.max(maxInflight, inflight);
        await new Promise((r) => setTimeout(r, 10));
        inflight -= 1;
        const raw = bodies[key];
        if (!raw) return null;
        return { text: async () => raw };
      },
    };
    const chapters = await fetchR2ChaptersByKeys(
      media,
      Object.keys(bodies),
      3,
    );
    assert.equal(chapters.length, 2);
    assert.equal(chapters[0]?.book, "Gen");
    assert.equal(chapters[1]?.book, "Exod");
    assert.ok(maxInflight >= 2, `expected parallel gets, maxInflight=${maxInflight}`);
  });
});
