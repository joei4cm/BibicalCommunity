/** Normalize thrown API/network errors into stable UI status codes. */
export function normalizeErrorCode(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err ?? "error");
  const lower = msg.toLowerCase();
  if (
    !msg ||
    msg === "Failed to fetch" ||
    msg === "request_failed" ||
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("network request failed") ||
    lower.includes("load failed")
  ) {
    return "network_error";
  }
  return msg;
}

/** True when the note means list load failed (show retry empty, not “no data”). */
export function isLoadFailureNote(note: string | null | undefined): boolean {
  return (
    note === "network_error" ||
    note === "request_failed" ||
    note === "Failed to fetch" ||
    (typeof note === "string" && /failed to fetch/i.test(note))
  );
}

/** Map internal status codes to localized copy for UI banners. */
export function humanizeStatus(
  t: (key: string, opts?: Record<string, unknown>) => string,
  code: string | null | undefined,
): string | null {
  if (!code) return null;

  if (code.startsWith("created:")) return t("plans.createdOk");
  if (code.startsWith("subscribed:")) return t("plans.subscribedOk");
  if (code.startsWith("progress:")) return t("plans.progressOk");
  if (/failed to fetch/i.test(code) || /networkerror/i.test(code)) {
    return t("comms.networkError");
  }

  const map: Record<string, string> = {
    login_required: "auth.loginRequired",
    unauthorized: "auth.loginRequired",
    "401": "auth.loginRequired",
    network_error: "comms.networkError",
    request_failed: "comms.networkError",
    "Failed to fetch": "comms.networkError",
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
    chat_keys_required: "chat.keysRequired",
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
    invite_required: "home.inviteRequired",
    invite_invalid: "home.inviteInvalid",
    invite_expired: "home.inviteExpired",
    invite_exhausted: "home.inviteExhausted",
    invite_created: "home.inviteCreated",
    verified_required: "home.verifiedRequired",
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
    message_favorited: "chat.favorited",
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
