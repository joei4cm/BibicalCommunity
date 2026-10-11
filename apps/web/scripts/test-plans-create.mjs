import { chromium } from "playwright";
import { copyFileSync, mkdirSync } from "node:fs";

const handle = `pl${Date.now().toString(36)}`;
const base = process.env.WEB_BASE ?? "http://127.0.0.1:5173";
const artifacts = "/opt/cursor/artifacts";
mkdirSync(artifacts, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const logs = [];
page.on("console", (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on("pageerror", (err) => logs.push(`[pageerror] ${err.message}`));

await page.goto(`${base}/app/me`, { waitUntil: "networkidle" });
await page.waitForSelector('[data-testid="login-page"]', { timeout: 10000 });
await page.click('[data-testid="login-switch-mode"]');
await page.fill('[data-testid="login-handle"]', handle);
await page.fill('[data-testid="login-password"]', "password12345");
await page.fill('[data-testid="login-nickname"]', "PlanNick");
await page.click('[data-testid="login-submit"]');
await page.waitForURL(/\/app\//, { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(800);

await page.goto(`${base}/app/plans`, { waitUntil: "networkidle" });
await page.waitForSelector('[data-testid="plans-page"]', { timeout: 10000 });
await page.waitForSelector('[data-testid="plans-fab"]', { timeout: 10000 });

const headerCtas = await page.locator('[data-testid="plans-cta-bar"]').count();
const emptyNew = await page.locator('[data-testid="plans-empty-new"]').count();
const emptyAdd = await page.locator('[data-testid="plans-empty-add"]').count();
if (headerCtas !== 0 || emptyNew !== 0 || emptyAdd !== 0) {
  console.error(JSON.stringify({ error: "duplicate_ctas", headerCtas, emptyNew, emptyAdd }));
  await page.screenshot({ path: `${artifacts}/plans-cta-fail.png`, fullPage: true });
  await browser.close();
  process.exit(1);
}

const pageShot = "/tmp/playwright-plans-page.png";
await page.screenshot({ path: pageShot, fullPage: true });
copyFileSync(pageShot, `${artifacts}/plans-cta-page.png`);

await page.click('[data-testid="plans-fab"]');
await page.waitForSelector('[data-testid="plans-actions-sheet"]', { timeout: 5000 });
const actionsShot = "/tmp/playwright-plans-actions.png";
await page.screenshot({ path: actionsShot, fullPage: true });
copyFileSync(actionsShot, `${artifacts}/plans-cta-actions.png`);

await page.click('[data-testid="plans-new-open"]');
await page.waitForSelector('[data-testid="plans-create-sheet"]', { timeout: 5000 });
await page.fill('[data-testid="plans-create-title"]', "晨祷计划");
const createShot = "/tmp/playwright-plans-create-step1.png";
await page.screenshot({ path: createShot, fullPage: true });
copyFileSync(createShot, `${artifacts}/plans-cta-create.png`);

await page.click('[data-testid="plans-create-next"]');
await page.waitForSelector('[data-testid="plans-create-submit"]', { timeout: 5000 });
await page.click('[data-testid="plans-create-submit"]');
await page.waitForTimeout(2000);

const body = await page.locator("body").innerText();
const shot = "/tmp/playwright-plans-create.png";
await page.screenshot({ path: shot, fullPage: true });
copyFileSync(shot, `${artifacts}/plans-cta-done.png`);

const hasActionsOnlyEntry =
  (await page.locator('[data-testid="plans-fab"]').count()) === 1 ||
  body.includes("晨祷计划");
const ok =
  hasActionsOnlyEntry &&
  body.includes("晨祷计划") &&
  (body.includes("计划已创建") ||
    body.includes("今日灵修") ||
    body.includes("2") ||
    body.includes("天") ||
    body.includes("days"));

console.log(
  JSON.stringify(
    {
      handle,
      ok,
      hasTitle: body.includes("晨祷计划"),
      noDuplicateCtas: true,
      shot,
      artifacts: [
        `${artifacts}/plans-cta-page.png`,
        `${artifacts}/plans-cta-actions.png`,
        `${artifacts}/plans-cta-create.png`,
        `${artifacts}/plans-cta-done.png`,
      ],
      logs: logs.slice(-20),
    },
    null,
    2,
  ),
);
await browser.close();
process.exit(ok ? 0 : 1);
