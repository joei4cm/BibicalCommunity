import { chromium } from "playwright";

const handle = `pl${Date.now().toString(36)}`;
const base = process.env.WEB_BASE ?? "http://127.0.0.1:5173";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const logs = [];
page.on("console", (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on("pageerror", (err) => logs.push(`[pageerror] ${err.message}`));

await page.goto(`${base}/app/me`, { waitUntil: "networkidle" });
await page.fill('[data-testid="me-handle"]', handle);
await page.fill('[data-testid="me-password"]', "password12345");
await page.fill('[data-testid="me-nickname"]', "PlanNick");
await page.click('[data-testid="me-register"]');
await page.waitForSelector('[data-testid="me-uid"]', { timeout: 10000 });

await page.goto(`${base}/app/plans`, { waitUntil: "networkidle" });
await page.waitForSelector('[data-testid="plans-new-open"]', { timeout: 10000 });
await page.click('[data-testid="plans-new-open"]');
await page.waitForSelector('[data-testid="plans-create-sheet"]', { timeout: 5000 });
await page.fill('[data-testid="plans-create-title"]', "晨祷计划");
await page.click('[data-testid="plans-create-next"]');
await page.waitForSelector('[data-testid="plans-create-submit"]', { timeout: 5000 });
await page.click('[data-testid="plans-create-submit"]');
await page.waitForTimeout(2000);

const body = await page.locator("body").innerText();
const shot = "/tmp/playwright-plans-create.png";
await page.screenshot({ path: shot, fullPage: true });
const ok =
  body.includes("晨祷计划") &&
  (body.includes("计划已创建") ||
    body.includes("created:") ||
    body.includes("2 days") ||
    body.includes("天") ||
    body.includes("days"));

console.log(
  JSON.stringify({ handle, ok, hasTitle: body.includes("晨祷计划"), shot, logs: logs.slice(-20) }, null, 2),
);
await browser.close();
process.exit(ok ? 0 : 1);
