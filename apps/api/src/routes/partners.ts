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
 */
export const partnerRoutes = new Hono<{ Bindings: Env }>();

function ssoEnabled(env: Env, partner: PartnerId): boolean {
  if (partner === "endao") return env.ENDAO_SSO_ENABLED === "true";
  return env.WEREAD_SSO_ENABLED === "true";
}

partnerRoutes.get("/status", (c) => {
  return c.json({
    endao: { ssoEnabled: c.env.ENDAO_SSO_ENABLED === "true", id: "endao" },
    weread: { ssoEnabled: c.env.WEREAD_SSO_ENABLED === "true", id: "weread" },
  });
});

partnerRoutes.get("/:id/start", (c) => {
  const id = c.req.param("id");
  if (!isPartnerId(id)) return c.json({ error: "unknown_partner" }, 404);

  const ref = c.req.query("ref") ?? "";
  const state = c.req.query("state") ?? randomToken(8);
  const enabled = ssoEnabled(c.env, id);
  const url = buildPartnerAuthUrl(id, {
    ref,
    state,
    ssoEnabled: enabled,
  });

  if (c.req.query("redirect") === "1") {
    return c.redirect(url, 302);
  }
  return c.json({ url, partner: id, ssoEnabled: enabled, state });
});

/** OAuth callback stub — configure real client_id / token exchange later. */
partnerRoutes.get("/:id/callback", (c) => {
  const id = c.req.param("id");
  if (!isPartnerId(id)) return c.json({ error: "unknown_partner" }, 404);
  return c.json({
    ok: true,
    partner: id,
    note: "configure client_id",
    code: c.req.query("code") ?? null,
    state: c.req.query("state") ?? null,
  });
});
