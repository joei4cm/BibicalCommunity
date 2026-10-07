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

function oauthClientSecret(env: Env, partner: PartnerId): string | undefined {
  const raw =
    partner === "endao" ? env.ENDAO_OAUTH_CLIENT_SECRET : env.WEREAD_OAUTH_CLIENT_SECRET;
  const trimmed = raw?.trim();
  return trimmed || undefined;
}

function oauthTokenUrl(env: Env, partner: PartnerId): string {
  const override =
    partner === "endao" ? env.ENDAO_OAUTH_TOKEN_URL : env.WEREAD_OAUTH_TOKEN_URL;
  const trimmed = override?.trim();
  if (trimmed) return trimmed;
  return partner === "endao"
    ? "https://oauth.edobible.com/token"
    : "https://api.weixin.qq.com/sns/oauth2/access_token";
}

/**
 * Exchange authorization code for tokens when client_id + secret are configured.
 * Never returns tokens to the client JSON — only exchange status (server-side courier).
 */
export async function exchangePartnerCode(
  env: Env,
  partner: PartnerId,
  code: string,
  requestUrl: string,
): Promise<{ attempted: boolean; ok: boolean; status?: number; error?: string }> {
  const clientId = oauthClientId(env, partner);
  const clientSecret = oauthClientSecret(env, partner);
  if (!clientId || !clientSecret) {
    return { attempted: false, ok: false, error: "missing_oauth_credentials" };
  }
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri(env, partner, requestUrl),
  });
  try {
    const res = await fetch(oauthTokenUrl(env, partner), {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body,
    });
    if (!res.ok) {
      return { attempted: true, ok: false, status: res.status, error: "token_endpoint_error" };
    }
    // Discard body — do not echo access_token to clients.
    await res.arrayBuffer();
    return { attempted: true, ok: true, status: res.status };
  } catch {
    return { attempted: true, ok: false, error: "token_fetch_failed" };
  }
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

/**
 * Dev-only OAuth token endpoint stand-in.
 * Point ENDAO_OAUTH_TOKEN_URL / WEREAD_OAUTH_TOKEN_URL here for local exchange E2E.
 * Never enable in production (PARTNER_SSO_MOCK must be false; omit this path from live IdPs).
 */
partnerRoutes.post("/mock-token", async (c) => {
  if (!useMockIdp(c.env)) return c.json({ error: "mock_disabled" }, 404);
  const contentType = c.req.header("content-type") ?? "";
  let clientId = "";
  let clientSecret = "";
  let code = "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const form = await c.req.parseBody();
    clientId = String(form.client_id ?? "");
    clientSecret = String(form.client_secret ?? "");
    code = String(form.code ?? "");
  } else {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, string>;
    clientId = String(body.client_id ?? "");
    clientSecret = String(body.client_secret ?? "");
    code = String(body.code ?? "");
  }
  const known =
    (clientId === c.env.ENDAO_OAUTH_CLIENT_ID && clientSecret === c.env.ENDAO_OAUTH_CLIENT_SECRET) ||
    (clientId === c.env.WEREAD_OAUTH_CLIENT_ID && clientSecret === c.env.WEREAD_OAUTH_CLIENT_SECRET);
  if (!known || !code) {
    return c.json({ error: "invalid_client" }, 401);
  }
  return c.json({
    access_token: `mock_access_${randomToken(8)}`,
    token_type: "Bearer",
    expires_in: 3600,
    scope: "bible.read",
  });
});

/** OAuth callback — mock closed loop locally; production attempts token exchange when secrets set. */
partnerRoutes.get("/:id/callback", async (c) => {
  const id = c.req.param("id");
  if (!isPartnerId(id)) return c.json({ error: "unknown_partner" }, 404);
  const code = c.req.query("code");
  const state = c.req.query("state");
  const ref = c.req.query("ref");
  const mock = Boolean(code?.startsWith("mock_"));

  let tokenExchange: { attempted: boolean; ok: boolean; status?: number; error?: string } = {
    attempted: false,
    ok: false,
  };
  if (!mock && code) {
    tokenExchange = await exchangePartnerCode(c.env, id, code, c.req.url);
  }

  return c.json({
    ok: true,
    partner: id,
    code: code ?? null,
    state: state ?? null,
    ref: ref ?? null,
    mock,
    tokenExchange,
    note: mock
      ? "Mock SSO callback succeeded. Set PARTNER_SSO_MOCK=false and real client_id/secret for production."
      : tokenExchange.attempted
        ? tokenExchange.ok
          ? "Partner token exchange succeeded (tokens not returned to client)."
          : `Partner token exchange failed: ${tokenExchange.error ?? "unknown"}`
        : "Received partner callback. Configure OAuth client_id + client_secret to enable exchange.",
  });
});
