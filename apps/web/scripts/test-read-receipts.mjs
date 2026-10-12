/**
 * UI smoke with network mocks: outgoing bubbles show ✓ / ✓✓ read receipts.
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
const msgSentId = `msg_sent_${stamp}`;
const msgReadId = `msg_read_${stamp}`;
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
  const url = new URL(route.request().url());
  const path = url.pathname;
  const method = route.request().method();

  if (path.endsWith("/v1/me") && method === "GET") {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: selfId,
        uid: "SELFUID",
        nickname: "我",
        handle: `self${stamp}`,
      }),
    });
  }
  if (path.endsWith("/v1/friends") && method === "GET") {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        friends: [{ friendshipId: "f1", user: { id: peerId, uid: "PEERUID", nickname: "对方" } }],
      }),
    });
  }
  if (path.endsWith("/v1/friends/requests") && method === "GET") {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ incoming: [], outgoing: [] }),
    });
  }
  if (path.endsWith("/v1/friends/directory")) {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ contacts: [] }),
    });
  }
  if (path.endsWith("/v1/home/churches")) {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ churches: [], platformAdmin: false }),
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
            createdAt: now - 60_000,
            memberIds: [selfId, peerId],
            peerUserIds: [peerId],
            unreadCount: 0,
            peerLastReadAt: now - 5_000,
            membership: { id: "cm1", role: "owner", archived: false, lastReadAt: now },
          },
        ],
      }),
    });
  }
  if (path.includes(`/v1/chat/conversations/${convoId}/messages`) && method === "GET") {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        lastReadAt: now,
        peerLastReadAt: now - 5_000,
        messages: [
          {
            id: msgReadId,
            senderDeviceId: deviceId,
            senderUserId: selfId,
            ratchetHeader: "plain",
            ciphertext: "btoa:" + Buffer.from("已读这条").toString("base64"),
            contentType: "msg",
            createdAt: now - 20_000,
            expiresAt: null,
          },
          {
            id: msgSentId,
            senderDeviceId: deviceId,
            senderUserId: selfId,
            ratchetHeader: "plain",
            ciphertext: "btoa:" + Buffer.from("未读这条").toString("base64"),
            contentType: "msg",
            createdAt: now,
            expiresAt: null,
          },
        ],
      }),
    });
  }
  if (path.endsWith("/v1/chat/favorites")) {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ favorites: [] }),
    });
  }
  if (path.endsWith("/v1/calls/turn-credentials") && method === "POST") {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        username: "openrelayproject",
        credential: "openrelayproject",
        ttl: 300,
        hasRelay: true,
        provider: "openrelay-fallback",
        uris: [
          "stun:stun.l.google.com:19302",
          "turn:openrelay.metered.ca:80",
        ],
        iceServers: [
          { urls: ["stun:stun.l.google.com:19302"] },
          {
            urls: ["turn:openrelay.metered.ca:80"],
            username: "openrelayproject",
            credential: "openrelayproject",
          },
        ],
        note: "Open Relay fallback",
      }),
    });
  }
  if (path.endsWith("/v1/comms/badges")) {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ chat: 0, inbox: 0 }),
    });
  }
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({}),
  });
});

// Decrypt path: seed plaintext cache so bubbles render without real crypto.
await page.addInitScript(
  ({ msgReadId: a, msgSentId: b }) => {
    localStorage.setItem(`lh.msg.${a}`, "已读这条");
    localStorage.setItem(`lh.msg.${b}`, "未读这条");
  },
  { msgReadId, msgSentId },
);

await page.goto(`${WEB}/app/chat?conversation=${encodeURIComponent(convoId)}`, {
  waitUntil: "networkidle",
  timeout: 60_000,
});
await page.waitForSelector("[data-testid='home-chat-panel']", { timeout: 30_000 });
await page.waitForSelector("[data-testid='chat-messages']", { timeout: 30_000 });

const readCount = await page.getByTestId("chat-receipt-read").count();
const sentCount = await page.getByTestId("chat-receipt-sent").count();
console.log(`receipts: read=${readCount} sent=${sentCount}`);

await page.screenshot({
  path: `${artifacts}/screenshots/chat-read-receipts.png`,
  fullPage: true,
});

if (readCount < 1 || sentCount < 1) {
  console.error("FAIL: expected both read and sent receipt ticks");
  await browser.close();
  process.exit(1);
}
console.log("OK: read receipts visible");
await browser.close();
