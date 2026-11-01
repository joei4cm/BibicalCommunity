/**
 * Smoke: bible tab restores the last passage, dead privacy toggles stay hidden,
 * and group compose picks contacts instead of raw member IDs.
 */
import { chromium } from "playwright";

const WEB = process.env.WEB_BASE ?? "http://127.0.0.1:5176";
const stamp = Date.now().toString(36);
const selfId = `usr_self_${stamp}`;
const peerId = `usr_peer_${stamp}`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.addInitScript(
  ({ token, deviceId }) => {
    localStorage.setItem("lh.token", token);
    localStorage.setItem("lh.deviceId", deviceId);
    localStorage.setItem("lh.locale", "zh-CN");
    localStorage.setItem(
      "lh.reader.place",
      JSON.stringify({ tid: "cuvs", bookSlug: "ps", chapter: 23 }),
    );
  },
  { token: `tok_${stamp}`, deviceId: `dev_${stamp}` },
);

await page.route("**/v1/**", async (route) => {
  const path = new URL(route.request().url()).pathname;
  const json = (body) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  if (path.endsWith("/v1/me")) {
    return json({
      id: selfId,
      uid: "SELFUID",
      nickname: "我",
      handle: "self",
      privacy: {
        discoverableByHandle: true,
        discoverableByUid: true,
        showInChurchDirectory: true,
        allowMessageRequests: "church-only",
        shareReadReceipts: true,
        shareTypingIndicators: true,
        shareLastActive: false,
        notifyMessages: true,
        notifyCalls: true,
      },
      churches: [],
      canAccessAdminConsole: false,
    });
  }
  if (path.endsWith("/v1/friends/directory") || path.endsWith("/v1/friends/requests")) {
    /* handled below or by the fallback */
  } else if (path.endsWith("/v1/friends")) {
    return json({
      friends: [{ friendshipId: "f1", user: { id: peerId, uid: "PEERUID", nickname: "对方" } }],
    });
  }
  if (path.endsWith("/v1/friends/directory")) {
    return json({
      contacts: [
        {
          userId: peerId,
          uid: "PEERUID",
          nickname: "对方",
          signature: null,
          roles: [],
          groupNames: [],
          churches: [],
          source: "friend",
        },
      ],
    });
  }
  if (path.endsWith("/v1/chat/conversations")) return json({ conversations: [] });
  if (path.endsWith("/v1/chat/favorites")) return json({ favorites: [] });
  if (path.endsWith("/v1/me/devices")) return json({ devices: [], currentDeviceId: `dev_${stamp}` });
  return json({
    incoming: [],
    outgoing: [],
    churches: [],
    chatUnread: 0,
    inboxUnread: 0,
    friendRequestsPending: 0,
    calendarPending: 0,
    total: 0,
    commands: [],
    conversations: [],
    friends: [],
    contacts: [],
  });
});

await page.goto(`${WEB}/app`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForURL(/\/app\/bible\/cuvs\/ps\/23/, { timeout: 30_000 });
async function clickTab(label) {
  for (let i = 0; i < 25; i++) {
    const clicked = await page.evaluate((name) => {
      const el = document.querySelector(`nav.tab-bar a[aria-label="${name}"]`);
      if (!el) return false;
      el.click();
      return true;
    }, label);
    if (clicked) return;
    await page.waitForTimeout(200);
  }
  throw new Error(`tab missing: ${label}`);
}
await clickTab("计划");
await page.waitForURL(/\/app\/plans/, { timeout: 15_000 });
await clickTab("圣经");
await page.waitForURL(/\/app\/bible\/cuvs\/ps\/23/, { timeout: 15_000 });
console.log("OK: bible tab restores Psalm 23");

await page.goto(`${WEB}/app/me?section=system`, { waitUntil: "domcontentloaded", timeout: 30_000 });
await page.waitForSelector("[data-testid='me-system-settings-panel']", { timeout: 20_000 });
const systemText = await page.getByTestId("me-system-settings-panel").innerText();
if (systemText.includes("分享正在输入") || systemText.includes("分享最近活跃")) {
  console.error("FAIL: dead typing/last-active toggles are still shown");
  await browser.close();
  process.exit(1);
}
if (!systemText.includes("分享已读回执")) {
  console.error("FAIL: read receipt toggle missing");
  await browser.close();
  process.exit(1);
}
console.log("OK: dead presence toggles hidden");

await page.goto(`${WEB}/app/chat`, { waitUntil: "domcontentloaded", timeout: 30_000 });
await page.waitForSelector("[data-testid='chat-compose-open']", { timeout: 20_000 });
await page.getByTestId("chat-compose-open").click();
await page.getByTestId("chat-compose-kind-group").click();
await page.waitForSelector("[data-testid='chat-compose-member-PEERUID']", { timeout: 10_000 });
const rawId = await page.locator("[data-testid='chat-compose-members'] input[type='text']").count();
if (rawId !== 0) {
  console.error("FAIL: group compose still asks for raw member IDs");
  await browser.close();
  process.exit(1);
}
console.log("OK: group compose picks contacts");
await browser.close();
