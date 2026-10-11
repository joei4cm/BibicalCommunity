import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, getToken } from "../lib/api";
import { humanizeStatus } from "../lib/status";

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

export function InboxPanel({
  onAcceptFriend,
}: {
  onAcceptFriend?: (requestId: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** Request ids already accepted this session (or confirmed not pending). */
  const [resolvedRequests, setResolvedRequests] = useState<Set<string>>(() => new Set());
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
    void refresh().catch((e) => setNote(e instanceof Error ? e.message : "error"));
  }, [refresh]);

  async function markRead(id: string) {
    await api(`/v1/inbox/${id}/read`, { method: "POST", body: "{}" });
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, readAt: m.readAt ?? Date.now() } : m)),
    );
  }

  async function markAll() {
    setBusy(true);
    try {
      await api("/v1/inbox/read-all", { method: "POST", body: "{}" });
      await refresh();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }

  async function acceptFriendFromInbox(m: InboxMessage) {
    const requestId = typeof m.payload.requestId === "string" ? m.payload.requestId : null;
    if (!requestId) return;
    setBusy(true);
    try {
      if (onAcceptFriend) await onAcceptFriend(requestId);
      else {
        await api(`/v1/friends/requests/${requestId}/accept`, { method: "POST", body: "{}" });
      }
      setResolvedRequests((prev) => new Set(prev).add(requestId));
      setPendingIncomingIds((prev) => {
        if (!prev) return prev;
        const next = new Set(prev);
        next.delete(requestId);
        return next;
      });
      await markRead(m.id);
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "error";
      // Already accepted / not pending — treat as done, don't ask again.
      if (msg.includes("not_pending") || msg.includes("409")) {
        setResolvedRequests((prev) => new Set(prev).add(requestId));
        await markRead(m.id).catch(() => undefined);
        setNote("comms.friendAccepted");
        await refresh().catch(() => undefined);
      } else {
        setNote(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  function kindLabel(kind: string) {
    const key = `comms.inboxKind.${kind}`;
    const translated = t(key);
    return translated === key ? kind : translated;
  }

  function canAcceptFriend(m: InboxMessage): boolean {
    if (m.kind !== "friend_request") return false;
    const requestId = typeof m.payload.requestId === "string" ? m.payload.requestId : null;
    if (!requestId) return false;
    if (resolvedRequests.has(requestId)) return false;
    if (pendingIncomingIds && !pendingIncomingIds.has(requestId)) return false;
    return true;
  }

  return (
    <div className="inbox-panel" data-testid="comms-inbox">
      <div className="im-toolbar-row">
        <button type="button" className="btn ghost" disabled={busy} onClick={() => void markAll()}>
          {t("comms.markAllRead")}
        </button>
      </div>

      {note && <p className="muted">{humanizeStatus(t, note)}</p>}

      <ul className="list" data-testid="inbox-list">
        {messages.length === 0 && <li className="muted">{t("comms.inboxEmpty")}</li>}
        {messages.map((m) => (
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
                {kindLabel(m.kind)} · {new Date(m.createdAt).toLocaleString()}
              </div>
              {m.body ? <p style={{ margin: "0.35rem 0 0" }}>{m.body}</p> : null}
              <div className="toolbar" style={{ marginTop: "0.45rem" }}>
                {!m.readAt && (
                  <button type="button" className="btn ghost" onClick={() => void markRead(m.id)}>
                    {t("comms.markRead")}
                  </button>
                )}
                {canAcceptFriend(m) ? (
                  <button
                    type="button"
                    className="btn"
                    disabled={busy}
                    onClick={() => void acceptFriendFromInbox(m)}
                  >
                    {t("comms.accept")}
                  </button>
                ) : m.kind === "friend_request" &&
                  typeof m.payload.requestId === "string" &&
                  (resolvedRequests.has(m.payload.requestId) ||
                    (pendingIncomingIds != null &&
                      !pendingIncomingIds.has(m.payload.requestId))) ? (
                  <span className="muted">{t("comms.friendAccepted")}</span>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
