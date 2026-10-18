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
    chat_degraded_awaiting_peer: "chat.degradedAwaitingPeer",
    chat_degraded_soft: "chat.degradedSoft",
    friends_required: "chat.friendsRequired",
    admin_wipe_issued: "security.adminWipe",
    "admin.forbidden": "admin.forbidden",
    "admin.bootstrapOk": "admin.bootstrapOk",
    "admin.corpusSeedOk": "admin.corpusSeedOk",
    title_required: "plans.title",
    days_required: "plans.daysHint",
    invalid_days: "plans.daysHint",
    invalid_json: "plans.editDays",
    already_member: "home.selected",
    joined_church: "home.joinHome",
    home_created: "home.createHome",
    hostile_enabled: "home.securityMode.hostileBadge",
    standard_enabled: "home.securityMode.standardBadge",
    media_uploaded: "home.attachment",
    media_upload_failed: "home.attachment",
    group_required: "home.selectGroup",
    member_verified: "home.verify",
    group_created: "home.createGroup",
    group_member_added: "home.addGroupMember",
    group_member_removed: "home.removeGroupMember",
    roles_updated: "home.saveRoles",
    assembly_notify_sent: "home.assembly.notifySent",
    friend_request_sent: "friend_request_sent",
    user_not_found: "comms.contactsEmpty",
    already_friends: "comms.friendBadge",
    request_pending: "comms.incomingRequests",
    cannot_friend_self: "comms.addFriend",
    message_requests_closed: "comms.messageRequestsClosed",
    "home.postedOk": "home.postedOk",
    "home.exportOk": "home.exportOk",
    readonly: "home.readonly",
    expired: "home.expired",
    platform_admin_required: "admin.platformAdmin",
    church_admin_required: "admin.churchAdmin",
    keys_uploaded: "security.deviceKeysPresent",
    keys_failed: "security.deviceKeysMissing",
    wiped: "security.wipe",
    device_revoked: "me.deviceRevoked",
    api_html_response: "auth.apiHtmlResponse",
    api_base_required: "me.serverUrlHint",
  };
  const key = map[code];
  return key ? t(key) : code;
}
