import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, getToken } from "../lib/api";
import { humanizeStatus, isLoadFailureNote, normalizeErrorCode } from "../lib/status";
import { notifyCommsBadgesChanged } from "../lib/comms-badges";
import { AUTH_NOTE_CODES, CommsLoginGate, isAuthBlocked } from "../components/CommsLoginGate";
import { CommsLoadError } from "../components/CommsLoadError";

type InboxMessage = {
  id: string;
  kind: string;
  title: string;
  body: string;
  payload: Record<string, unknown>;
  relatedUserId: string | null;
  readAt: number | null;
  createdAt: number;
};

function formatInboxWhen(ts: number, locale: string): string {
  const d = new Date(ts);
  const now = Date.now();
  const diff = now - ts;
  if (diff >= 0 && diff < 60_000) return locale.startsWith("zh") ? "刚刚" : locale.startsWith("ja") ? "たった今" : "Just now";
  if (diff >= 0 && diff < 3_600_000) {
    const m = Math.max(1, Math.floor(diff / 60_000));
    if (locale.startsWith("zh")) return `${m} 分钟前`;
    if (locale.startsWith("ja")) return `${m}分前`;
    return `${m}m ago`;
  }
  const sameDay =
    d.getFullYear() === new Date().getFullYear() &&
    d.getMonth() === new Date().getMonth() &&
    d.getDate() === new Date().getDate();
  if (sameDay) {
    return d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  return d.toLocaleString(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function InboxPanel({
  onOpenContacts,
  onBadgesMaybeChanged,
}: {
  /** Deep-link friend requests to Contacts (single place to accept/decline). */
  onOpenContacts?: () => void;
  onBadgesMaybeChanged?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingIncomingIds, setPendingIncomingIds] = useState<Set<string> | null>(null);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setNote("login_required");
      return;
    }
    const [inbox, requests] = await Promise.all([
      api<{ messages: InboxMessage[] }>("/v1/inbox"),
      api<{ incoming: { id: string }[] }>("/v1/friends/requests").catch(() => ({
        incoming: [] as { id: string }[],
      })),
    ]);
    setMessages(inbox.messages);
    setPendingIncomingIds(new Set(requests.incoming.map((r) => r.id)));
    setNote(null);
  }, []);

  useEffect(() => {
    void refresh().catch((e) => setNote(normalizeErrorCode(e)));
  }, [refresh]);

  async function markRead(id: string) {
    await api(`/v1/inbox/${id}/read`, { method: "POST", body: "{}" });
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, readAt: m.readAt ?? Date.now() } : m)),
    );
    notifyCommsBadgesChanged();
    onBadgesMaybeChanged?.();
  }

  async function markAll() {
    setBusy(true);
    try {
      await api("/v1/inbox/read-all", { method: "POST", body: "{}" });
      await refresh();
      notifyCommsBadgesChanged();
      onBadgesMaybeChanged?.();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }

  function kindLabel(kind: string) {
    const key = `comms.inboxKind.${kind}`;
    const translated = t(key);
    return translated === key ? kind : translated;
  }

  function friendRequestPending(m: InboxMessage): boolean {
    if (m.kind !== "friend_request") return false;
    const requestId = typeof m.payload.requestId === "string" ? m.payload.requestId : null;
    if (!requestId) return false;
    if (pendingIncomingIds && !pendingIncomingIds.has(requestId)) return false;
    return true;
  }

  if (isAuthBlocked(note)) {
    return (
      <div className="inbox-panel" data-testid="comms-inbox">
        <CommsLoginGate titleKey="comms.inboxLoginGate" testIdPrefix="inbox" />
      </div>
    );
  }

  const loadFailed = isLoadFailureNote(note);
  const unreadCount = messages.filter((m) => !m.readAt).length;
  const locale = i18n.language || "zh-CN";

  return (
    <div className="inbox-panel" data-testid="comms-inbox">
      {unreadCount > 0 && (
        <div className="im-toolbar-row">
          <button type="button" className="btn ghost" disabled={busy} onClick={() => void markAll()}>
            {t("comms.markAllRead")}
          </button>
        </div>
      )}

      {note && !AUTH_NOTE_CODES.has(note) && !loadFailed && (
        <p className="muted">{humanizeStatus(t, note)}</p>
      )}

      <ul className="list" data-testid="inbox-list">
        {messages.length === 0 && loadFailed && (
          <li>
            <CommsLoadError testId="inbox-list-error" onRetry={() => void refresh()} busy={busy} />
          </li>
        )}
        {messages.length === 0 && !loadFailed && (
          <li className="comms-empty" data-testid="inbox-list-empty">
            <strong>{t("comms.inboxEmpty")}</strong>
            <p className="muted">{t("comms.inboxEmptyHint")}</p>
          </li>
        )}
        {messages.map((m) => {
          const friendPending = friendRequestPending(m);
          const titleLooksLikeKind = m.title.trim() === kindLabel(m.kind);
          return (
            <li key={m.id}>
              <div
                className={`convo-row${m.readAt ? "" : " is-unread"}`}
                style={{ cursor: "default" }}
              >
                <strong>
                  {m.title}
                  {!m.readAt && (
                    <span className="muted" style={{ fontWeight: 400 }}>
                      {" "}
                      · {t("comms.unread")}
                    </span>
                  )}
                </strong>
                <div className="muted">
                  {titleLooksLikeKind
                    ? formatInboxWhen(m.createdAt, locale)
                    : `${kindLabel(m.kind)} · ${formatInboxWhen(m.createdAt, locale)}`}
                </div>
                {m.body ? <p style={{ margin: "0.35rem 0 0" }}>{m.body}</p> : null}
                <div className="toolbar inbox-row-actions" style={{ marginTop: "0.45rem" }}>
                  {friendPending ? (
                    <button
                      type="button"
                      className="btn"
                      data-testid="inbox-friend-goto-contacts"
                      onClick={() => onOpenContacts?.()}
                    >
                      {t("comms.handleInContacts")}
                    </button>
                  ) : m.kind === "friend_request" &&
                    typeof m.payload.requestId === "string" &&
                    pendingIncomingIds != null &&
                    !pendingIncomingIds.has(m.payload.requestId) ? (
                    <span className="muted">{t("comms.friendAccepted")}</span>
                  ) : !m.readAt ? (
                    <button type="button" className="btn ghost" onClick={() => void markRead(m.id)}>
                      {t("comms.markRead")}
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
