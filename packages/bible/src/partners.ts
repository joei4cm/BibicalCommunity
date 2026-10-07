/**
 * Partner Bible app adapters (恩道 Endao / 微读 WeRead).
 *
 * When SSO is enabled, returns OAuth authorize URLs. Pass `oauthClientId` /
 * `redirectUri` / `authorizeBase` from API env when partner credentials exist.
 * Without `oauthClientId`, `client_id=CONFIGURE` remains as a placeholder.
 * When SSO is off, returns deep-link handoff URLs with the verse ref.
 */

export type PartnerId = "endao" | "weread";

export type PartnerAuthOptions = {
  ref?: string;
  state?: string;
  ssoEnabled: boolean;
  /** Real partner OAuth client_id. When omitted, uses CONFIGURE placeholder. */
  oauthClientId?: string;
  /** Full OAuth redirect_uri. Defaults to app.logoshome.example callback path. */
  redirectUri?: string;
  /** Override authorize endpoint host/path (no query). */
  authorizeBase?: string;
};

const DEEP_LINKS: Record<PartnerId, string> = {
  endao: "https://www.edobible.com/?ref={ref}",
  weread: "https://bible.weixin.qq.com/?ref={ref}",
};

/** Default OAuth authorize endpoints — override via authorizeBase when needed. */
const OAUTH_AUTHORIZE: Record<PartnerId, string> = {
  endao: "https://oauth.edobible.com/authorize",
  weread: "https://open.weixin.qq.com/connect/oauth2/authorize",
};

export function buildPartnerDeepLink(partner: PartnerId, ref = ""): string {
  return DEEP_LINKS[partner].replace("{ref}", encodeURIComponent(ref));
}

function defaultRedirectUri(partner: PartnerId): string {
  return `https://app.logoshome.example/v1/partners/${partner}/callback`;
}

/**
 * Build a partner handoff or SSO authorize URL.
 * @param partner endao | weread
 * @param opts.ssoEnabled from ENDAO_SSO_ENABLED / WEREAD_SSO_ENABLED
 * @param opts.oauthClientId from ENDAO_OAUTH_CLIENT_ID / WEREAD_OAUTH_CLIENT_ID
 */
export function buildPartnerAuthUrl(
  partner: PartnerId,
  opts: PartnerAuthOptions,
): string {
  const ref = opts.ref ?? "";
  if (!opts.ssoEnabled) {
    return buildPartnerDeepLink(partner, ref);
  }

  const base = opts.authorizeBase?.trim() || OAUTH_AUTHORIZE[partner];
  const clientId = opts.oauthClientId?.trim() || "CONFIGURE";
  const redirectUri = opts.redirectUri?.trim() || defaultRedirectUri(partner);
  const parts = [
    `client_id=${encodeURIComponent(clientId)}`,
    `response_type=code`,
    `scope=${encodeURIComponent("bible.read")}`,
    `redirect_uri=${encodeURIComponent(redirectUri)}`,
  ];
  if (opts.state) parts.push(`state=${encodeURIComponent(opts.state)}`);
  if (ref) parts.push(`ref=${encodeURIComponent(ref)}`);
  return `${base}?${parts.join("&")}`;
}

export function isPartnerId(id: string): id is PartnerId {
  return id === "endao" || id === "weread";
}
