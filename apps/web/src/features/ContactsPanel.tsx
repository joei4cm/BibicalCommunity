import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, getToken } from "../lib/api";
import { humanizeStatus } from "../lib/status";

type Contact = {
  userId: string;
  uid: string | null;
  nickname: string | null;
  signature: string | null;
  roles: string[];
  groupNames: string[];
  churches: string[];
  source: "directory" | "friend";
};

type FriendReq = {
  id: string;
  status: string;
  message: string | null;
  createdAt: number;
  user: { id: string; uid: string; nickname: string | null; signature: string | null };
};

function labelOf(c: { nickname?: string | null; uid?: string | null; userId?: string; id?: string }) {
  return c.nickname || c.uid || c.userId || c.id || "—";
}

export function ContactsPanel({ onOpenChat }: { onOpenChat: (userId: string) => void }) {
  const { t } = useTranslation();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [incoming, setIncoming] = useState<FriendReq[]>([]);
  const [outgoing, setOutgoing] = useState<FriendReq[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<"all" | "friends">("all");

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setNote("login_required");
      return;
    }
    const [dir, reqs] = await Promise.all([
      api<{ contacts: Contact[] }>("/v1/friends/directory"),
      api<{ incoming: FriendReq[]; outgoing: FriendReq[] }>("/v1/friends/requests"),
    ]);
    setContacts(dir.contacts);
    setIncoming(reqs.incoming);
    setOutgoing(reqs.outgoing);
    setNote(null);
  }, []);

  useEffect(() => {
    void refresh().catch((e) => setNote(e instanceof Error ? e.message : "error"));
  }, [refresh]);

  const visible = useMemo(() => {
    const list = filter === "friends" ? contacts.filter((c) => c.source === "friend") : contacts;
    return [...list].sort((a, b) => labelOf(a).localeCompare(labelOf(b), "zh"));
  }, [contacts, filter]);

  async function sendRequest() {
    if (!query.trim()) return;
    setBusy(true);
    try {
      await api("/v1/friends/request", {
        method: "POST",
        body: JSON.stringify({ query: query.trim() }),
      });
      setQuery("");
      setSheetOpen(false);
      setNote("friend_request_sent");
      await refresh();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }

  async function respond(id: string, accept: boolean) {
    setBusy(true);
    try {
      await api(`/v1/friends/requests/${id}/${accept ? "accept" : "decline"}`, {
        method: "POST",
        body: "{}",
      });
      await refresh();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="contacts-panel" data-testid="comms-contacts">
      <div className="chat-home-header">
        <div>
          <h2 style={{ marginBottom: "0.2rem" }}>{t("comms.contacts")}</h2>
          <p className="muted" style={{ margin: 0 }}>
            {t("comms.contactsHint")}
          </p>
        </div>
        <button
          type="button"
          className="btn"
          data-testid="contacts-add-open"
          onClick={() => setSheetOpen(true)}
        >
          + {t("comms.addFriend")}
        </button>
      </div>

      {note && <p className="muted">{humanizeStatus(t, note)}</p>}

      {incoming.length > 0 && (
        <div className="panel" style={{ marginBottom: "0.85rem" }} data-testid="contacts-incoming">
          <h3 style={{ marginTop: 0 }}>{t("comms.incomingRequests")}</h3>
          <ul className="list">
            {incoming.map((r) => (
              <li key={r.id}>
                <div className="convo-row" style={{ cursor: "default" }}>
                  <strong>{labelOf(r.user)}</strong>
                  <div className="muted">UID {r.user.uid}</div>
                  <div className="toolbar" style={{ marginTop: "0.45rem" }}>
                    <button
                      type="button"
                      className="btn"
                      disabled={busy}
                      onClick={() => void respond(r.id, true)}
                    >
                      {t("comms.accept")}
                    </button>
                    <button
                      type="button"
                      className="btn ghost"
                      disabled={busy}
                      onClick={() => void respond(r.id, false)}
                    >
                      {t("comms.decline")}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="manage-subtabs" role="tablist">
        <button
          type="button"
          className={`manage-subtab${filter === "all" ? " is-active" : ""}`}
          onClick={() => setFilter("all")}
        >
          {t("comms.directory")}
        </button>
        <button
          type="button"
          className={`manage-subtab${filter === "friends" ? " is-active" : ""}`}
          onClick={() => setFilter("friends")}
        >
          {t("comms.addedFriends")}
        </button>
      </div>

      <ul className="list" data-testid="contacts-list">
        {visible.length === 0 && <li className="muted">{t("comms.contactsEmpty")}</li>}
        {visible.map((c) => (
          <li key={c.userId}>
            <div className="convo-row" style={{ cursor: "default" }}>
              <strong>
                {labelOf(c)}
                {c.source === "friend" ? (
                  <span className="muted" style={{ fontWeight: 400 }}>
                    {" "}
                    · {t("comms.friendBadge")}
                  </span>
                ) : null}
              </strong>
              <div className="muted">
                {c.groupNames.length ? c.groupNames.join(" · ") : t("comms.noGroup")}
                {c.uid ? ` · ${c.uid}` : ""}
              </div>
              {c.signature ? <div className="muted">{c.signature}</div> : null}
              <div className="toolbar" style={{ marginTop: "0.4rem" }}>
                <button type="button" className="btn ghost" onClick={() => onOpenChat(c.userId)}>
                  {t("comms.openChat")}
                </button>
                {c.source !== "friend" && (
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={busy}
                    onClick={() => {
                      setQuery(c.uid || c.userId);
                      setSheetOpen(true);
                    }}
                  >
                    {t("comms.addFriend")}
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {outgoing.length > 0 && (
        <p className="muted" style={{ marginTop: "1rem" }}>
          {t("comms.outgoingPending", { count: outgoing.length })}
        </p>
      )}

      {sheetOpen && (
        <div className="chat-sheet-backdrop" role="presentation" onClick={() => setSheetOpen(false)}>
          <div
            className="chat-sheet"
            role="dialog"
            aria-modal="true"
            data-testid="contacts-add-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="chat-sheet-head">
              <h3 style={{ margin: 0 }}>{t("comms.addFriend")}</h3>
              <button type="button" className="btn ghost" onClick={() => setSheetOpen(false)}>
                ✕
              </button>
            </div>
            <p className="muted">{t("comms.addFriendHint")}</p>
            <div className="field">
              <label>{t("comms.addFriendQuery")}</label>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("comms.addFriendPlaceholder")}
                data-testid="contacts-add-input"
              />
            </div>
            <button
              type="button"
              className="btn"
              disabled={busy || !query.trim()}
              data-testid="contacts-add-submit"
              onClick={() => void sendRequest()}
            >
              {t("comms.sendRequest")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
