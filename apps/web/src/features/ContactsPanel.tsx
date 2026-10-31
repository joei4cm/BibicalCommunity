import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, getToken } from "../lib/api";
import { humanizeStatus } from "../lib/status";
import { SheetPortal } from "../components/SheetPortal";
import { AUTH_NOTE_CODES, CommsLoginGate, isAuthBlocked } from "../components/CommsLoginGate";

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

function avatarLetter(label: string) {
  const ch = label.trim().charAt(0);
  return ch ? ch.toUpperCase() : "?";
}

function contactSubtitle(c: Contact, noGroup: string) {
  const parts: string[] = [];
  if (c.source === "friend") {
    /* badge shown separately */
  }
  if (c.groupNames.length) parts.push(c.groupNames.join(" · "));
  else if (c.source !== "friend") parts.push(noGroup);
  if (c.uid) parts.push(c.uid);
  return parts.join(" · ");
}

export function ContactsPanel({
  onOpenChat,
  onBadgesMaybeChanged,
}: {
  onOpenChat: (userId: string) => void;
  onBadgesMaybeChanged?: () => void;
}) {
  const { t } = useTranslation();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [incoming, setIncoming] = useState<FriendReq[]>([]);
  const [outgoing, setOutgoing] = useState<FriendReq[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<"all" | "friends">("all");
  const [listHydrated, setListHydrated] = useState(() => !getToken());

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setNote("login_required");
      setListHydrated(true);
      return;
    }
    try {
      // Fast path: friends + requests paint first (directory builds full org trees).
      const [friendsRes, reqs] = await Promise.all([
        api<{
          friends: {
            user: {
              id: string;
              uid: string | null;
              nickname: string | null;
              signature: string | null;
            };
          }[];
        }>("/v1/friends"),
        api<{ incoming: FriendReq[]; outgoing: FriendReq[] }>("/v1/friends/requests"),
      ]);
      setIncoming(reqs.incoming);
      setOutgoing(reqs.outgoing);
      setContacts(
        friendsRes.friends.map((f) => ({
          userId: f.user.id,
          uid: f.user.uid,
          nickname: f.user.nickname,
          signature: f.user.signature,
          roles: [],
          groupNames: [],
          churches: [],
          source: "friend" as const,
        })),
      );
      setNote(null);

      try {
        const dir = await api<{ contacts: Contact[] }>("/v1/friends/directory");
        setContacts(dir.contacts);
      } catch {
        /* keep friends-only snapshot */
      }
    } catch (e) {
      setNote(e instanceof Error ? e.message : "error");
    } finally {
      setListHydrated(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
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
      onBadgesMaybeChanged?.();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }

  if (isAuthBlocked(note)) {
    return (
      <div className="contacts-panel" data-testid="comms-contacts">
        <CommsLoginGate titleKey="comms.loginGate" testIdPrefix="contacts" />
      </div>
    );
  }

  const showNote = Boolean(note) && !AUTH_NOTE_CODES.has(note!);

  return (
    <div className="contacts-panel" data-testid="comms-contacts">
      {showNote && <p className="muted im-note">{humanizeStatus(t, note)}</p>}

      {incoming.length > 0 && (
        <div className="contacts-incoming" data-testid="contacts-incoming">
          <h3 className="contacts-section-title">{t("comms.incomingRequests")}</h3>
          <ul className="list">
            {incoming.map((r) => (
              <li key={r.id}>
                <div className="convo-row-rich contacts-req-row">
                  <span className="im-avatar" aria-hidden>
                    {avatarLetter(labelOf(r.user))}
                  </span>
                  <span className="convo-row-main">
                    <strong>{labelOf(r.user)}</strong>
                    <span className="muted convo-row-preview">UID {r.user.uid}</span>
                  </span>
                  <span className="contacts-req-actions">
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
                  </span>
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

      <ul className="list contacts-list" data-testid="contacts-list">
        {!listHydrated && visible.length === 0 && (
          <li className="im-list-skeleton" aria-busy="true" data-testid="contacts-list-loading">
            <div className="im-skel-item" aria-hidden>
              <span className="im-skel-avatar" />
              <span className="im-skel-lines">
                <span className="im-skel-line is-title" />
                <span className="im-skel-line is-sub" />
              </span>
            </div>
            <div className="im-skel-item" aria-hidden>
              <span className="im-skel-avatar" />
              <span className="im-skel-lines">
                <span className="im-skel-line is-title" />
                <span className="im-skel-line is-sub" />
              </span>
            </div>
            <div className="im-skel-item" aria-hidden>
              <span className="im-skel-avatar" />
              <span className="im-skel-lines">
                <span className="im-skel-line is-title" />
                <span className="im-skel-line is-sub" />
              </span>
            </div>
            <p className="muted im-skel-label">{t("comms.loadingContacts")}</p>
          </li>
        )}
        {listHydrated && visible.length === 0 && (
          <li className="comms-empty" data-testid="contacts-list-empty">
            <strong>{t("comms.contactsEmpty")}</strong>
            <p className="muted">{t("comms.contactsEmptyHint")}</p>
          </li>
        )}
        {visible.map((c) => {
          const label = labelOf(c);
          const sub = contactSubtitle(c, t("comms.noGroup"));
          return (
            <li key={c.userId}>
              <div className="convo-row-rich contacts-person-row">
                <span className="im-avatar" aria-hidden>
                  {avatarLetter(label)}
                </span>
                <span className="convo-row-main">
                  <strong>
                    {label}
                    {c.source === "friend" ? (
                      <span className="contacts-friend-badge">{t("comms.friendBadge")}</span>
                    ) : null}
                  </strong>
                  {sub ? <span className="muted convo-row-preview">{sub}</span> : null}
                </span>
                <span className="contacts-row-cta">
                  {c.source === "friend" ? (
                    <button type="button" className="btn" onClick={() => onOpenChat(c.userId)}>
                      {t("comms.openChat")}
                    </button>
                  ) : (
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
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      {outgoing.length > 0 && (
        <p className="muted contacts-outgoing" data-testid="contacts-outgoing">
          {t("comms.outgoingPending", { count: outgoing.length })}
        </p>
      )}

      <button
        type="button"
        className="comms-fab"
        data-testid="contacts-add-open"
        aria-label={t("comms.addFriend")}
        onClick={() => setSheetOpen(true)}
      >
        +
      </button>

      {sheetOpen && (
        <SheetPortal>
          <div className="sheet-backdrop" role="presentation" onClick={() => setSheetOpen(false)}>
            <div
              className="sheet-panel"
              role="dialog"
              aria-modal="true"
              data-testid="contacts-add-sheet"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sheet-handle" aria-hidden />
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
        </SheetPortal>
      )}
    </div>
  );
}
