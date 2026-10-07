import { chromium } from "playwright";

const handle = `pw${Date.now().toString(36)}`;
const base = process.env.WEB_BASE ?? "http://127.0.0.1:5173";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const logs = [];
page.on("console", (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on("pageerror", (err) => logs.push(`[pageerror] ${err.message}`));
const requests = [];
page.on("request", (req) => {
  if (req.url().includes("/v1/")) requests.push(`${req.method()} ${req.url()}`);
});
const responses = [];
page.on("response", async (res) => {
  if (res.url().includes("/v1/auth/register")) {
    responses.push({ status: res.status(), body: await res.text().catch(() => "") });
  }
});

await page.goto(`${base}/app/me`, { waitUntil: "networkidle" });
await page.fill('[data-testid="me-handle"]', handle);
await page.fill('[data-testid="me-password"]', "password12345");
await page.fill('[data-testid="me-nickname"]', "PwNick");
await page.click('[data-testid="me-register"]');
await page.waitForTimeout(2500);

const status = await page.locator('[data-testid="me-auth-status"]').textContent().catch(() => null);
const uid = await page.locator('[data-testid="me-uid"]').textContent().catch(() => null);
const shot = "/tmp/playwright-me-register.png";
await page.screenshot({ path: shot, fullPage: true });

console.log(JSON.stringify({ handle, status, uid, requests, responses, logs: logs.slice(-30), shot }, null, 2));
await browser.close();
process.exit(uid ? 0 : 1);
