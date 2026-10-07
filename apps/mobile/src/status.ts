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
    registered: "auth.registered",
    logged_in: "auth.loggedIn",
    saved: "common.saved",
    entitlement_ok: "reader.entitlementOk",
    handle_taken: "auth.handleTaken",
    invalid_credentials: "auth.badLogin",
  };
  const key = map[code];
  return key ? t(locale, key) : code;
}
