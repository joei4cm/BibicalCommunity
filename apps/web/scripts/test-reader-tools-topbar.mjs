/**
 * Tools live in the top bar — no corner FAB covering verse text.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const WEB = process.env.WEB_BASE ?? "http://127.0.0.1:5176";
const artifacts = "/opt/cursor/artifacts";
mkdirSync(artifacts, { recursive: true });
mkdirSync("/workspace/.oil-ui/reader-tools/shots", { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

await page.route("**/v1/**", async (route) => {
  const url = new URL(route.request().url());
  const path = url.pathname;
  if (path.endsWith("/v1/bible/chapter")) {
    const ref = url.searchParams.get("ref") ?? "John.1";
    const [book, chapterRaw] = ref.split(".");
    const verses = Array.from({ length: 20 }, (_, i) => ({
      verse: i + 1,
      text: `这是约翰福音第${chapterRaw || 1}章第${i + 1}节的模拟经文，用来检查工具入口是否挡住右侧文字。`,
    }));
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        translationId: "cuvs",
        book,
        chapter: Number(chapterRaw) || 1,
        source: "mock",
        verses,
      }),
    });
  }
  if (path.endsWith("/v1/me")) {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "usr_tools", uid: "TL", nickname: "Reader" }),
    });
  }
  if (path.endsWith("/v1/annotations") && route.request().method() === "GET") {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ annotations: [] }),
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
  localStorage.setItem("lh.readerDockCollapsed", "1");
});

await page.goto(`${WEB}/app/bible/cuvs/john/1`, { waitUntil: "domcontentloaded" });
await page.waitForSelector('[data-verse="1"]', { timeout: 20000 });
await page.waitForSelector('[data-testid="reader-dock-expand"]');

// Collapsed: no floating FAB, no bottom tools dock.
const fab = await page.locator(".bible-dock-fab").count();
if (fab !== 0) throw new Error("corner FAB must be gone");
const dockCollapsed = await page.locator('[data-testid="reader-dock"]').count();
if (dockCollapsed !== 0) throw new Error("tools dock must be hidden when collapsed");

await page.screenshot({ path: `${artifacts}/reader-tools-topbar-collapsed.png`, fullPage: false });
await page.screenshot({
  path: `/workspace/.oil-ui/reader-tools/shots/collapsed.png`,
  fullPage: false,
});

await page.click('[data-testid="reader-dock-expand"]');
await page.waitForSelector('[data-testid="reader-dock-tools"]');
await page.waitForSelector('[data-testid="reader-dock-collapse"]');

const topOn = await page.locator('[data-testid="reader-dock-expand"].is-on').count();
if (topOn !== 1) throw new Error("top Tools button should be active when dock open");

await page.screenshot({ path: `${artifacts}/reader-tools-topbar-expanded.png`, fullPage: false });
await page.screenshot({
  path: `/workspace/.oil-ui/reader-tools/shots/expanded.png`,
  fullPage: false,
});

await page.locator('[data-verse="2"]').click();
await page.waitForSelector('[data-testid="reader-selection-bar"]');
await page.screenshot({ path: `${artifacts}/reader-tools-selection.png`, fullPage: false });
await page.screenshot({
  path: `/workspace/.oil-ui/reader-tools/shots/selection.png`,
  fullPage: false,
});

await page.click('[data-testid="reader-clear-selection"]');
await page.waitForSelector('[data-testid="reader-dock-tools"]');
await page.click('[data-testid="reader-dock-collapse"]');
await page.waitForFunction(() => !document.querySelector('[data-testid="reader-dock"]'));

await browser.close();
console.log("ok");
