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
};
