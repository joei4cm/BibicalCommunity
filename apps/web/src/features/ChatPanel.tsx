import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  deriveSessionKey,
  decryptSessionPayload,
  encryptSessionPayload,
} from "@logoshome/crypto";
import { isCoworkerAssemblyConversationTitle } from "@logoshome/shared";
import { api, apiWsUrl, getToken } from "../lib/api";
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
import { SheetPortal } from "../components/SheetPortal";
import { EmojiPicker } from "../components/EmojiPicker";
import { CallOverlay, type CallPhase } from "../components/CallOverlay";
import {
  encodeChatPayload,
  parseChatPayload,
  payloadPreview,
  type ChatPayload,
} from "../lib/chat-payload";

type ConversationKind = "dm" | "group" | "seminar";

type Conversation = {
  id: string;
  kind: ConversationKind;
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

export function ChatPanel({
  initialPeer,
  onPeerConsumed,
  onThreadOpenChange,
}: {
  initialPeer?: string | null;
  onPeerConsumed?: () => void;
  onThreadOpenChange?: (open: boolean) => void;
} = {}) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [plaintexts, setPlaintexts] = useState<Record<string, string>>({});
  const [kind, setKind] = useState<ConversationKind>("dm");
  const [title, setTitle] = useState("");
  const [memberIds, setMemberIds] = useState("");
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [callNote, setCallNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [favorites, setFavorites] = useState<{ id: string; messageId: string }[]>([]);
  const [selfUserId, setSelfUserId] = useState<string | null>(null);
  const [listTab, setListTab] = useState<"dm" | "group" | "seminar" | "archived">("dm");
  const [sheet, setSheet] = useState<"none" | "discover" | "compose">("none");
  const [discoverQ, setDiscoverQ] = useState("");
  const [discoverHits, setDiscoverHits] = useState<
    { id: string; uid: string; nickname: string | null }[]
  >([]);
  const [peerLabels, setPeerLabels] = useState<Record<string, string>>({});
  const [directory, setDirectory] = useState<
    { userId: string; uid: string | null; nickname: string | null }[]
  >([]);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [listQuery, setListQuery] = useState("");
  const [callOpen, setCallOpen] = useState(false);
  const [callPhase, setCallPhase] = useState<CallPhase>("idle");
  const [callVideo, setCallVideo] = useState(false);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set());
  const callRef = useRef<CallSession | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const mediaLoadedRef = useRef<Set<string>>(new Set());
  const selfDeviceId = useMemo(() => localStorage.getItem("lh.deviceId"), []);

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  useEffect(() => {
    onThreadOpenChange?.(Boolean(selectedId));
    return () => onThreadOpenChange?.(false);
  }, [selectedId, onThreadOpenChange]);

  const activeConversations = useMemo(
    () => conversations.filter((c) => !c.membership.archived),
    [conversations],
  );
  const archivedConversations = useMemo(
    () => conversations.filter((c) => c.membership.archived),
    [conversations],
  );
  const filteredActive = useMemo(() => {
    if (listTab === "archived") return [];
    return activeConversations.filter((c) => c.kind === listTab);
  }, [activeConversations, listTab]);

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

  useEffect(() => {
    if (!getToken()) return;
    void Promise.all([
      api<{
        contacts: {
          userId: string;
          uid: string | null;
          nickname: string | null;
          source: "directory" | "friend";
        }[];
      }>("/v1/friends/directory"),
      api<{ friends: { user: { id: string } }[] }>("/v1/friends").catch(() => ({ friends: [] })),
    ])
      .then(([dir, fr]) => {
        const map: Record<string, string> = {};
        for (const c of dir.contacts) {
          map[c.userId] = c.nickname || c.uid || c.userId.slice(0, 10);
        }
        setPeerLabels(map);
        setDirectory(dir.contacts);
        setFriendIds(
          new Set([
            ...dir.contacts.filter((c) => c.source === "friend").map((c) => c.userId),
            ...fr.friends.map((f) => f.user.id),
          ]),
        );
      })
      .catch(() => {
        /* directory is optional for labels */
      });
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
          setListTab("dm");
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
          setListTab("dm");
        }
        onPeerConsumed?.();
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
  }, [peerFromQuery, setSearchParams, onPeerConsumed]);

  // Allow parent to nudge a peer open without relying solely on the URL effect race.
  useEffect(() => {
    if (!initialPeer || peerFromQuery) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("peer", initialPeer);
        return next;
      },
      { replace: true },
    );
  }, [initialPeer, peerFromQuery, setSearchParams]);

  useEffect(() => {
    if (!conversationFromQuery || !getToken()) return;
    let cancelled = false;
    void (async () => {
      try {
        const resList = await api<{ conversations: Conversation[] }>("/v1/chat/conversations");
        if (cancelled) return;
        setConversations(resList.conversations);
        const found = resList.conversations.find((c) => c.id === conversationFromQuery);
        if (found) {
          setSelectedId(conversationFromQuery);
          setListTab(
            found.kind === "group" || found.kind === "seminar" || found.kind === "dm"
              ? found.kind
              : "dm",
          );
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
              selfUserId,
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

  async function createConversation(explicitIds?: string[], explicitKind?: ConversationKind) {
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
          title: useKind === "dm" ? undefined : title || undefined,
          memberIds: ids,
        }),
      });
      setMemberIds("");
      setTitle("");
      setSheet("none");
      await refreshConversations();
      setSelectedId(res.id);
      setListTab(useKind);
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
    if (!friendIds.has(userId)) {
      setNote("friends_required");
      return;
    }
    const existing = conversations.find(
      (c) => c.kind === "dm" && (c.peerUserIds ?? []).includes(userId),
    );
    if (existing) {
      setSelectedId(existing.id);
      setSheet("none");
      setListTab("dm");
      return;
    }
    await createConversation([userId], "dm");
  }

  async function sendEncryptedPayload(payload: ChatPayload) {
    if (!selectedId) return;
    const plaintext = encodeChatPayload(payload);
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
        plaintext,
        fromUserId: selfUserId,
        peerUserIds: peers,
        expiresAt,
      });
      ratchetHeader = fanout.ratchetHeader;
      ciphertext = fanout.ciphertext;
      mode = fanout.degradedPeers.length > 0 ? "degraded" : "group-fanout";
    } else {
        const enc = await encryptChatMessage(
          selectedId,
          plaintext,
          peers[0] ?? null,
          selfUserId,
        );
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
    localStorage.setItem(`lh.msg.${res.id}`, plaintext);
    // Degraded still decrypts peer-to-peer after v2 seed fix; keep a soft hint only.
    if (mode === "degraded") {
      setNote("chat_degraded_soft");
    } else {
      setNote(null);
    }
    await loadMessages(selectedId);
  }

  async function sendMessage() {
    if (!selectedId || !draft.trim()) return;
    if (
      selected?.kind === "dm" &&
      selected.peerUserIds?.[0] &&
      !friendIds.has(selected.peerUserIds[0])
    ) {
      setNote("friends_required");
      return;
    }
    setBusy(true);
    try {
      const text = draft.trim();
      setDraft("");
      setEmojiOpen(false);
      await sendEncryptedPayload({ v: 1, kind: "text", text });
    } catch (e) {
      setNote(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }

  async function sendAttachment(file: File) {
    if (!selectedId || !getToken()) return;
    setBusy(true);
    try {
      const minted = await api<{ key: string; putUrl: string }>("/v1/media/upload-url", {
        method: "POST",
      });
      const putRes = await fetch(minted.putUrl, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${getToken()}`,
          "Content-Type": file.type || "application/octet-stream",
        },
        body: file,
      });
      if (!putRes.ok) throw new Error("media_upload_failed");
      const caption = draft.trim();
      setDraft("");
      setEmojiOpen(false);
      await sendEncryptedPayload({
        v: 1,
        kind: "media",
        mediaKey: minted.key,
        mime: file.type || "application/octet-stream",
        name: file.name || "file",
        text: caption || undefined,
      });
    } catch (e) {
      setNote(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function insertEmoji(emoji: string) {
    const el = composerRef.current;
    if (!el) {
      setDraft((prev) => prev + emoji);
      return;
    }
    const start = el.selectionStart ?? draft.length;
    const end = el.selectionEnd ?? draft.length;
    const next = draft.slice(0, start) + emoji + draft.slice(end);
    setDraft(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + emoji.length;
      el.setSelectionRange(pos, pos);
    });
  }

  useEffect(() => {
    const keys = [
      ...new Set(
        Object.values(plaintexts)
          .map((raw) => parseChatPayload(raw))
          .filter((p): p is Extract<ChatPayload, { kind: "media" }> => p?.kind === "media")
          .map((p) => p.mediaKey),
      ),
    ].filter((k) => !mediaLoadedRef.current.has(k));
    if (keys.length === 0 || !getToken()) return;
    let cancelled = false;
    void (async () => {
      for (const key of keys) {
        mediaLoadedRef.current.add(key);
        try {
          const res = await fetch(`/v1/media/${encodeURIComponent(key)}`, {
            headers: { Authorization: `Bearer ${getToken()}` },
          });
          if (!res.ok || cancelled) continue;
          const blob = await res.blob();
          if (cancelled) return;
          const url = URL.createObjectURL(blob);
          setMediaUrls((prev) => ({ ...prev, [key]: url }));
        } catch {
          mediaLoadedRef.current.delete(key);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [plaintexts]);

  async function favoriteMessage(m: ChatMessage) {
    const text = payloadPreview(plaintexts[m.id], plaintexts[m.id] ?? "");
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

  async function prepareIce(): Promise<RTCIceServer[]> {
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
          ? t("chat.callRelayOn")
          : `${t("chat.turnRelayMissing")}`,
      );
    } catch {
      /* STUN-only fallback */
    }
    return iceServers;
  }

  async function startCall(asAnswerer = false) {
    if (!selectedId) return;
    setBusy(true);
    setCallNote(null);
    setCallOpen(true);
    setCallPhase(asAnswerer ? "incoming" : "outgoing");
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
      const iceServers = await prepareIce();
      const token = getToken();
      const wsUrl = token
        ? apiWsUrl(
            `${res.signalingPath}?token=${encodeURIComponent(token)}&conversationId=${encodeURIComponent(selectedId)}`,
          )
        : null;
      const session = await startCallSession({
        wsUrl,
        iceServers,
        role: asAnswerer ? "callee" : "caller",
        video: callVideo,
        onRemoteStream: (stream) => {
          setRemoteStream(stream);
          setCallPhase("connected");
        },
        onNote: (m) => {
          if (m === "answered-remote-offer" || m === "got-remote-answer") setCallPhase("connected");
          if (m === "peer-ring" && !asAnswerer) return;
          if (m === "peer-ring") {
            setCallOpen(true);
            setCallPhase("incoming");
            return;
          }
          if (m === "peer-hangup") {
            hangup();
            return;
          }
          setCallNote((prev) => `${prev ?? ""} · ${m}`);
        },
      });
      callRef.current = session;
      setLocalStream(session.localStream);
      if (!asAnswerer) setCallPhase("outgoing");
    } catch (e) {
      setCallNote(e instanceof Error ? e.message : "error");
      setCallPhase("idle");
      setCallOpen(false);
    } finally {
      setBusy(false);
    }
  }

  // Keep a light listen socket on the deterministic call room while a thread is open.
  useEffect(() => {
    if (!selectedId || !getToken() || callOpen) return;
    let closed = false;
    let sock: WebSocket | null = null;
    void (async () => {
      try {
        const res = await api<{ signalingPath: string }>("/v1/chat/calls", {
          method: "POST",
          body: JSON.stringify({ conversationId: selectedId }),
        });
        if (closed) return;
        const url = apiWsUrl(
          `${res.signalingPath}?token=${encodeURIComponent(getToken()!)}&conversationId=${encodeURIComponent(selectedId)}`,
        );
        sock = new WebSocket(url);
        sock.onmessage = (ev) => {
          try {
            const msg = JSON.parse(String(ev.data)) as { type?: string };
            if (msg.type === "ring" || msg.type === "offer") {
              setCallOpen(true);
              setCallPhase("incoming");
            }
          } catch {
            /* ignore */
          }
        };
      } catch {
        /* listen optional */
      }
    })();
    return () => {
      closed = true;
      sock?.close();
    };
  }, [selectedId, callOpen]);

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
    setRemoteStream(null);
    setLocalStream(null);
    setCallOpen(false);
    setCallPhase("idle");
    setCallNote(null);
  }

  function kindLabel(k: ConversationKind) {
    if (k === "seminar") return t("comms.seminar");
    if (k === "group") return t("chat.group");
    return t("chat.dm");
  }

  function convoLabel(c: Conversation) {
    if (isCoworkerAssemblyConversationTitle(c.title)) return t("home.assembly.title");
    if (c.title) return c.title;
    if (c.kind === "dm") {
      const peer = (c.peerUserIds ?? [])[0];
      if (peer && peerLabels[peer]) return peerLabels[peer];
      if (peer) return peer.slice(0, 10);
    }
    return kindLabel(c.kind);
  }

  function avatarLetter(label: string) {
    const s = label.trim();
    return s ? s.slice(0, 1).toUpperCase() : "?";
  }

  const visibleConversations = useMemo(() => {
    const q = listQuery.trim().toLowerCase();
    const rows = listTab === "archived" ? archivedConversations : filteredActive;
    if (!q) return rows;
    return rows.filter((c) => {
      const label = convoLabel(c).toLowerCase();
      return label.includes(q);
    });
  }, [archivedConversations, filteredActive, listQuery, listTab, peerLabels, t]);

  const dmPeerBlocked =
    selected?.kind === "dm" &&
    Boolean(selected.peerUserIds?.[0]) &&
    !friendIds.has(selected.peerUserIds![0]!);

  return (
    <div className={`chat-home im-shell${selected ? " is-thread" : ""}`} data-testid="home-chat-panel">
      <CallOverlay
        open={callOpen}
        phase={callPhase}
        peerLabel={selected ? convoLabel(selected) : "…"}
        note={callNote}
        localStream={localStream}
        remoteStream={remoteStream}
        video={callVideo}
        onAccept={() => void startCall(true)}
        onHangup={hangup}
        onToggleVideo={() => setCallVideo((v) => !v)}
      />
      {note && !selected && <p className="muted im-note">{humanizeStatus(t, note)}</p>}

      {selected ? (
        <div className="im-thread" data-testid="im-thread">
          <header className="im-thread-bar">
            <button
              type="button"
              className="btn ghost im-back"
              data-testid="chat-back-list"
              onClick={() => setSelectedId(null)}
            >
              ←
            </button>
            <div className="im-thread-peer">
              <span className="im-avatar" aria-hidden>
                {avatarLetter(convoLabel(selected))}
              </span>
              <div className="im-thread-title">
                <strong>{convoLabel(selected)}</strong>
                {selected.kind !== "dm" && (
                  <span className="muted">{kindLabel(selected.kind)}</span>
                )}
              </div>
            </div>
            <button
              type="button"
              className="btn ghost im-call-btn"
              data-testid="chat-call"
              disabled={busy || dmPeerBlocked}
              aria-label={t("chat.call")}
              onClick={() => void startCall(false)}
            >
              📞
            </button>
            <details className="im-more">
              <summary className="btn ghost">···</summary>
              <div className="im-more-menu">
                <div className="field">
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
                <button
                  type="button"
                  className="btn ghost"
                  disabled={busy || !screenShareReady}
                  onClick={() => void shareScreen()}
                >
                  {t("chat.screenShare")}
                </button>
                <button type="button" className="btn ghost" disabled={busy} onClick={() => void endScreen()}>
                  {t("chat.stopShare")}
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => void archiveConversation(!selected.membership.archived)}
                >
                  {selected.membership.archived ? t("chat.unarchive") : t("chat.archive")}
                </button>
              </div>
            </details>
          </header>

          {dmPeerBlocked && (
            <p className="im-banner" data-testid="chat-friends-required">
              {t("chat.friendsRequired")}
            </p>
          )}

          <div className="im-messages chat-thread">
            {messages.length === 0 && <p className="muted im-empty">{t("chat.noMessages")}</p>}
            {messages.map((m) => {
              const payload = parseChatPayload(plaintexts[m.id]);
              const loading = plaintexts[m.id] == null;
              const mine = Boolean(selfDeviceId && m.senderDeviceId === selfDeviceId);
              return (
                <div key={m.id} className={`chat-bubble${mine ? " is-mine" : " is-peer"}`}>
                  {loading && <p className="chat-bubble-text">{t("common.loading")}</p>}
                  {!loading && payload?.kind === "media" && (
                    <div className="chat-media">
                      {payload.mime.startsWith("image/") && mediaUrls[payload.mediaKey] ? (
                        <img
                          className="chat-media-image"
                          src={mediaUrls[payload.mediaKey]}
                          alt={payload.name}
                        />
                      ) : payload.mime.startsWith("audio/") && mediaUrls[payload.mediaKey] ? (
                        <audio className="chat-media-audio" controls src={mediaUrls[payload.mediaKey]} />
                      ) : payload.mime.startsWith("video/") && mediaUrls[payload.mediaKey] ? (
                        <video className="chat-media-video" controls src={mediaUrls[payload.mediaKey]} />
                      ) : (
                        <a
                          className="chat-media-file"
                          href={mediaUrls[payload.mediaKey] || `#`}
                          download={payload.name}
                          onClick={(e) => {
                            if (!mediaUrls[payload.mediaKey]) e.preventDefault();
                          }}
                        >
                          📎 {payload.name}
                        </a>
                      )}
                      {payload.text ? <p className="chat-bubble-text">{payload.text}</p> : null}
                    </div>
                  )}
                  {!loading && payload?.kind === "text" && (
                    <p className="chat-bubble-text">{payload.text}</p>
                  )}
                  {!loading && !payload && (
                    <p className="chat-bubble-text muted">{plaintexts[m.id]}</p>
                  )}
                  <div className="muted im-bubble-meta">
                    {new Date(m.createdAt).toLocaleString()}
                    {m.expiresAt
                      ? ` · ${t("chat.disappearing")} ${new Date(m.expiresAt).toLocaleString()}`
                      : ""}
                  </div>
                </div>
              );
            })}
          </div>

          <footer className="im-composer">
            {note && <p className="muted im-note">{humanizeStatus(t, note)}</p>}
            <div className="im-composer-tools">
              <button
                type="button"
                className="btn ghost im-tool"
                data-testid="chat-attach-open"
                aria-label={t("chat.attach")}
                disabled={busy || dmPeerBlocked}
                onClick={() => fileInputRef.current?.click()}
              >
                ＋
              </button>
              <button
                type="button"
                className={`btn ghost im-tool${emojiOpen ? " is-active" : ""}`}
                data-testid="chat-emoji-open"
                aria-label={t("chat.emoji")}
                aria-expanded={emojiOpen}
                disabled={dmPeerBlocked}
                onClick={() => setEmojiOpen((v) => !v)}
              >
                😊
              </button>
              <input
                ref={fileInputRef}
                type="file"
                className="sr-only"
                accept="image/*,audio/*,video/*,.pdf,.txt,.doc,.docx"
                data-testid="chat-attach-input"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void sendAttachment(f);
                }}
              />
            </div>
            {emojiOpen && <EmojiPicker onPick={insertEmoji} />}
            <div className="im-composer-row">
              <textarea
                ref={composerRef}
                rows={1}
                className="im-composer-input"
                value={draft}
                placeholder={t("chat.message")}
                disabled={dmPeerBlocked}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendMessage();
                  }
                }}
              />
              <button
                type="button"
                className="btn im-send"
                disabled={busy || dmPeerBlocked || !draft.trim()}
                onClick={() => void sendMessage()}
              >
                {t("chat.send")}
              </button>
            </div>
          </footer>
        </div>
      ) : (
        <>
          <div className="im-list-head">
            <h2 className="im-list-title">{t("chat.tabChats")}</h2>
          </div>
          <label className="im-search">
            <span aria-hidden>⌕</span>
            <input
              value={listQuery}
              onChange={(e) => setListQuery(e.target.value)}
              placeholder={t("chat.search")}
              data-testid="chat-search"
            />
          </label>
          <div className="im-kind-tabs manage-subtabs" role="tablist" data-testid="chat-list-tabs">
            {(
              [
                ["dm", "chat.dm"],
                ["group", "chat.group"],
                ["seminar", "comms.seminar"],
                ["archived", "chat.tabArchived"],
              ] as const
            ).map(([id, key]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={listTab === id}
                className={`manage-subtab${listTab === id ? " is-active" : ""}`}
                data-testid={`chat-tab-${id}`}
                onClick={() => setListTab(id)}
              >
                {t(key)}
              </button>
            ))}
          </div>

          <ul
            className="list im-convo-list"
            data-testid={listTab === "archived" ? "chat-archived-list" : "chat-active-list"}
          >
            {visibleConversations.length === 0 && (
              <li className="muted">
                {listTab === "archived" ? t("chat.archivedEmpty") : t("chat.empty")}
              </li>
            )}
            {visibleConversations.map((c) => {
              const label = convoLabel(c);
              return (
                <li key={c.id}>
                  <button type="button" className="convo-row convo-row-rich" onClick={() => setSelectedId(c.id)}>
                    <span className="im-avatar" aria-hidden>
                      {avatarLetter(label)}
                    </span>
                    <span className="convo-row-main">
                      <strong>{label}</strong>
                      <span className="muted convo-row-preview">
                        {listTab === "archived"
                          ? t("chat.archived")
                          : c.kind !== "dm"
                            ? kindLabel(c.kind)
                            : t("chat.tapToOpen")}
                      </span>
                    </span>
                    <span className="muted convo-row-time">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </span>
                  </button>
                </li>
              );
            })}
            {listTab === "archived" && favorites.length > 0 && (
              <li className="muted">
                {t("chat.favorites")}: {favorites.length}
              </li>
            )}
          </ul>

          <button
            type="button"
            className="comms-fab"
            data-testid="chat-compose-open"
            aria-label={t("comms.newChat")}
            onClick={() => {
              setKind(listTab === "archived" ? "dm" : listTab);
              setSheet("compose");
            }}
          >
            +
          </button>
        </>
      )}

      {sheet !== "none" && (
        <SheetPortal>
        <div
          className="sheet-backdrop"
          role="presentation"
          onClick={() => setSheet("none")}
        >
          <div
            className="sheet-panel"
            role="dialog"
            aria-modal="true"
            data-testid={sheet === "discover" ? "chat-discover-sheet" : "chat-compose-sheet"}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sheet-handle" aria-hidden />
            <div className="chat-sheet-head">
              <h3 style={{ margin: 0 }}>
                {sheet === "discover" ? t("chat.discoverFriends") : t("comms.newChat")}
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
              </>
            )}

            {sheet === "compose" && (
              <>
                <div className="field">
                  <label>{t("chat.newConversation")}</label>
                  <select
                    value={kind}
                    onChange={(e) => setKind(e.target.value as ConversationKind)}
                    data-testid="chat-compose-kind"
                  >
                    <option value="dm">{t("chat.dm")}</option>
                    <option value="group">{t("chat.group")}</option>
                    <option value="seminar">{t("comms.seminar")}</option>
                  </select>
                </div>
                {kind === "dm" ? (
                  <>
                    <p className="muted" style={{ marginTop: 0 }}>
                      {t("chat.discoverHint")}
                    </p>
                    <ul className="list" data-testid="chat-compose-contacts">
                      {directory.length === 0 && (
                        <li className="muted">{t("chat.discoverEmpty")}</li>
                      )}
                      {directory.map((c) => (
                        <li key={c.userId}>
                          <button
                            type="button"
                            className="convo-row"
                            data-testid={`chat-compose-contact-${c.uid || c.userId}`}
                            onClick={() => void openOrStartDm(c.userId)}
                          >
                            <strong>{c.nickname || c.uid || c.userId.slice(0, 10)}</strong>
                            {c.uid ? <div className="muted">UID {c.uid}</div> : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      className="btn ghost"
                      data-testid="chat-compose-search-switch"
                      onClick={() => setSheet("discover")}
                    >
                      {t("chat.discoverFriends")}
                    </button>
                  </>
                ) : (
                  <>
                    <div className="field">
                      <label>{t("chat.title")}</label>
                      <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder={kind === "seminar" ? t("comms.seminarTitleHint") : undefined}
                      />
                    </div>
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
              </>
            )}
          </div>
        </div>
        </SheetPortal>
      )}
    </div>
  );
}
