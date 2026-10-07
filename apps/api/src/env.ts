export type Env = {
  DB: D1Database;
  MEDIA: R2Bucket;
  CALL_ROOM: DurableObjectNamespace;
  APP_NAME: string;
  ENVIRONMENT: string;
  ENDAO_SSO_ENABLED: string;
  WEREAD_SSO_ENABLED: string;
  HANDLE_PEPPER?: string;
  KEK_MASTER?: string;
};
