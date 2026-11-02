/**
 * Send should clear the composer immediately and not wait on a full messages reload.
 * With keys gated, draft clears while encrypt is still in flight.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const WEB = process.env.WEB_BASE ?? "http://127.0.0.1:5176";
const artifacts = "/opt/cursor/artifacts";
mkdirSync(artifacts, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

const convoId = "convo_send_fast";
const selfId = "usr_self";
const peerId = "usr_peer";
let keysResolve;
const keysGate = new Promise((r) => {
  keysResolve = r;
});
let keysHit = false;
let messagesGetAfterSend = 0;
let posted = false;

await page.route("**/v1/**", async (route) => {
  const url = new URL(route.request().url());
  const path = url.pathname;
  const method = route.request().method();

  if (path.endsWith("/v1/me")) {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: selfId, uid: "SELF", nickname: "Self" }),
    });
  }
  if (path.endsWith("/v1/friends")) {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        friends: [{ friendshipId: "f1", user: { id: peerId, uid: "PEER", nickname: "Peer" } }],
        incoming: [],
        outgoing: [],
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
            createdAt: Date.now() - 60_000,
            peerUserIds: [peerId],
            peers: [{ userId: peerId, uid: "PEER", nickname: "Peer" }],
            unreadCount: 0,
            lastMessageAt: Date.now() - 60_000,
            peerLastReadAt: null,
            membership: { id: "mem1", role: "member", archived: false, lastReadAt: Date.now() },
          },
        ],
      }),
    });
  }
  if (path.includes(`/v1/chat/conversations/${convoId}/messages`) && method === "GET") {
    if (keysHit) messagesGetAfterSend += 1;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ messages: [], peerLastReadAt: null }),
    });
  }
  if (path.includes(`/v1/chat/conversations/${convoId}/messages`) && method === "POST") {
    posted = true;
    return route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ id: "msg_should_not_post_without_keys" }),
    });
  }
  if (path.includes("/v1/keys/")) {
    keysHit = true;
    await keysGate;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ devices: [] }),
    });
  }
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({}),
  });
});

await page.addInitScript(() => {
  localStorage.setItem("lh.token", "demo");
  localStorage.setItem("lh.deviceId", "dev_self");
});

await page.goto(`${WEB}/app/chat?conversation=${encodeURIComponent(convoId)}`, {
  waitUntil: "domcontentloaded",
});
await page.waitForSelector('[data-testid="chat-composer"]', { timeout: 20000 });
await page.waitForSelector('[data-testid="chat-messages"]', { timeout: 20000 });
const composer = page.locator('[data-testid="chat-composer"]');
await composer.click();
await composer.fill("hello optimistic");
await composer.dispatchEvent("input");
await composer.press("Enter");

// Composer clears immediately — user sees send start without waiting on keys/POST.
await page.waitForFunction(() => {
  const el = document.querySelector('[data-testid="chat-composer"]');
  return el && el.value === "";
}, { timeout: 5000 });
await page.screenshot({ path: `${artifacts}/chat-send-draft-cleared.png`, fullPage: false });

keysResolve();
await page.waitForFunction(() => {
  const el = document.querySelector('[data-testid="chat-composer"]');
  return el && el.value === "hello optimistic";
}, { timeout: 10000 });

if (posted) throw new Error("POST must not run when encrypt fails closed");
// Full reload after send used to block UX; encrypt failure must not trigger a blocking reload either.
if (messagesGetAfterSend > 2) {
  throw new Error(`unexpected messages refetch storm: ${messagesGetAfterSend}`);
}

await browser.close();
console.log("ok");
