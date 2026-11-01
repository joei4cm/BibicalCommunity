import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChatPanel } from "./ChatPanel";
import { ContactsPanel } from "./ContactsPanel";
import { CalendarPanel } from "./CalendarPanel";
import { InboxPanel } from "./InboxPanel";
import { useCommsBadges } from "../hooks/useCommsBadges";
import { formatBadgeCount, notifyCommsBadgesChanged } from "../lib/comms-badges";

type CommsTab = "chat" | "contacts" | "calendar" | "inbox";

function parseTab(raw: string | null): CommsTab {
  if (raw === "contacts" || raw === "calendar" || raw === "inbox" || raw === "chat") return raw;
  return "chat";
}

/** 通讯：聊天 · 联系人 · 日程 · 站内信 — no duplicate page H1 (bottom nav already labels 通讯). */
export function ChatPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = useMemo(() => parseTab(searchParams.get("tab")), [searchParams]);
  const [chatPeer, setChatPeer] = useState<string | null>(null);
  const [threadOpen, setThreadOpen] = useState(false);
  const { badges, refresh } = useCommsBadges();

  const setTab = useCallback(
    (next: CommsTab) => {
      setThreadOpen(false);
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (next === "chat") p.delete("tab");
          else p.set("tab", next);
          return p;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const openChatWith = useCallback(
    (userId: string) => {
      setChatPeer(userId);
      setTab("chat");
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.delete("tab");
          p.set("peer", userId);
          return p;
        },
        { replace: true },
      );
    },
    [setSearchParams, setTab],
  );

  const immersive = tab === "chat" && threadOpen;

  const tabBadges: Record<CommsTab, string> = {
    chat: formatBadgeCount(badges.chatUnread),
    contacts: formatBadgeCount(badges.friendRequestsPending),
    calendar: formatBadgeCount(badges.calendarPending),
    inbox: formatBadgeCount(badges.inboxUnread),
  };

  return (
    <section
      className={`fade-up chat-page app-folio${immersive ? " is-im-thread" : ""}`}
      data-testid="chat-page"
    >
      {!immersive && (
        <div className="comms-tabs plans-tabs" role="tablist" data-testid="comms-tabs">
          {(
            [
              ["chat", "comms.chat"],
              ["contacts", "comms.contacts"],
              ["calendar", "comms.calendar"],
              ["inbox", "comms.inbox"],
            ] as const
          ).map(([id, key]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={`plans-tab${tab === id ? " is-active" : ""}`}
              data-testid={`comms-tab-${id}`}
              onClick={() => setTab(id)}
            >
              <span>{t(key)}</span>
              {tabBadges[id] ? (
                <span className="nav-badge" data-testid={`comms-badge-${id}`}>
                  {tabBadges[id]}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      )}

      {tab === "chat" && (
        <ChatPanel
          key={chatPeer ?? "chat"}
          initialPeer={chatPeer}
          onPeerConsumed={() => setChatPeer(null)}
          onThreadOpenChange={setThreadOpen}
          onBadgesMaybeChanged={() => {
            notifyCommsBadgesChanged();
            void refresh();
          }}
        />
      )}
      {tab === "contacts" && (
        <ContactsPanel
          onOpenChat={openChatWith}
          onBadgesMaybeChanged={() => {
            notifyCommsBadgesChanged();
            void refresh();
          }}
        />
      )}
      {tab === "calendar" && (
        <CalendarPanel
          onBadgesMaybeChanged={() => {
            notifyCommsBadgesChanged();
            void refresh();
          }}
        />
      )}
      {tab === "inbox" && (
        <InboxPanel
          onOpenContacts={() => setTab("contacts")}
          onBadgesMaybeChanged={() => {
            notifyCommsBadgesChanged();
            void refresh();
          }}
        />
      )}
    </section>
  );
}
