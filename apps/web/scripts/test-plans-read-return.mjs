/**
 * Smoke: mine plan → reading with from=plans → return bar → resume devotion.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const WEB = process.env.WEB_BASE ?? "http://127.0.0.1:5174";
const artifacts = "/opt/cursor/artifacts";
mkdirSync(artifacts, { recursive: true });
const stamp = Date.now().toString(36);
const selfId = `usr_plans_${stamp}`;
const planId = `plan_${stamp}`;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });
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
            planId,
            title: "晨读",
            progressDay: 0,
            devotionStep: "pause",
            days: [{ day: 1, ref: "John.1", title: "太初有道" }],
          },
        ],
      }),
    });
  }
  if (path.endsWith("/v1/plans/public")) {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ plans: [] }),
    });
  }
  if (path.includes("/devotion") && method === "POST") {
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  }
  if (path.includes("/v1/bible/chapter")) {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        translationId: "cuvs",
        book: "John",
        chapter: 1,
        verses: [{ verse: 1, text: "太初有道，道与神同在，道就是神。" }],
        source: "demo",
      }),
    });
  }
  return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
});

await page.addInitScript((tok) => localStorage.setItem("lh.token", tok), `tok_${stamp}`);
await page.goto(`${WEB}/app/plans`, { waitUntil: "networkidle" });
await page.waitForSelector('[data-testid="plans-start-reading"]', { timeout: 12000 });

const emptyDiscover = await page.locator('[data-testid="plans-empty-discover"]').count();
const headerCta = await page.locator('[data-testid="plans-cta-bar"]').count();

await page.screenshot({ path: `${artifacts}/plans-mine-read-cta.png`, fullPage: true });
await page.click('[data-testid="plans-start-reading"]');
await page.waitForURL(/\/app\/bible\/.*from=plans/, { timeout: 10000 });
await page.waitForSelector('[data-testid="reader-plans-return"]', { timeout: 10000 });
await page.screenshot({ path: `${artifacts}/plans-reader-return-bar.png`, fullPage: true });
await page.click('[data-testid="reader-done-return-plans"]');
await page.waitForURL(/\/app\/plans/, { timeout: 10000 });
await page.waitForTimeout(600);
await page.screenshot({ path: `${artifacts}/plans-after-resume.png`, fullPage: true });

const onPlans = page.url().includes("/app/plans");
const ok = emptyDiscover === 0 && headerCta === 0 && onPlans;
console.log(
  JSON.stringify(
    {
      ok,
      emptyDiscover,
      headerCta,
      url: page.url(),
      shots: [
        `${artifacts}/plans-mine-read-cta.png`,
        `${artifacts}/plans-reader-return-bar.png`,
        `${artifacts}/plans-after-resume.png`,
      ],
    },
    null,
    2,
  ),
);
await browser.close();
process.exit(ok ? 0 : 1);
