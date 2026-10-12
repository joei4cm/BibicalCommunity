/**
 * UI smoke: chat composer grows with multi-line input.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const WEB = process.env.WEB_BASE ?? "http://127.0.0.1:5176";
const artifacts = "/opt/cursor/artifacts";
mkdirSync(`${artifacts}/screenshots`, { recursive: true });
const stamp = Date.now().toString(36);
const selfId = `usr_self_${stamp}`;
const peerId = `usr_peer_${stamp}`;
const deviceId = `dev_self_${stamp}`;
const convoId = `convo_${stamp}`;
const now = Date.now();

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.addInitScript(
  ({ token, deviceId: did }) => {
    localStorage.setItem("lh.token", token);
    localStorage.setItem("lh.deviceId", did);
    localStorage.setItem("lh.locale", "zh-CN");
  },
  { token: `tok_${stamp}`, deviceId },
);

await page.route("**/v1/**", async (route) => {
  const path = new URL(route.request().url()).pathname;
  const method = route.request().method();
  if (path.endsWith("/v1/me")) {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: selfId, uid: "SELFUID", nickname: "我" }),
    });
  }
  if (path.endsWith("/v1/friends")) {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        friends: [{ friendshipId: "f1", user: { id: peerId, uid: "PEERUID", nickname: "对方" } }],
      }),
    });
  }
  if (path.includes("/v1/friends/") || path.endsWith("/v1/home/churches") || path.includes("/v1/comms") || path.endsWith("/v1/chat/favorites")) {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        incoming: [],
        outgoing: [],
        contacts: [],
        churches: [],
        favorites: [],
        chatUnread: 0,
        inboxUnread: 0,
        friendRequestsPending: 0,
        calendarPending: 0,
      }),
    });
  }
  if (path.endsWith("/v1/chat/conversations") && method === "GET") {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        conversations: [
          {
            id: convoId,
            kind: "dm",
            title: null,
            disappearingTtlSec: null,
            createdBy: selfId,
            createdAt: now,
            memberIds: [selfId, peerId],
            peerUserIds: [peerId],
            unreadCount: 0,
            peerLastReadAt: null,
            membership: { id: "cm1", role: "owner", archived: false, lastReadAt: now },
          },
        ],
      }),
    });
  }
  if (path.includes("/messages") && method === "GET") {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ messages: [], peerLastReadAt: null, lastReadAt: now }),
    });
  }
  return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
});

await page.goto(`${WEB}/app/chat?conversation=${encodeURIComponent(convoId)}`, {
  waitUntil: "domcontentloaded",
  timeout: 60_000,
});
await page.waitForSelector("[data-testid='chat-composer']", { timeout: 20_000 });
const composer = page.getByTestId("chat-composer");
const h1 = await composer.evaluate((el) => el.getBoundingClientRect().height);
await composer.fill("第一行\n第二行\n第三行\n第四行");
await page.waitForTimeout(200);
const h2 = await composer.evaluate((el) => el.getBoundingClientRect().height);
console.log({ h1, h2 });
await page.screenshot({
  path: `${artifacts}/screenshots/chat-composer-grow.png`,
  fullPage: true,
});
if (!(h2 > h1 + 12)) {
  console.error("FAIL: composer did not grow for multi-line input");
  await browser.close();
  process.exit(1);
}
console.log("OK: composer auto-grows");
await browser.close();
