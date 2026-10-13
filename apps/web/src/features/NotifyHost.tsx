import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { getToken } from "../lib/api";
import { showAppNotification } from "../lib/notify";
import { useCommsBadges } from "../hooks/useCommsBadges";

/**
 * Watches shared unread badges and fires a generic message notification when
 * counts rise while the user is away from an open chat.
 */
export function NotifyHost() {
  const { t } = useTranslation();
  const location = useLocation();
  const { badges } = useCommsBadges();
  const lastUnreadRef = useRef<number | null>(null);
  const onChatRef = useRef(false);

  useEffect(() => {
    onChatRef.current =
      location.pathname.startsWith("/app/chat") &&
      !new URLSearchParams(location.search).get("tab");
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!getToken()) {
      lastUnreadRef.current = null;
      return;
    }
    const unread = badges.chatUnread;
    const prev = lastUnreadRef.current;
    lastUnreadRef.current = unread;
    if (prev == null) return;
    if (unread <= prev) return;
    if (onChatRef.current && document.visibilityState === "visible") return;
    showAppNotification({
      kind: "message",
      title: t("notify.newMessage"),
      body: t("notify.newMessageBody"),
      tag: "lh-message",
      onClickUrl: "/app/chat",
    });
  }, [badges.chatUnread, t]);

  return null;
}
