import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { getToken } from "../lib/api";
import { fetchCommsBadges } from "../lib/comms-badges";
import { showAppNotification } from "../lib/notify";

const POLL_MS = 12_000;

/**
 * Polls unread badges and fires a generic message notification when counts rise
 * while the user is away from an open chat (PWA background / other tab).
 */
export function NotifyHost() {
  const { t } = useTranslation();
  const location = useLocation();
  const lastUnreadRef = useRef<number | null>(null);
  const onChatRef = useRef(false);

  useEffect(() => {
    onChatRef.current =
      location.pathname.startsWith("/app/chat") &&
      !new URLSearchParams(location.search).get("tab");
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!getToken()) return;

    let cancelled = false;

    async function tick() {
      if (cancelled || !getToken()) return;
      try {
        const badges = await fetchCommsBadges();
        const unread = badges.chatUnread;
        const prev = lastUnreadRef.current;
        lastUnreadRef.current = unread;
        if (prev == null) return;
        if (unread <= prev) return;
        // Viewing chat list/thread — badge UI is enough; skip OS toast.
        if (onChatRef.current && document.visibilityState === "visible") return;
        showAppNotification({
          kind: "message",
          title: t("notify.newMessage"),
          body: t("notify.newMessageBody"),
          tag: "lh-message",
          onClickUrl: "/app/chat",
        });
      } catch {
        /* ignore */
      }
    }

    void tick();
    const timer = window.setInterval(() => void tick(), POLL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [t]);

  return null;
}
