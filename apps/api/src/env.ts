export type Env = {
  DB: D1Database;
  MEDIA: R2Bucket;
  CALL_ROOM: DurableObjectNamespace;
  APP_NAME: string;
  ENVIRONMENT: string;
  ENDAO_SSO_ENABLED: string;
  WEREAD_SSO_ENABLED: string;
  /** Ephemeral TURN HMAC secret (coturn REST style). Default: dev-turn-secret */
  TURN_SECRET?: string;
  /** JSON array of TURN/STUN URIs. Default: ["stun:stun.cloudflare.com:3478"] */
  TURN_URIS?: string;
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
};
