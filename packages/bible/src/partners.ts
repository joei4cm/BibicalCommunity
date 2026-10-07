/**
 * Partner Bible app adapters (恩道 Endao / 微读 WeRead).
 *
 * When SSO is enabled, returns OAuth authorize URL placeholders — replace
 * `client_id` / redirect URIs once partner credentials are provisioned.
 * When SSO is off, returns deep-link handoff URLs with the verse ref.
 */

export type PartnerId = "endao" | "weread";

export type PartnerAuthOptions = {
  ref?: string;
  state?: string;
  ssoEnabled: boolean;
};

const DEEP_LINKS: Record<PartnerId, string> = {
  endao: "https://www.edobible.com/?ref={ref}",
  weread: "https://bible.weixin.qq.com/?ref={ref}",
};

/** Placeholder OAuth authorize endpoints — configure real client_id in API/env. */
const OAUTH_AUTHORIZE: Record<PartnerId, string> = {
  endao: "https://oauth.edobible.com/authorize",
  weread: "https://open.weixin.qq.com/connect/oauth2/authorize",
};

export function buildPartnerDeepLink(partner: PartnerId, ref = ""): string {
  return DEEP_LINKS[partner].replace("{ref}", encodeURIComponent(ref));
}

/**
 * Build a partner handoff or SSO authorize URL.
 * @param partner endao | weread
 * @param opts.ssoEnabled from ENDAO_SSO_ENABLED / WEREAD_SSO_ENABLED
 */
export function buildPartnerAuthUrl(
  partner: PartnerId,
  opts: PartnerAuthOptions,
): string {
  const ref = opts.ref ?? "";
  if (!opts.ssoEnabled) {
    return buildPartnerDeepLink(partner, ref);
  }

  const base = OAUTH_AUTHORIZE[partner];
  const parts = [
    `client_id=${encodeURIComponent("CONFIGURE")}`,
    `response_type=code`,
    `scope=${encodeURIComponent("bible.read")}`,
    `redirect_uri=${encodeURIComponent(`https://app.logoshome.example/v1/partners/${partner}/callback`)}`,
  ];
  if (opts.state) parts.push(`state=${encodeURIComponent(opts.state)}`);
  if (ref) parts.push(`ref=${encodeURIComponent(ref)}`);
  return `${base}?${parts.join("&")}`;
}

export function isPartnerId(id: string): id is PartnerId {
  return id === "endao" || id === "weread";
}
