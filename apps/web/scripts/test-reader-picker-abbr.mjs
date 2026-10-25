/**
 * Passage picker shows abbreviated book labels in a dense grid.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const WEB = process.env.WEB_BASE ?? "http://127.0.0.1:5176";
const artifacts = "/opt/cursor/artifacts";
mkdirSync(artifacts, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

await page.route("**/v1/**", async (route) => {
  const url = new URL(route.request().url());
  if (url.pathname.endsWith("/v1/bible/chapter")) {
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
        verses: [1, 2, 3].map((verse) => ({ verse, text: `第${verse}节` })),
      }),
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
});

await page.goto(`${WEB}/app/bible/cuvs/john/1`, { waitUntil: "domcontentloaded" });
await page.waitForSelector('[data-testid="reader-passage-title"]');
await page.click('[data-testid="reader-passage-title"]');
await page.waitForSelector('[data-testid="reader-picker-books"]');

const labels = await page.locator('[data-testid="reader-picker-books"] .bible-picker-item').allTextContents();
if (labels.length < 20) throw new Error(`expected dense NT book grid, got ${labels.length}`);
if (!labels.includes("约")) throw new Error(`missing 约, got ${labels.join(",")}`);
if (labels.some((x) => x.includes("约翰福音"))) throw new Error("full names still shown");

await page.click('[data-testid="reader-picker-testament"] button:has-text("旧约")');
await page.waitForFunction(() =>
  [...document.querySelectorAll('[data-testid="reader-picker-books"] .bible-picker-item')].some(
    (el) => el.textContent?.trim() === "创",
  ),
);
await page.screenshot({ path: `${artifacts}/reader-picker-abbr-ot.png` });

await page.click('[data-testid="reader-picker-book-Ps"]');
await page.waitForSelector('[data-testid="reader-picker-chapters"]');
await page.click('[data-testid="reader-picker-chapters"] .bible-picker-item:has-text("23")');
await page.waitForURL(/\/ps\/23/);
await page.screenshot({ path: `${artifacts}/reader-picker-abbr-jumped.png` });

await browser.close();
console.log("ok", { sample: labels.slice(0, 8) });
