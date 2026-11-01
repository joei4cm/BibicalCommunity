/**
 * Tap/drag select, recolor replaces, chapter bookmark toggles without sticking.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const WEB = process.env.WEB_BASE ?? "http://127.0.0.1:5176";
const artifacts = "/opt/cursor/artifacts";
mkdirSync(artifacts, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

let highlightRows = [];
let bookmarkRows = [];
let nextId = 1;
const deletes = [];

function chapterVerses() {
  return [1, 2, 3, 4, 5, 6].map((verse) => ({ verse, text: `第${verse}节` }));
}

await page.route("**/v1/**", async (route) => {
  const url = new URL(route.request().url());
  const path = url.pathname;
  const method = route.request().method();
  if (path.endsWith("/v1/annotations") && method === "GET") {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ annotations: [...highlightRows, ...bookmarkRows] }),
    });
  }
  if (path.endsWith("/v1/annotations") && method === "POST") {
    const body = route.request().postDataJSON();
    const id = `ann_${nextId++}`;
    const row = {
      id,
      translationId: body.translationId,
      book: body.ref.book,
      chapter: body.ref.chapter,
      verseStart: body.ref.verseStart,
      verseEnd: body.ref.verseEnd ?? body.ref.verseStart,
      kind: body.kind,
      color: body.color ?? null,
      ciphertext: body.ciphertext ?? "",
      iv: body.iv ?? "",
    };
    if (body.kind === "highlight") highlightRows.push(row);
    if (body.kind === "bookmark") bookmarkRows.push(row);
    return route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ id }),
    });
  }
  if (path.includes("/v1/annotations/") && method === "DELETE") {
    const id = path.split("/").pop();
    deletes.push(id);
    highlightRows = highlightRows.filter((r) => r.id !== id);
    bookmarkRows = bookmarkRows.filter((r) => r.id !== id);
    return route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' });
  }
  if (path.endsWith("/v1/bible/chapter")) {
    const ref = url.searchParams.get("ref") ?? "John.1";
    const [book, chapterRaw] = ref.split(".");
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        translationId: "cuvs",
        book,
        chapter: Number(chapterRaw) || 1,
        source: "mock",
        verses: chapterVerses(),
      }),
    });
  }
  if (path.endsWith("/v1/me")) {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "usr_hl", uid: "HL", nickname: "Reader" }),
    });
  }
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ annotations: [], commands: [], conversations: [], friends: [] }),
  });
});

await page.addInitScript(() => {
  localStorage.setItem("lh.token", "demo");
  // Expanded dock for selection helpers; bookmark lives in the top bar.
  localStorage.setItem("lh.readerDockCollapsed", "0");
});

await page.goto(`${WEB}/app/bible/cuvs/john/1`, { waitUntil: "domcontentloaded" });
await page.waitForSelector('[data-verse="1"]', { timeout: 20000 });
await page.waitForSelector('[data-testid="reader-top-bookmark"]');

await page.locator('[data-verse="1"]').click();
await page.waitForSelector('[data-testid="reader-selection-bar"]');
await page.locator('[data-verse="3"]').click();
await page.waitForFunction(() => {
  return ["1", "2", "3"].every((n) =>
    document.querySelector(`[data-verse="${n}"]`)?.classList.contains("verse-selected"),
  );
});
await page.click('[data-testid="reader-highlight-amber"]');
await page.waitForSelector('[data-testid="reader-unhighlight"]');
await page.waitForFunction(() =>
  document.querySelector('[data-verse="1"]')?.getAttribute("data-highlighted") === "1",
);
if (highlightRows.length !== 1) throw new Error(`expected 1 highlight, got ${highlightRows.length}`);

await page.click('[data-testid="reader-highlight-mint"]');
await page.waitForFunction(() => {
  const el = document.querySelector('[data-verse="2"]');
  const hl = getComputedStyle(el).getPropertyValue("--verse-hl").trim();
  return hl === "#a8e6cf";
});
if (highlightRows.length !== 1) {
  throw new Error(`recolor should replace, got ${highlightRows.length} rows`);
}
if (highlightRows[0].color !== "mint") throw new Error(`expected mint, got ${highlightRows[0].color}`);

await page.click('[data-testid="reader-clear-selection"]');
await page.waitForSelector('[data-testid="reader-selection-bar"]', { state: "detached" });
await page.locator('[data-verse="2"]').click();
await page.waitForFunction(() => {
  const selected = [...document.querySelectorAll("[data-verse].verse-selected")].map((el) =>
    el.getAttribute("data-verse"),
  );
  return selected.join(",") === "1,2,3";
});
await page.screenshot({ path: `${artifacts}/reader-highlight-range-select.png` });

await page.click('[data-testid="reader-clear-selection"]');
await page.click('[data-testid="reader-top-bookmark"]');
await page.waitForSelector('[data-testid="reader-chapter-bookmarked"]');
if (bookmarkRows.length !== 1) throw new Error(`expected 1 bookmark, got ${bookmarkRows.length}`);
await page.screenshot({ path: `${artifacts}/reader-chapter-bookmarked.png` });

await page.click('[data-testid="reader-bottom-next-chapter"]');
await page.waitForURL(/\/john\/2/);
await page.waitForSelector('[data-verse="1"]');
await page.waitForFunction(() => !document.querySelector('[data-testid="reader-chapter-bookmarked"]'));
const stickyHl = await page.locator('[data-verse="1"][data-highlighted="1"]').count();
if (stickyHl !== 0) throw new Error("highlight leaked into next chapter");
const bookmarkOn = await page.locator('[data-testid="reader-top-bookmark"].is-on').count();
if (bookmarkOn !== 0) throw new Error("bookmark stayed active on next chapter");
await page.screenshot({ path: `${artifacts}/reader-bookmark-cleared-next-chapter.png` });

await page.click('[data-testid="reader-bottom-prev-chapter"]');
await page.waitForURL(/\/john\/1/);
await page.waitForSelector('[data-testid="reader-chapter-bookmarked"]');
await page.waitForSelector('[data-verse="1"][data-highlighted="1"]');

await page.click('[data-testid="reader-top-bookmark"]');
await page.waitForFunction(() => !document.querySelector('[data-testid="reader-chapter-bookmarked"]'));
if (bookmarkRows.length !== 0) throw new Error("bookmark toggle off should delete");

await browser.close();
console.log("ok", { deletes: deletes.length, highlights: highlightRows.length });
