import { t, type LocaleCode } from "@logoshome/shared";

/** Map internal status codes to localized copy for UI banners. */
export function humanizeStatus(
  locale: LocaleCode,
  code: string | null | undefined,
): string | null {
  if (!code) return null;
  const map: Record<string, string> = {
    login_required: "auth.loginRequired",
    "auth.invalidCredentials": "auth.invalidCredentials",
    members_required: "chat.membersRequired",
    chat_degraded_no_peer_keys: "chat.degradedNoPeerKeys",
    api_base_required: "me.serverUrlHint",
    registered: "auth.registered",
    logged_in: "auth.loggedIn",
    saved: "common.saved",
    server_saved: "me.serverUrlSaved",
    entitlement_ok: "reader.entitlementOk",
    handle_taken: "auth.handleTaken",
    invalid_credentials: "auth.badLogin",
    keys_uploaded: "security.deviceKeysPresent",
    keys_failed: "security.deviceKeysMissing",
  };
  const key = map[code];
  return key ? t(locale, key) : code;
}
