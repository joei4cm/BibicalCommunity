export type Env = {
  DB: D1Database;
  /**
   * R2 media/corpus bucket. Optional only for temporary preview deploys
   * (`wrangler.temporary.toml`) where preview accounts cannot create R2.
   * Production and local wrangler.toml always bind MEDIA.
   */
  MEDIA?: R2Bucket;
  CALL_ROOM: DurableObjectNamespace;
  APP_NAME: string;
  ENVIRONMENT: string;
  ENDAO_SSO_ENABLED: string;
  WEREAD_SSO_ENABLED: string;
  /** Ephemeral TURN HMAC secret (coturn REST style). Default: dev-turn-secret */
  TURN_SECRET?: string;
  /** JSON array of TURN/STUN URIs. Include turn:/turns: for real relay. */
  TURN_URIS?: string;
  /** Cloudflare Calls TURN key id (optional; enables real turn: relays). */
  /** When "true", allow public Open Relay TURN if Cloudflare/coturn unavailable. */
  ALLOW_OPEN_RELAY_TURN?: string;
  TURN_CF_KEY_ID?: string;
  /** Cloudflare API token that can mint Calls TURN credentials. */
  TURN_CF_API_TOKEN?: string;
  HANDLE_PEPPER?: string;
  KEK_MASTER?: string;
  /** When true (default), SSO start uses local mock IdP instead of partner authorize URL. */
  PARTNER_SSO_MOCK?: string;
  /** 恩道 OAuth client_id — used when SSO on and PARTNER_SSO_MOCK=false. */
  ENDAO_OAUTH_CLIENT_ID?: string;
  /** 微读 OAuth client_id — used when SSO on and PARTNER_SSO_MOCK=false. */
  WEREAD_OAUTH_CLIENT_ID?: string;
  /**
   * Public API origin for OAuth redirect_uri
   * (`${base}/v1/partners/{id}/callback`). Required for real IdP handoff.
   */
  PARTNER_OAUTH_REDIRECT_BASE?: string;
  /** Optional override for 恩道 authorize URL (default oauth.edobible.com). */
  ENDAO_OAUTH_AUTHORIZE_BASE?: string;
  /** Optional override for 微读 authorize URL. */
  WEREAD_OAUTH_AUTHORIZE_BASE?: string;
  /** Partner OAuth client secrets (wrangler secret put) for token exchange. */
  ENDAO_OAUTH_CLIENT_SECRET?: string;
  WEREAD_OAUTH_CLIENT_SECRET?: string;
  /** Optional token endpoint overrides (default partner token URLs). */
  ENDAO_OAUTH_TOKEN_URL?: string;
  WEREAD_OAUTH_TOKEN_URL?: string;
  /** Local/dev secret to promote a caller to platform_admin via /v1/admin/platform/bootstrap. */
  PLATFORM_ADMIN_BOOTSTRAP_SECRET?: string;
  /**
   * Comma-separated browser origins allowed for CORS (e.g. Pages URL).
   * When unset, reflect request Origin (dev). Set in production beta.
   */
  CORS_ORIGINS?: string;
};
