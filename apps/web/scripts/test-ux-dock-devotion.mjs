/**
 * Smoke screenshots: edge dock, devotion timeline, version stamp.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const WEB = process.env.WEB_BASE ?? "http://127.0.0.1:4173";
const artifacts = "/opt/cursor/artifacts";
mkdirSync(artifacts, { recursive: true });
const stamp = Date.now().toString(36);
const selfId = `usr_ux_${stamp}`;
const planId = `plan_${stamp}`;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  serviceWorkers: "block",
  viewport: { width: 390, height: 844 },
});
const page = await context.newPage();

await page.route("**/v1/**", async (route) => {
  const url = new URL(route.request().url());
  const path = url.pathname;
  const method = route.request().method();
  if (path.endsWith("/v1/me")) {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: selfId, uid: "PUID", nickname: "PlanUser" }),
    });
  }
  if (path.endsWith("/v1/plans") && method === "GET") {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        plans: [{ id: planId, title: "晨读", visibility: "private", days: [{ day: 1, ref: "John.1" }] }],
      }),
    });
  }
  if (path.endsWith("/v1/plans/subscriptions")) {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        subscriptions: [
          {
            subscriptionId: "sub1",
            planId,
            title: "晨读",
            progressDay: 0,
            devotionStep: "reflect",
            days: [{ day: 1, ref: "John.1", title: "太初有道" }],
          },
        ],
      }),
    });
  }
  if (path.includes("/devotion") && method === "POST") {
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  }
  if (path.endsWith("/v1/plans/public")) {
    return route.fulfill({ status: 200, contentType: "application/json", body: '{"plans":[]}' });
  }
  return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
});

await page.addInitScript(() => {
  localStorage.setItem("lh.token", "demo");
  localStorage.setItem("lh.readerDockCollapsed", "1");
});

await page.goto(`${WEB}/app/bible/cuvs/john/1`, { waitUntil: "networkidle" });
await page.waitForSelector('[data-testid="reader-dock-expand"]', { timeout: 15000 });
await page.screenshot({ path: `${artifacts}/reader-dock-edge-collapsed.png`, fullPage: false });
await page.click('[data-testid="reader-dock-expand"]');
await page.waitForSelector('[data-testid="reader-dock-collapse"]');
await page.waitForSelector('[data-testid="reader-dock-search"]');
await page.waitForSelector('[data-testid="reader-top-bookmark"]');
const bookmarkLabel = await page.locator('[data-testid="reader-top-bookmark"]').innerText();
if (bookmarkLabel.includes("本章")) throw new Error(`bookmark label still odd: ${bookmarkLabel}`);
await page.screenshot({ path: `${artifacts}/reader-dock-expanded.png`, fullPage: false });

await page.goto(`${WEB}/app/plans`, { waitUntil: "networkidle" });
await page.waitForSelector('[data-testid="plans-timeline"]', { timeout: 15000 });
await page.waitForSelector('[data-testid="plans-stage-card"]');
await page.screenshot({ path: `${artifacts}/plans-devotion-timeline.png`, fullPage: false });

await page.goto(`${WEB}/app/me`, { waitUntil: "networkidle" });
const ver = await page.locator('[data-testid="me-version-build"]').textContent().catch(() => null);
console.log("version_build", ver);
await page.screenshot({ path: `${artifacts}/me-version-build.png`, fullPage: false });

await browser.close();
console.log("ok");
