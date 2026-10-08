/** Map internal status codes to localized copy for UI banners. */
export function humanizeStatus(
  t: (key: string) => string,
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
    chat_degraded_no_peer_keys: "chat.degradedNoPeerKeys",
    admin_wipe_issued: "security.adminWipe",
    "admin.forbidden": "admin.forbidden",
    "admin.bootstrapOk": "admin.bootstrapOk",
  };
  const key = map[code];
  return key ? t(key) : code;
}
