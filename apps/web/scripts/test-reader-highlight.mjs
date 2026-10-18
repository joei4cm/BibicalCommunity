/**
 * Tap and drag select a verse range and surface highlight colors immediately.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const WEB = process.env.WEB_BASE ?? "http://127.0.0.1:5176";
const artifacts = "/opt/cursor/artifacts";
mkdirSync(artifacts, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

let highlightSaved = false;
const deletes = [];

await page.route("**/v1/**", async (route) => {
  const url = new URL(route.request().url());
  const path = url.pathname;
  const method = route.request().method();
  if (path.endsWith("/v1/annotations") && method === "GET") {
    const annotations = highlightSaved
      ? [
          {
            id: "h1",
            translationId: "cuvs",
            book: "John",
            chapter: 1,
            verseStart: 1,
            verseEnd: 3,
            kind: "highlight",
            color: "amber",
            ciphertext: "",
            iv: "",
          },
        ]
      : [];
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ annotations }),
    });
  }
  if (path.endsWith("/v1/annotations") && method === "POST") {
    highlightSaved = true;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "h1" }),
    });
  }
  if (path.includes("/v1/annotations/") && method === "DELETE") {
    deletes.push(path);
    highlightSaved = false;
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  }
  if (path.endsWith("/v1/bible/chapter")) {
    const ref = url.searchParams.get("ref") ?? "John.1";
    const [book, chapterRaw] = ref.split(".");
    const chapter = Number(chapterRaw) || 1;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        translationId: "cuvs",
        book,
        chapter,
        source: "mock",
        verses: [1, 2, 3, 4, 5, 6].map((verse) => ({
          verse,
          text: `第${verse}节`,
        })),
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
  localStorage.removeItem("lh.readerDockCollapsed");
});

await page.goto(`${WEB}/app/bible/cuvs/john/1`, { waitUntil: "domcontentloaded" });
await page.waitForSelector('[data-verse="1"]', { timeout: 20000 });
await page.waitForSelector('[data-testid="reader-dock-note"]');

const searchBefore = await page.locator('[data-testid="reader-dock-search"]').count();
if (searchBefore !== 0) throw new Error("search should stay behind 更多");
await page.click('[data-testid="reader-dock-more"]');
await page.waitForSelector('[data-testid="reader-dock-search"]');
await page.screenshot({ path: `${artifacts}/reader-dock-more.png` });

await page.locator('[data-verse="1"]').click();
await page.waitForSelector('[data-testid="reader-selection-bar"]');
await page.waitForSelector('[data-testid="reader-highlight-amber"]');
const onlyOne = await page.locator('[data-verse].verse-selected').count();
if (onlyOne !== 1) throw new Error(`expected 1 selected verse, got ${onlyOne}`);

await page.locator('[data-verse="3"]').click();
await page.waitForFunction(() => {
  const nodes = [...document.querySelectorAll("[data-verse]")];
  return ["1", "2", "3"].every((n) =>
    nodes.some((el) => el.getAttribute("data-verse") === n && el.classList.contains("verse-selected")),
  );
});
await page.screenshot({ path: `${artifacts}/reader-selection-range.png` });

await page.click('[data-testid="reader-highlight-amber"]');
await page.waitForSelector('[data-testid="reader-unhighlight"]');
await page.click('[data-testid="reader-unhighlight"]');
await page.waitForFunction(() => !document.querySelector('[data-testid="reader-unhighlight"]'));
if (deletes.length !== 1) throw new Error(`expected 1 delete, got ${deletes.length}: ${deletes.join(",")}`);
const stillSelected = await page.locator('[data-verse="1"].verse-selected').count();
if (stillSelected !== 1) throw new Error("selection should stay after clearing highlight");

await page.click('[data-testid="reader-clear-selection"]');
await page.waitForSelector('[data-testid="reader-selection-bar"]', { state: "detached" });

await page.locator('[data-verse="2"]').click();
await page.waitForSelector('[data-verse="2"].verse-selected');
await page.locator('[data-verse="2"]').click();
await page.waitForFunction(() => !document.querySelector("[data-verse].verse-selected"));

async function hitPoint(locator) {
  return locator.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    for (let y = rect.top + 2; y < rect.bottom; y += 3) {
      for (let x = rect.left + 2; x < Math.min(rect.right, rect.left + 240); x += 6) {
        const stack = document.elementsFromPoint(x, y);
        const top = stack.find((node) => node instanceof Element && node.closest("[data-verse]"));
        const host = top instanceof Element ? top.closest("[data-verse]") : null;
        if (host === el) return { x, y };
      }
    }
    return null;
  });
}

const v1 = page.locator('[data-verse="1"]');
const v5 = page.locator('[data-verse="5"]');
const a = await hitPoint(v1);
const b = await hitPoint(v5);
if (!a || !b) throw new Error(`missing hit point ${JSON.stringify(a)} ${JSON.stringify(b)}`);
await page.mouse.move(a.x, a.y);
await page.mouse.down();
await page.mouse.move(b.x, b.y, { steps: 16 });
await page.mouse.up();
const selectedAfterDrag = await page.locator("[data-verse].verse-selected").evaluateAll((els) =>
  els.map((el) => el.getAttribute("data-verse")),
);
if (!selectedAfterDrag.includes("1") || selectedAfterDrag.length < 3) {
  throw new Error(`drag selected ${selectedAfterDrag.join(",")}`);
}
await page.screenshot({ path: `${artifacts}/reader-selection-drag.png` });

await browser.close();
console.log("ok");
