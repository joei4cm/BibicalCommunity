import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPartnerAuthUrl, buildPartnerDeepLink } from "./partners.js";

test("SSO off → endao deep link only (no oauth host / client_id)", () => {
  const url = buildPartnerAuthUrl("endao", {
    ref: "John.1",
    ssoEnabled: false,
    oauthClientId: "should-be-ignored",
  });
  assert.equal(url, buildPartnerDeepLink("endao", "John.1"));
  assert.match(url, /^https:\/\/www\.edobible\.com\/\?ref=/);
  assert.doesNotMatch(url, /oauth\.edobible\.com|client_id=/);
});

test("SSO off → weread deep link only", () => {
  const url = buildPartnerAuthUrl("weread", {
    ref: "John.1",
    ssoEnabled: false,
  });
  assert.equal(url, buildPartnerDeepLink("weread", "John.1"));
  assert.match(url, /^https:\/\/bible\.weixin\.qq\.com\/\?ref=/);
  assert.doesNotMatch(url, /open\.weixin\.qq\.com|client_id=/);
});

test("SSO on without client_id → CONFIGURE placeholder on default oauth host", () => {
  const url = buildPartnerAuthUrl("endao", {
    ref: "John.1",
    state: "abc",
    ssoEnabled: true,
  });
  assert.match(url, /^https:\/\/oauth\.edobible\.com\/authorize\?/);
  assert.match(url, /client_id=CONFIGURE/);
  assert.match(url, /state=abc/);
  assert.match(url, /ref=John\.1/);
});

test("SSO on + client_id → real client_id, no CONFIGURE", () => {
  const url = buildPartnerAuthUrl("endao", {
    ref: "John.1",
    state: "st1",
    ssoEnabled: true,
    oauthClientId: "endao-prod-client",
    redirectUri: "https://api.example.com/v1/partners/endao/callback",
  });
  assert.match(url, /^https:\/\/oauth\.edobible\.com\/authorize\?/);
  assert.match(url, /client_id=endao-prod-client/);
  assert.doesNotMatch(url, /CONFIGURE/);
  assert.match(
    url,
    /redirect_uri=https%3A%2F%2Fapi\.example\.com%2Fv1%2Fpartners%2Fendao%2Fcallback/,
  );
});

test("SSO on + weread client_id + authorizeBase override", () => {
  const url = buildPartnerAuthUrl("weread", {
    ref: "John.1",
    ssoEnabled: true,
    oauthClientId: "wx-app-id",
    authorizeBase: "https://oauth.partner.test/authorize",
    redirectUri: "https://api.example.com/v1/partners/weread/callback",
  });
  assert.match(url, /^https:\/\/oauth\.partner\.test\/authorize\?/);
  assert.match(url, /client_id=wx-app-id/);
  assert.doesNotMatch(url, /CONFIGURE/);
});

test("empty oauthClientId falls back to CONFIGURE", () => {
  const url = buildPartnerAuthUrl("endao", {
    ssoEnabled: true,
    oauthClientId: "  ",
  });
  assert.match(url, /client_id=CONFIGURE/);
});
