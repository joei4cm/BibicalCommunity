/**
 * UI smoke with network mocks: friend card hides 添加好友 and shows equal-sized 发消息.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const WEB = process.env.WEB_BASE ?? "http://127.0.0.1:5174";
const artifacts = "/opt/cursor/artifacts";
mkdirSync(artifacts, { recursive: true });
const stamp = Date.now().toString(36);
const selfId = `usr_self_${stamp}`;
const friendId = `usr_friend_${stamp}`;
const strangerId = `usr_stranger_${stamp}`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.route("**/v1/**", async (route) => {
  const url = new URL(route.request().url());
  const path = url.pathname;
  const method = route.request().method();

  if (path.endsWith("/v1/auth/register") || path.endsWith("/v1/auth/login")) {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ token: `tok_${stamp}`, user: { id: selfId } }),
    });
  }
  if (path.endsWith("/v1/me") && method === "GET") {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: selfId,
        uid: "SELFUID",
        nickname: "SelfNick",
        handle: `self${stamp}`,
      }),
    });
  }
  if (path.endsWith("/v1/friends") && method === "GET") {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        friends: [{ friendshipId: "f1", user: { id: friendId, uid: "FRUID", nickname: "好友甲" } }],
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
      body: JSON.stringify({
        churches: [
          {
            id: "ch1",
            name: "测试家",
            slug: "test-home",
            role: "admin",
            roles: ["admin"],
            verified: true,
            securityMode: "standard",
            groups: ["g1"],
            capabilities: { manageChurch: true, createGroup: true },
          },
        ],
        platformAdmin: false,
      }),
    });
  }
  if (path.includes("/v1/home/") && path.endsWith("/org-tree")) {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        church: { id: "ch1", name: "测试家", slug: "test-home", securityMode: "standard" },
        viewer: {
          roles: ["admin"],
          ledGroupIds: ["g1"],
          capabilities: { manageChurch: true },
        },
        leaders: [],
        tree: [
          {
            id: "g1",
            name: "一组",
            kind: "small_group",
            parentId: null,
            sortOrder: 0,
            members: [
              {
                userId: friendId,
                uid: "FRUID",
                nickname: "好友甲",
                signature: "已是好友",
                groupNames: ["一组"],
                roles: ["member"],
                groupRoles: [],
                verified: true,
              },
              {
                userId: strangerId,
                uid: "STUID",
                nickname: "路人乙",
                signature: null,
                groupNames: ["一组"],
                roles: ["member"],
                groupRoles: [],
                verified: true,
              },
            ],
            children: [],
          },
        ],
      }),
    });
  }
  if (path.includes("/coworker-assembly")) {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        churchId: "ch1",
        includeChurchCoworkers: true,
        conversationTitle: "x",
        members: [],
        viewer: {
          isMember: false,
          canNotify: false,
          canOpenChat: false,
          roles: [],
          roleLayer: "member",
        },
      }),
    });
  }
  if (path.includes("/members")) {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ members: [] }),
    });
  }
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({}),
  });
});

// Seed a fake session so AuthGate lets us in without real login form delays.
await page.addInitScript((tok) => {
  localStorage.setItem("lh.token", tok);
  localStorage.setItem("lh.session", JSON.stringify({ token: tok }));
}, `tok_${stamp}`);

await page.goto(`${WEB}/app/home`, { waitUntil: "networkidle" });
await page.waitForSelector('[data-testid="home-page"], .app-folio, .org-tree-toggle', {
  timeout: 15000,
});
await page.waitForTimeout(800);

// Expand group
const toggle = page.locator("button.org-tree-toggle").first();
if (await toggle.count()) await toggle.click();
await page.waitForTimeout(300);

// Open friend card
await page.locator("button.org-person-btn", { hasText: "好友甲" }).first().click({ timeout: 10000 });
await page.waitForSelector('[data-testid="home-person-sheet"]', { timeout: 8000 });
await page.waitForTimeout(400);

const friendAdd = await page.locator('[data-testid="home-add-friend"]').count();
const friendChat = await page.locator('[data-testid="home-open-chat"]').count();
const friendShot = `${artifacts}/friend-card-already-friend.png`;
await page.screenshot({ path: friendShot, fullPage: true });

const chatBox = await page.locator('[data-testid="home-open-chat"]').boundingBox();

// Close and open stranger
await page.locator('[data-testid="home-person-sheet"]').click({ position: { x: 8, y: 8 } });
await page.waitForTimeout(300);
await page.locator("button.org-person-btn", { hasText: "路人乙" }).first().click({ timeout: 10000 });
await page.waitForSelector('[data-testid="home-add-friend"]', { timeout: 8000 });
const strangerAdd = await page.locator('[data-testid="home-add-friend"]').count();
const strangerChat = await page.locator('[data-testid="home-open-chat"]').count();
const addBox = await page.locator('[data-testid="home-add-friend"]').boundingBox();
const strangerShot = `${artifacts}/friend-card-stranger.png`;
await page.screenshot({ path: strangerShot, fullPage: true });

const sizesClose =
  chatBox &&
  addBox &&
  Math.abs(chatBox.width - addBox.width) < 4 &&
  Math.abs(chatBox.height - addBox.height) < 4;

const ok = friendAdd === 0 && friendChat === 1 && strangerAdd === 1 && strangerChat === 0 && sizesClose;
console.log(
  JSON.stringify(
    {
      ok,
      friendAdd,
      friendChat,
      strangerAdd,
      strangerChat,
      chatBox,
      addBox,
      sizesClose,
      friendShot,
      strangerShot,
    },
    null,
    2,
  ),
);
await browser.close();
process.exit(ok ? 0 : 1);
