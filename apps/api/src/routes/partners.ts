import { Hono } from "hono";
import {
  buildPartnerAuthUrl,
  isPartnerId,
  type PartnerId,
} from "@logoshome/bible";
import type { Env } from "../env";
import { randomToken } from "../services/crypto";

/**
 * Partner SSO / deep-link adapters for 恩道 (Endao) and 微读 (WeRead).
 * Feature flags: ENDAO_SSO_ENABLED / WEREAD_SSO_ENABLED.
 *
 * When a flag is false (default): UI and this route return deep-link handoff
 * URLs only (verse ref). Do not start OAuth; clients must deep-link only.
 * When SSO is enabled without real partner credentials, `/mock-authorize`
 * provides a configurable local OAuth stand-in so the callback loop works in
 * development. Production: set PARTNER_SSO_MOCK=false plus
 * ENDAO_OAUTH_CLIENT_ID / WEREAD_OAUTH_CLIENT_ID and PARTNER_OAUTH_REDIRECT_BASE.
 */
export const partnerRoutes = new Hono<{ Bindings: Env }>();

function ssoEnabled(env: Env, partner: PartnerId): boolean {
  if (partner === "endao") return env.ENDAO_SSO_ENABLED === "true";
  return env.WEREAD_SSO_ENABLED === "true";
}

function useMockIdp(env: Env): boolean {
  return (env.PARTNER_SSO_MOCK ?? "true") === "true";
}

function oauthClientId(env: Env, partner: PartnerId): string | undefined {
  const raw =
    partner === "endao" ? env.ENDAO_OAUTH_CLIENT_ID : env.WEREAD_OAUTH_CLIENT_ID;
  const trimmed = raw?.trim();
  return trimmed || undefined;
}

function authorizeBase(env: Env, partner: PartnerId): string | undefined {
  const raw =
    partner === "endao"
      ? env.ENDAO_OAUTH_AUTHORIZE_BASE
      : env.WEREAD_OAUTH_AUTHORIZE_BASE;
  const trimmed = raw?.trim();
  return trimmed || undefined;
}

function redirectUri(env: Env, partner: PartnerId, requestUrl: string): string {
  const base = env.PARTNER_OAUTH_REDIRECT_BASE?.trim().replace(/\/$/, "");
  if (base) return `${base}/v1/partners/${partner}/callback`;
  const origin = new URL(requestUrl).origin;
  return `${origin}/v1/partners/${partner}/callback`;
}

partnerRoutes.get("/status", (c) => {
  return c.json({
    endao: { ssoEnabled: c.env.ENDAO_SSO_ENABLED === "true", id: "endao" },
    weread: { ssoEnabled: c.env.WEREAD_SSO_ENABLED === "true", id: "weread" },
    mockIdp: useMockIdp(c.env),
  });
});

partnerRoutes.get("/:id/start", (c) => {
  const id = c.req.param("id");
  if (!isPartnerId(id)) return c.json({ error: "unknown_partner" }, 404);

  const ref = c.req.query("ref") ?? "";
  const state = c.req.query("state") ?? randomToken(8);
  const enabled = ssoEnabled(c.env, id);

  let url: string;
  if (enabled && useMockIdp(c.env)) {
    const origin = new URL(c.req.url).origin;
    const q = new URLSearchParams({
      partner: id,
      state,
      ref,
      redirect_uri: `${origin}/v1/partners/${id}/callback`,
    });
    url = `${origin}/v1/partners/mock-authorize?${q.toString()}`;
  } else {
    url = buildPartnerAuthUrl(id, {
      ref,
      state,
      ssoEnabled: enabled,
      oauthClientId: oauthClientId(c.env, id),
      redirectUri: enabled ? redirectUri(c.env, id, c.req.url) : undefined,
      authorizeBase: authorizeBase(c.env, id),
    });
  }

  if (c.req.query("redirect") === "1") {
    return c.redirect(url, 302);
  }
  return c.json({
    url,
    partner: id,
    ssoEnabled: enabled,
    state,
    mockIdp: useMockIdp(c.env) && enabled,
  });
});

/** Dev-only mock IdP consent page → redirects to callback with code. */
partnerRoutes.get("/mock-authorize", (c) => {
  if (!useMockIdp(c.env)) return c.json({ error: "mock_disabled" }, 404);
  const partner = c.req.query("partner") ?? "endao";
  const state = c.req.query("state") ?? "";
  const ref = c.req.query("ref") ?? "";
  const redirectUriParam =
    c.req.query("redirect_uri") ?? `/v1/partners/${partner}/callback`;
  const code = `mock_${randomToken(6)}`;
  const target = new URL(redirectUriParam, c.req.url);
  target.searchParams.set("code", code);
  target.searchParams.set("state", state);
  if (ref) target.searchParams.set("ref", ref);
  return c.redirect(target.toString(), 302);
});

/** OAuth callback — mock exchanges code; production needs real token exchange. */
partnerRoutes.get("/:id/callback", (c) => {
  const id = c.req.param("id");
  if (!isPartnerId(id)) return c.json({ error: "unknown_partner" }, 404);
  const code = c.req.query("code");
  const state = c.req.query("state");
  const ref = c.req.query("ref");
  const mock = Boolean(code?.startsWith("mock_"));
  return c.json({
    ok: true,
    partner: id,
    code: code ?? null,
    state: state ?? null,
    ref: ref ?? null,
    mock,
    note: mock
      ? "Mock SSO callback succeeded. Set PARTNER_SSO_MOCK=false and real client_id for production."
      : "configure client_id and token exchange with partner",
  });
});
