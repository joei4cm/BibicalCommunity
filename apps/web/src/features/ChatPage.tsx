import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChatPanel } from "./ChatPanel";
import { ContactsPanel } from "./ContactsPanel";
import { CalendarPanel } from "./CalendarPanel";
import { InboxPanel } from "./InboxPanel";

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
              {t(key)}
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
        />
      )}
      {tab === "contacts" && <ContactsPanel onOpenChat={openChatWith} />}
      {tab === "calendar" && <CalendarPanel />}
      {tab === "inbox" && <InboxPanel />}
    </section>
  );
}
