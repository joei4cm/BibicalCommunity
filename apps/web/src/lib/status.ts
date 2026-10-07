/** Map internal status codes to localized copy for UI banners. */
export function humanizeStatus(
  t: (key: string) => string,
  code: string | null | undefined,
): string | null {
  if (!code) return null;
  const map: Record<string, string> = {
    login_required: "auth.loginRequired",
    members_required: "chat.membersRequired",
    registered: "auth.registered",
    logged_in: "auth.loggedIn",
    saved: "common.saved",
    entitlement_ok: "reader.entitlementOk",
  };
  const key = map[code];
  return key ? t(key) : code;
}
