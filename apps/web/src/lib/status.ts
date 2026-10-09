/** Map internal status codes to localized copy for UI banners. */
export function humanizeStatus(
  t: (key: string, opts?: Record<string, unknown>) => string,
  code: string | null | undefined,
): string | null {
  if (!code) return null;

  if (code.startsWith("created:")) return t("plans.createdOk");
  if (code.startsWith("subscribed:")) return t("plans.subscribedOk");
  if (code.startsWith("progress:")) return t("plans.progressOk");

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
    "admin.corpusSeedOk": "admin.corpusSeedOk",
    title_required: "plans.title",
    days_required: "plans.daysHint",
    invalid_days: "plans.daysHint",
    invalid_json: "plans.editDays",
    already_member: "home.selected",
    joined_church: "home.joinChurch",
    hostile_enabled: "home.securityMode.hostileBadge",
    standard_enabled: "home.securityMode.standardBadge",
    media_uploaded: "home.attachment",
    media_upload_failed: "home.attachment",
    group_required: "home.selectGroup",
    member_verified: "home.verify",
    group_created: "home.createGroup",
    keys_uploaded: "security.deviceKeysPresent",
    keys_failed: "security.deviceKeysMissing",
    wiped: "security.wipe",
    device_revoked: "me.deviceRevoked",
  };
  const key = map[code];
  return key ? t(key) : code;
}
