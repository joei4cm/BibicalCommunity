import { test } from "node:test";
import assert from "node:assert/strict";
import { exchangePartnerCode } from "./partners.js";
import type { Env } from "../env.js";

function baseEnv(over: Partial<Env> = {}): Env {
  return {
    DB: {} as Env["DB"],
    MEDIA: {} as Env["MEDIA"],
    CALL_ROOM: {} as Env["CALL_ROOM"],
    APP_NAME: "LogosHome",
    ENVIRONMENT: "test",
    ENDAO_SSO_ENABLED: "true",
    WEREAD_SSO_ENABLED: "true",
    ...over,
  };
}

test("exchangePartnerCode does not attempt without client secret", async () => {
  const res = await exchangePartnerCode(
    baseEnv({ ENDAO_OAUTH_CLIENT_ID: "client-a" }),
    "endao",
    "auth_code",
    "https://api.example.com/v1/partners/endao/callback",
  );
  assert.equal(res.attempted, false);
  assert.equal(res.ok, false);
  assert.equal(res.error, "missing_oauth_credentials");
});

test("exchangePartnerCode POSTs token URL when credentials present", async () => {
  const calls: { url: string; body: string }[] = [];
  const prev = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      body: String(init?.body ?? ""),
    });
    return new Response(JSON.stringify({ access_token: "secret-should-not-leak" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const res = await exchangePartnerCode(
      baseEnv({
        ENDAO_OAUTH_CLIENT_ID: "client-a",
        ENDAO_OAUTH_CLIENT_SECRET: "sec-a",
        ENDAO_OAUTH_TOKEN_URL: "https://oauth.test/token",
        PARTNER_OAUTH_REDIRECT_BASE: "https://api.example.com",
      }),
      "endao",
      "auth_code",
      "https://api.example.com/v1/partners/endao/callback",
    );
    assert.equal(res.attempted, true);
    assert.equal(res.ok, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.url, "https://oauth.test/token");
    assert.match(calls[0]?.body ?? "", /grant_type=authorization_code/);
    assert.match(calls[0]?.body ?? "", /client_id=client-a/);
    assert.match(calls[0]?.body ?? "", /client_secret=sec-a/);
    assert.ok(!JSON.stringify(res).includes("secret-should-not-leak"));
  } finally {
    globalThis.fetch = prev;
  }
});
