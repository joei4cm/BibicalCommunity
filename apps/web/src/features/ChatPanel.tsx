import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  deriveSessionKey,
  decryptSessionPayload,
  encryptSessionPayload,
} from "@logoshome/crypto";
import { isCoworkerAssemblyConversationTitle } from "@logoshome/shared";
import { api, getToken } from "../lib/api";
import { decryptChatMessage, encryptChatMessage } from "../lib/secure-chat";
import {
  decryptGroupFanout,
  encryptGroupFanout,
  isGroupFanoutHeader,
} from "../lib/group-fanout";
import { humanizeStatus } from "../lib/status";
import { startCallSession, type CallSession } from "../lib/call-session";
import { startScreenShare, stopScreenShare } from "../lib/webrtc";
import { canStartScreenShare, probeDisplayMedia } from "../lib/screen-share";
import { buildIceServersFromTurnResponse } from "../lib/turn-ice";

type Conversation = {
  id: string;
  kind: "dm" | "group";
  title: string | null;
  disappearingTtlSec: number | null;
  createdBy: string;
  createdAt: number;
  memberIds?: string[];
  peerUserIds?: string[];
  membership: { id: string; role: string; archived: boolean };
};

type ChatMessage = {
  id: string;
  senderDeviceId: string;
  ratchetHeader: string;
  ciphertext: string;
  contentType: string;
  createdAt: number;
  expiresAt: number | null;
};

const TTL_OPTIONS = [
  { labelKey: "chat.ttlOff", value: null as number | null },
  { labelKey: "chat.ttl1h", value: 3600 },
  { labelKey: "chat.ttl1d", value: 86400 },
  { labelKey: "chat.ttl7d", value: 604800 },
];

async function sessionKeyFor(conversationId: string) {
  return deriveSessionKey(`lh-convo:${conversationId}`);
}

