import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  deriveSessionKey,
  decryptSessionPayload,
  encryptSessionPayload,
} from "@logoshome/crypto";
import { api, getToken } from "../lib/api";
import { decryptChatMessage, encryptChatMessage } from "../lib/secure-chat";
import { humanizeStatus } from "../lib/status";
import {
  attachLocalMedia,
  createOffer,
  createPeerConnection,
  openSignalingChannel,
  startScreenShare,
  stopScreenShare,
  type PeerCallbacks,
} from "../lib/webrtc";

type Conversation = {
  id: string;
  kind: "dm" | "group";
  title: string | null;
  disappearingTtlSec: number | null;
  createdBy: string;
  createdAt: number;
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
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  const refreshConversations = useCallback(async () => {
    if (!getToken()) {
      setNote("login_required");
      return;
    }
    const res = await api<{ conversations: Conversation[] }>("/v1/chat/conversations");
    setConversations(res.conversations);
    setNote(null);
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    const res = await api<{ messages: ChatMessage[] }>(
      `/v1/chat/conversations/${conversationId}/messages`,
    );
    setMessages(res.messages);
    const key = await sessionKeyFor(conversationId);
    const decoded: Record<string, string> = {};
    for (const m of res.messages) {
      try {
        decoded[m.id] = await decryptChatMessage(conversationId, m.ratchetHeader, m.ciphertext);
      } catch {
        try {
          decoded[m.id] = await decryptSessionPayload(key, m.ratchetHeader, m.ciphertext);
        } catch {
          decoded[m.id] = localStorage.getItem(`lh.msg.${m.id}`) ?? "[ciphertext]";
        }
      }
    }
    setPlaintexts(decoded);
  }, []);

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

  async function createConversation() {
    if (!getToken()) {
      setNote("login_required");
      return;
    }
    setBusy(true);
    try {
      const ids = memberIds
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (ids.length === 0) {
        setNote("members_required");
        return;
      }
      const res = await api<{ id: string }>("/v1/chat/conversations", {
        method: "POST",
        body: JSON.stringify({
          kind,
          title: kind === "group" ? title || undefined : undefined,
          memberIds: ids,
        }),
      });
      setMemberIds("");
      setTitle("");
      await refreshConversations();
      setSelectedId(res.id);
      setNote(null);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage() {
    if (!selectedId || !draft.trim()) return;
    setBusy(true);
    try {
      const text = draft.trim();
      const enc = await encryptChatMessage(selectedId, text);
      const expiresAt = selected?.disappearingTtlSec
        ? Date.now() + selected.disappearingTtlSec * 1000
        : undefined;
      const res = await api<{ id: string }>(`/v1/chat/conversations/${selectedId}/messages`, {
        method: "POST",
        body: JSON.stringify({
          ratchetHeader: enc.ratchetHeader,
          ciphertext: enc.ciphertext,
          contentType: "msg",
          expiresAt,
        }),
      });
      localStorage.setItem(`lh.msg.${res.id}`, text);
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
          username: string;
          credential: string;
          uris: string[];
          ttl: number;
        }>("/v1/calls/turn-credentials", { method: "POST", body: "{}" });
        iceServers = [
          ...iceServers,
          { urls: turn.uris, username: turn.username, credential: turn.credential },
        ];
        setCallNote(`TURN ttl=${turn.ttl}s · ${turn.uris.join(",")}`);
      } catch {
        /* STUN-only fallback */
      }
      const token = getToken();
      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      const wsUrl = token
        ? `${proto}://${window.location.host}${res.signalingPath}?token=${encodeURIComponent(token)}&conversationId=${encodeURIComponent(selectedId)}`
        : null;
      const channel = openSignalingChannel(wsUrl);
      const sendSignal = (msg: object) => {
        const raw = JSON.stringify(msg);
        if (channel instanceof WebSocket && channel.readyState === WebSocket.OPEN) {
          channel.send(raw);
        } else if (!(channel instanceof WebSocket) && "send" in channel) {
          (channel as { send: (m: never) => void }).send(msg as never);
        }
      };
      const callbacks: PeerCallbacks = {
        onLocalDescription: (desc) => {
          if (desc.type === "offer") sendSignal({ type: "offer", sdp: desc.sdp });
          if (desc.type === "answer") sendSignal({ type: "answer", sdp: desc.sdp });
        },
        onIceCandidate: (cand) => sendSignal({ type: "ice", candidate: cand?.toJSON() ?? null }),
      };
      const pc = createPeerConnection(callbacks, { iceServers });
      pcRef.current = pc;
      localStreamRef.current = await attachLocalMedia(pc, { audio: true, video: true });
      await createOffer(pc, callbacks);
      setCallNote(
        (prev) =>
          `${prev ? `${prev} · ` : ""}${t("chat.callStarted")}: ${res.callId} · ${res.signalingPath}` +
          (res.note ? ` · ${res.note}` : "") +
          ` · signaling=${channel instanceof WebSocket ? "ws" : "mock"}`,
      );
    } catch (e) {
      setCallNote(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }

  async function shareScreen() {
    if (!pcRef.current) {
      await startCall();
    }
    if (!pcRef.current) return;
    try {
      await startScreenShare(pcRef.current);
      setCallNote((prev) => `${prev ?? ""} · screen-share-on`);
    } catch (e) {
      setCallNote(e instanceof Error ? e.message : "screen_share_failed");
    }
  }

  async function endScreen() {
    if (!pcRef.current) return;
    await stopScreenShare(pcRef.current, localStreamRef.current);
    setCallNote((prev) => `${prev ?? ""} · screen-share-off`);
  }

  return (
    <div className="panel">
      <h2 style={{ marginTop: 0 }}>{t("home.messages")}</h2>
      <p className="muted">
        AES-GCM session crypto · {t("chat.disappearing")} · {t("chat.call")}
      </p>
      {note && <p className="muted">{humanizeStatus(t, note)}</p>}

      <div className="field">
        <label>{t("chat.newConversation")}</label>
        <div className="toolbar">
          <select value={kind} onChange={(e) => setKind(e.target.value as "dm" | "group")}>
            <option value="dm">{t("chat.dm")}</option>
            <option value="group">{t("chat.group")}</option>
          </select>
        </div>
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
          placeholder="user_…"
        />
      </div>
      <button type="button" className="btn" disabled={busy} onClick={() => void createConversation()}>
        {t("chat.create")}
      </button>

      <ul className="list" style={{ marginTop: "1rem" }}>
        {conversations.length === 0 && <li className="muted">{t("chat.empty")}</li>}
        {conversations.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              className="btn ghost"
              style={{ width: "100%", textAlign: "start" }}
              onClick={() => setSelectedId(c.id)}
            >
              <strong>{c.title || c.kind}</strong>
              <div className="muted">
                {c.id}
                {c.disappearingTtlSec ? ` · TTL ${c.disappearingTtlSec}s` : ""}
                {c.membership.archived ? " · archived" : ""}
                {selectedId === c.id ? ` · ${t("chat.selected")}` : ""}
              </div>
            </button>
          </li>
        ))}
      </ul>

      {favorites.length > 0 && (
        <p className="muted">
          {t("chat.favorites")}: {favorites.length}
        </p>
      )}

      {selected && (
        <>
          <div className="field" style={{ marginTop: "1rem" }}>
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
            <button type="button" className="btn ghost" disabled={busy} onClick={() => void shareScreen()}>
              {t("chat.screenShare")}
            </button>
            <button type="button" className="btn ghost" disabled={busy} onClick={() => void endScreen()}>
              Stop share
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => void archiveConversation(!selected.membership.archived)}
            >
              {selected.membership.archived ? "Unarchive" : t("chat.archive")}
            </button>
          </div>
          {callNote && <p className="muted">{callNote}</p>}

          <ul className="list">
            {messages.length === 0 && <li className="muted">{t("chat.noMessages")}</li>}
            {messages.map((m) => (
              <li key={m.id}>
                <div>{plaintexts[m.id] ?? "…"}</div>
                <div className="muted">
                  {new Date(m.createdAt).toLocaleString()}
                  {m.expiresAt ? ` · exp ${new Date(m.expiresAt).toLocaleString()}` : ""}
                </div>
                <button type="button" className="btn ghost" onClick={() => void favoriteMessage(m)}>
                  {t("chat.favorite")}
                </button>
              </li>
            ))}
          </ul>

          <div className="field">
            <label>{t("chat.message")}</label>
            <textarea rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} />
          </div>
          <button type="button" className="btn" disabled={busy} onClick={() => void sendMessage()}>
            {t("chat.send")}
          </button>
        </>
      )}
    </div>
  );
}