export function ChatPanel() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [plaintexts, setPlaintexts] = useState<Record<string, string>>({});
  const [kind, setKind] = useState<"dm" | "group">("dm");
  const [title, setTitle] = useState("");
  const [memberIds, setMemberIds] = useState("");
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [callNote, setCallNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [favorites, setFavorites] = useState<{ id: string; messageId: string }[]>([]);
  const [selfUserId, setSelfUserId] = useState<string | null>(null);
  const [listTab, setListTab] = useState<"chats" | "friends" | "archived">("friends");
  const [sheet, setSheet] = useState<"none" | "discover" | "compose">("none");
  const [discoverQ, setDiscoverQ] = useState("");
  const [discoverHits, setDiscoverHits] = useState<
    { id: string; uid: string; nickname: string | null }[]
  >([]);
  const callRef = useRef<CallSession | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  const activeConversations = useMemo(
    () => conversations.filter((c) => !c.membership.archived),
    [conversations],
  );
  const archivedConversations = useMemo(
    () => conversations.filter((c) => c.membership.archived),
    [conversations],
  );
  const friends = useMemo(() => {
    const map = new Map<string, { userId: string; label: string; conversationId?: string }>();
    for (const c of conversations) {
      if (c.kind !== "dm") continue;
      for (const peer of c.peerUserIds ?? []) {
        if (!peer || map.has(peer)) continue;
        map.set(peer, {
          userId: peer,
          label: c.title?.trim() || peer.slice(0, 12),
          conversationId: c.id,
        });
      }
    }
    return [...map.values()];
  }, [conversations]);

  const refreshConversations = useCallback(async () => {
    if (!getToken()) {
      setNote("login_required");
      return;
    }
    const res = await api<{ conversations: Conversation[] }>("/v1/chat/conversations");
    setConversations(res.conversations);
    setNote(null);
  }, []);

  useEffect(() => {
    if (!getToken()) return;
    void api<{ id?: string; userId?: string }>("/v1/me")
      .then((me) => setSelfUserId(me.id ?? me.userId ?? null))
      .catch(() => setSelfUserId(null));
  }, []);

  const peerFromQuery = searchParams.get("peer");
  const conversationFromQuery = searchParams.get("conversation");
  useEffect(() => {
    if (!peerFromQuery || !getToken()) return;
    let cancelled = false;
    void (async () => {
      try {
        const resList = await api<{ conversations: Conversation[] }>("/v1/chat/conversations");
        if (cancelled) return;
        setConversations(resList.conversations);
        const existing = resList.conversations.find(
          (c) => c.kind === "dm" && (c.peerUserIds ?? []).includes(peerFromQuery),
        );
        if (existing) {
          setSelectedId(existing.id);
          setListTab("chats");
        } else {
          const res = await api<{ id: string }>("/v1/chat/conversations", {
            method: "POST",
            body: JSON.stringify({ kind: "dm", memberIds: [peerFromQuery] }),
          });
          if (cancelled) return;
          const again = await api<{ conversations: Conversation[] }>("/v1/chat/conversations");
          if (cancelled) return;
          setConversations(again.conversations);
          setSelectedId(res.id);
          setListTab("chats");
        }
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            next.delete("peer");
            return next;
          },
          { replace: true },
        );
      } catch (e) {
        if (!cancelled) setNote(e instanceof Error ? e.message : "error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [peerFromQuery, setSearchParams]);

  useEffect(() => {
    if (!conversationFromQuery || !getToken()) return;
    let cancelled = false;
    void (async () => {
      try {
        const resList = await api<{ conversations: Conversation[] }>("/v1/chat/conversations");
        if (cancelled) return;
        setConversations(resList.conversations);
        if (resList.conversations.some((c) => c.id === conversationFromQuery)) {
          setSelectedId(conversationFromQuery);
          setListTab("chats");
        }
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            next.delete("conversation");
            return next;
          },
          { replace: true },
        );
      } catch (e) {
        if (!cancelled) setNote(e instanceof Error ? e.message : "error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationFromQuery, setSearchParams]);

  const peersFor = useCallback(
    (conversationId: string | null) => {
      if (!conversationId) return [] as string[];
      const c = conversations.find((x) => x.id === conversationId);
      return (c?.peerUserIds ?? []).filter(Boolean);
    },
    [conversations],
  );

  const peerFor = useCallback(
    (conversationId: string | null) => peersFor(conversationId)[0] ?? null,
    [peersFor],
  );

  const loadMessages = useCallback(
    async (conversationId: string) => {
      const res = await api<{ messages: ChatMessage[] }>(
        `/v1/chat/conversations/${conversationId}/messages`,
      );
      const now = Date.now();
      const live = res.messages.filter((m) => m.expiresAt == null || m.expiresAt > now);
      setMessages(live);
      const key = await sessionKeyFor(conversationId);
      const peer = peerFor(conversationId);
      const decoded: Record<string, string> = {};
      for (const m of live) {
        try {
          if (isGroupFanoutHeader(m.ratchetHeader) && selfUserId) {
            decoded[m.id] = await decryptGroupFanout({
              conversationId,
              ratchetHeader: m.ratchetHeader,
              ciphertext: m.ciphertext,
              selfUserId,
            });
          } else {
            decoded[m.id] = await decryptChatMessage(
              conversationId,
              m.ratchetHeader,
              m.ciphertext,
              peer,
            );
          }
        } catch {
          try {
            decoded[m.id] = await decryptSessionPayload(key, m.ratchetHeader, m.ciphertext);
          } catch {
            decoded[m.id] = localStorage.getItem(`lh.msg.${m.id}`) ?? "[ciphertext]";
          }
        }
      }
      setPlaintexts(decoded);
    },
    [peerFor, selfUserId],
  );

  const loadFavorites = useCallback(async () => {
    if (!getToken()) return;
    try {
      const res = await api<{ favorites: { id: string; messageId: string }[] }>("/v1/chat/favorites");
      setFavorites(res.favorites);
    } catch {
      /* endpoint may be unavailable in older deploys */
    }
  }, []);

  useEffect(() => {
    void refreshConversations().catch((e) => setNote(e instanceof Error ? e.message : "error"));
    void loadFavorites();
  }, [refreshConversations, loadFavorites]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    void loadMessages(selectedId).catch((e) => setNote(e instanceof Error ? e.message : "error"));
  }, [selectedId, loadMessages]);

  async function createConversation(explicitIds?: string[], explicitKind?: "dm" | "group") {
    if (!getToken()) {
      setNote("login_required");
      return;
    }
    setBusy(true);
    try {
      const useKind = explicitKind ?? kind;
      const ids = (explicitIds ??
        memberIds
          .split(/[\s,]+/)
          .map((s) => s.trim())
          .filter(Boolean));
      if (ids.length === 0) {
        setNote("members_required");
        return;
      }
      const res = await api<{ id: string }>("/v1/chat/conversations", {
        method: "POST",
        body: JSON.stringify({
          kind: useKind,
          title: useKind === "group" ? title || undefined : undefined,
          memberIds: ids,
        }),
      });
      setMemberIds("");
      setTitle("");
      setSheet("none");
      await refreshConversations();
      setSelectedId(res.id);
      setListTab("chats");
      setNote(null);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }

  async function discoverUsers() {
    if (!getToken()) {
      setNote("login_required");
      return;
    }
    const q = discoverQ.trim();
    if (!q) {
      setDiscoverHits([]);
      return;
    }
    setBusy(true);
    try {
      const res = await api<{ results: { id: string; uid: string; nickname: string | null }[] }>(
        `/v1/me/search?q=${encodeURIComponent(q)}`,
      );
      setDiscoverHits(res.results);
      setNote(null);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }

  async function openOrStartDm(userId: string) {
    const existing = conversations.find(
      (c) => c.kind === "dm" && (c.peerUserIds ?? []).includes(userId),
    );
    if (existing) {
      setSelectedId(existing.id);
      setSheet("none");
      setListTab("chats");
      return;
    }
    await createConversation([userId], "dm");
  }

  async function sendMessage() {
    if (!selectedId || !draft.trim()) return;
    setBusy(true);
    try {
      const text = draft.trim();
      const peers = peersFor(selectedId);
      const expiresAt = selected?.disappearingTtlSec
        ? Date.now() + selected.disappearingTtlSec * 1000
        : undefined;

      let ratchetHeader: string;
      let ciphertext: string;
      let mode: string;

      if (selected?.kind === "group" && peers.length >= 1 && selfUserId) {
        const fanout = await encryptGroupFanout({
          conversationId: selectedId,
          plaintext: text,
          fromUserId: selfUserId,
          peerUserIds: peers,
          expiresAt,
        });
        ratchetHeader = fanout.ratchetHeader;
        ciphertext = fanout.ciphertext;
        mode = fanout.degradedPeers.length > 0 ? "degraded" : "group-fanout";
      } else {
        const enc = await encryptChatMessage(selectedId, text, peers[0] ?? null);
        ratchetHeader = enc.ratchetHeader;
        ciphertext = enc.ciphertext;
        mode = enc.mode;
      }

      const res = await api<{ id: string }>(`/v1/chat/conversations/${selectedId}/messages`, {
        method: "POST",
        body: JSON.stringify({
          ratchetHeader,
          ciphertext,
          contentType: "msg",
          expiresAt,
        }),
      });
      localStorage.setItem(`lh.msg.${res.id}`, text);
      if (mode === "degraded") {
        setNote("chat_degraded_no_peer_keys");
      } else {
        setNote(null);
      }
      setDraft("");
      await loadMessages(selectedId);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }

  async function favoriteMessage(m: ChatMessage) {
    const text = plaintexts[m.id] ?? "";
    const key = await sessionKeyFor(selectedId ?? "fav");
    const enc = await encryptSessionPayload(key, text, "fav");
    await api("/v1/chat/favorites", {
      method: "POST",
      body: JSON.stringify({
        messageId: m.id,
        ciphertext: enc.ciphertext,
        iv: enc.ratchetHeader,
      }),
    });
    await loadFavorites();
  }

  async function patchTtl(ttl: number | null) {
    if (!selectedId) return;
    setBusy(true);
    try {
      await api(`/v1/chat/conversations/${selectedId}`, {
        method: "PATCH",
        body: JSON.stringify({ disappearingTtlSec: ttl }),
      });
      await refreshConversations();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }

  async function archiveConversation(archived: boolean) {
    if (!selectedId) return;
    await api(`/v1/chat/conversations/${selectedId}`, {
      method: "PATCH",
      body: JSON.stringify({ archived }),
    });
    await refreshConversations();
  }

  async function startCall() {
    if (!selectedId) return;
    setBusy(true);
    setCallNote(null);
    try {
      callRef.current?.close();
      const res = await api<{
        callId: string;
        signalingPath: string;
        note?: string;
      }>("/v1/chat/calls", {
        method: "POST",
        body: JSON.stringify({ conversationId: selectedId }),
      });
      let iceServers: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
      try {
        const turn = await api<{
          username?: string;
          credential?: string;
          uris: string[];
          ttl: number;
          iceServers?: RTCIceServer[];
          hasRelay?: boolean;
          note?: string;
        }>("/v1/calls/turn-credentials", { method: "POST", body: "{}" });
        iceServers = buildIceServersFromTurnResponse(turn, iceServers);
        setCallNote(
          turn.hasRelay
            ? `TURN relay · ttl=${turn.ttl}s · ${turn.uris.join(",")}`
            : `STUN-only · ttl=${turn.ttl}s · ${t("chat.turnRelayMissing")}`,
        );
      } catch {
        /* STUN-only fallback */
      }
      const token = getToken();
      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      const wsUrl = token
        ? `${proto}://${window.location.host}${res.signalingPath}?token=${encodeURIComponent(token)}&conversationId=${encodeURIComponent(selectedId)}`
        : null;
      const session = await startCallSession({
        wsUrl,
        iceServers,
        onRemoteStream: (stream) => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = stream;
          }
        },
        onNote: (m) => setCallNote((prev) => `${prev ?? ""} · ${m}`),
      });
      callRef.current = session;
      setCallNote(
        (prev) =>
          `${prev ? `${prev} · ` : ""}${t("chat.callStarted")}: ${res.callId} · ${res.signalingPath}` +
          (res.note ? ` · ${res.note}` : "") +
          ` · signaling=${session.channel instanceof WebSocket ? "ws" : "mock"}`,
      );
    } catch (e) {
      setCallNote(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }

  async function shareScreen() {
    const gate = probeDisplayMedia();
    if (!gate.available) {
      setCallNote((prev) => `${prev ?? ""} · ${t("chat.screenShareUnavailable")} (${gate.reason})`);
      return;
    }
    if (!callRef.current) {
      await startCall();
    }
    if (!callRef.current) return;
    try {
      await startScreenShare(callRef.current.pc);
      // Signal screen renegotiation over DO (getDisplayMedia itself is browser-gated).
      await callRef.current.sendScreenOffer();
      setCallNote((prev) => `${prev ?? ""} · screen-share-on · screen-offer`);
    } catch (e) {
      setCallNote(e instanceof Error ? e.message : "screen_share_failed");
    }
  }

  const screenShareReady = canStartScreenShare();

  async function endScreen() {
    if (!callRef.current) return;
    await stopScreenShare(callRef.current.pc, callRef.current.localStream);
    callRef.current.sendScreenStop();
    setCallNote((prev) => `${prev ?? ""} · screen-share-off`);
  }

  function hangup() {
    callRef.current?.close();
    callRef.current = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    setCallNote((prev) => `${prev ?? ""} · hung-up`);
  }

  function convoLabel(c: Conversation) {
    if (isCoworkerAssemblyConversationTitle(c.title)) return t("home.assembly.title");
    return c.title || (c.kind === "group" ? t("chat.group") : t("chat.dm"));
  }

  return (
    <div className="panel chat-home" data-testid="home-chat-panel">
      <div className="chat-home-header">
        <div>
          <h2 style={{ marginBottom: "0.2rem" }}>{t("home.messages")}</h2>
          <p className="muted" style={{ margin: 0 }}>
            {t("chat.inboxHint")}
          </p>
        </div>
        {!selected && (
          <div className="toolbar" style={{ margin: 0 }}>
            <button
              type="button"
              className="btn ghost"
              data-testid="chat-discover-open"
              onClick={() => setSheet("discover")}
            >
              {t("chat.discoverFriends")}
            </button>
            <button
              type="button"
              className="btn"
              data-testid="chat-compose-open"
              onClick={() => {
                setKind("group");
                setSheet("compose");
              }}
            >
              {t("chat.createGroup")}
            </button>
          </div>
        )}
      </div>
      {note && <p className="muted">{humanizeStatus(t, note)}</p>}

      {selected ? (
        <>
          <div className="toolbar">
            <button
              type="button"
              className="btn ghost"
              data-testid="chat-back-list"
              onClick={() => setSelectedId(null)}
            >
              {t("chat.backToList")}
            </button>
            <strong>{convoLabel(selected)}</strong>
          </div>

          <div className="field" style={{ marginTop: "0.75rem" }}>
            <label>{t("chat.disappearing")}</label>
            <select
              value={selected.disappearingTtlSec ?? ""}
              disabled={busy || selected.membership.role !== "owner"}
              onChange={(e) => {
                const raw = e.target.value;
                void patchTtl(raw === "" ? null : Number(raw));
              }}
            >
              {TTL_OPTIONS.map((opt) => (
                <option key={String(opt.value)} value={opt.value ?? ""}>
                  {t(opt.labelKey)}
                </option>
              ))}
            </select>
          </div>

          <div className="toolbar">
            <button type="button" className="btn ghost" disabled={busy} onClick={() => void startCall()}>
              {t("chat.call")}
            </button>
            <button
              type="button"
              className="btn ghost"
              disabled={busy || !screenShareReady}
              title={screenShareReady ? undefined : t("chat.screenShareUnavailable")}
              onClick={() => void shareScreen()}
            >
              {t("chat.screenShare")}
            </button>
            <button type="button" className="btn ghost" disabled={busy} onClick={() => void endScreen()}>
              {t("chat.stopShare")}
            </button>
            <button type="button" className="btn ghost" onClick={hangup}>
              {t("chat.hangup")}
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => void archiveConversation(!selected.membership.archived)}
            >
              {selected.membership.archived ? t("chat.unarchive") : t("chat.archive")}
            </button>
          </div>
          {callNote && <p className="muted">{callNote}</p>}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            muted={false}
            style={{ width: "100%", maxHeight: 240, background: "#18232b" }}
          />

          <div className="chat-thread">
            {messages.length === 0 && <p className="muted">{t("chat.noMessages")}</p>}
            {messages.map((m) => (
              <div key={m.id} className="chat-bubble">
                <p className="chat-bubble-text">{plaintexts[m.id] ?? t("common.loading")}</p>
                <div className="muted" style={{ fontSize: "0.8rem", marginTop: "0.25rem" }}>
                  {new Date(m.createdAt).toLocaleString()}
                  {m.expiresAt
                    ? ` · ${t("chat.disappearing")} ${new Date(m.expiresAt).toLocaleString()}`
                    : ""}
                </div>
                <button type="button" className="btn ghost" onClick={() => void favoriteMessage(m)}>
                  {t("chat.favorite")}
                </button>
              </div>
            ))}
          </div>

          <div className="field">
            <label>{t("chat.message")}</label>
            <textarea rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} />
          </div>
          <button type="button" className="btn" disabled={busy} onClick={() => void sendMessage()}>
            {t("chat.send")}
          </button>
        </>
      ) : (
        <>
          <div className="plans-tabs" role="tablist" data-testid="chat-list-tabs">
            {(
              [
                ["friends", "chat.tabFriends"],
                ["chats", "chat.tabChats"],
                ["archived", "chat.tabArchived"],
              ] as const
            ).map(([id, key]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={listTab === id}
                className={`plans-tab${listTab === id ? " is-active" : ""}`}
                data-testid={`chat-tab-${id}`}
                onClick={() => setListTab(id)}
              >
                {t(key)}
              </button>
            ))}
          </div>

          {listTab === "friends" && (
            <ul className="list" data-testid="chat-friends-list">
              {friends.length === 0 && <li className="muted">{t("chat.friendsEmpty")}</li>}
              {friends.map((f) => (
                <li key={f.userId}>
                  <button
                    type="button"
                    className="convo-row"
                    onClick={() => void openOrStartDm(f.userId)}
                  >
                    <strong>{f.label}</strong>
                    <div className="muted">{f.userId}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {listTab === "chats" && (
            <ul className="list" data-testid="chat-active-list">
              {activeConversations.length === 0 && <li className="muted">{t("chat.empty")}</li>}
              {activeConversations.map((c) => (
                <li key={c.id}>
                  <button type="button" className="convo-row" onClick={() => setSelectedId(c.id)}>
                    <strong>{convoLabel(c)}</strong>
                    <div className="muted">
                      {c.kind === "group" ? t("chat.group") : t("chat.dm")}
                      {c.disappearingTtlSec
                        ? ` · ${t("chat.disappearing")} ${Math.round(c.disappearingTtlSec / 3600)}h`
                        : ""}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {listTab === "archived" && (
            <ul className="list" data-testid="chat-archived-list">
              {archivedConversations.length === 0 && (
                <li className="muted">{t("chat.archivedEmpty")}</li>
              )}
              {archivedConversations.map((c) => (
                <li key={c.id}>
                  <button type="button" className="convo-row" onClick={() => setSelectedId(c.id)}>
                    <strong>{convoLabel(c)}</strong>
                    <div className="muted">{t("chat.archived")}</div>
                  </button>
                </li>
              ))}
              {favorites.length > 0 && (
                <li className="muted">
                  {t("chat.favorites")}: {favorites.length}
                </li>
              )}
            </ul>
          )}
        </>
      )}

      {sheet !== "none" && (
        <div
          className="chat-sheet-backdrop"
          role="presentation"
          onClick={() => setSheet("none")}
        >
          <div
            className="chat-sheet"
            role="dialog"
            aria-modal="true"
            data-testid={sheet === "discover" ? "chat-discover-sheet" : "chat-compose-sheet"}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="chat-sheet-head">
              <h3 style={{ margin: 0 }}>
                {sheet === "discover" ? t("chat.discoverFriends") : t("chat.createGroup")}
              </h3>
              <button type="button" className="btn ghost" onClick={() => setSheet("none")}>
                ✕
              </button>
            </div>

            {sheet === "discover" && (
              <>
                <p className="muted">{t("chat.discoverHint")}</p>
                <div className="field">
                  <label>{t("me.searchUid")}</label>
                  <input
                    value={discoverQ}
                    onChange={(e) => setDiscoverQ(e.target.value)}
                    placeholder={t("me.searchUid")}
                    data-testid="chat-discover-input"
                  />
                </div>
                <button type="button" className="btn" disabled={busy} onClick={() => void discoverUsers()}>
                  {t("me.search")}
                </button>
                <ul className="list" style={{ marginTop: "0.75rem" }}>
                  {discoverHits.length === 0 && <li className="muted">{t("chat.discoverEmpty")}</li>}
                  {discoverHits.map((hit) => (
                    <li key={hit.id}>
                      <button
                        type="button"
                        className="convo-row"
                        data-testid={`chat-discover-hit-${hit.uid}`}
                        onClick={() => void openOrStartDm(hit.id)}
                      >
                        <strong>{hit.nickname || hit.uid}</strong>
                        <div className="muted">UID {hit.uid}</div>
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="btn ghost"
                  style={{ marginTop: "0.5rem" }}
                  onClick={() => {
                    setKind("dm");
                    setSheet("compose");
                  }}
                >
                  {t("chat.newDmById")}
                </button>
              </>
            )}

            {sheet === "compose" && (
              <>
                <div className="field">
                  <label>{t("chat.newConversation")}</label>
                  <select value={kind} onChange={(e) => setKind(e.target.value as "dm" | "group")}>
                    <option value="dm">{t("chat.dm")}</option>
                    <option value="group">{t("chat.group")}</option>
                  </select>
                </div>
                {kind === "group" && (
                  <div className="field">
                    <label>{t("chat.title")}</label>
                    <input value={title} onChange={(e) => setTitle(e.target.value)} />
                  </div>
                )}
                <div className="field">
                  <label>{t("chat.members")}</label>
                  <input
                    value={memberIds}
                    onChange={(e) => setMemberIds(e.target.value)}
                    placeholder={t("chat.selfNote")}
                    data-testid="chat-compose-members"
                  />
                </div>
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  data-testid="chat-compose-create"
                  onClick={() => void createConversation()}
                >
                  {t("chat.create")}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
