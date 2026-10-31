import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  decryptSessionPayload,
  deriveSessionKey,
  encryptSessionPayload,
} from "@logoshome/crypto";
import { isCoworkerAssemblyConversationTitle, messageReceiptState } from "@logoshome/shared";
import { api, apiUrl, getToken } from "../lib/api";
import { decryptChatMessage, encryptChatMessage, ensureRatchet } from "../lib/secure-chat";
import { decodeStoredChatMessage } from "../lib/chat-decode";
import {
  readCachedConversations,
  readChatPreviews,
  readPlainSync,
  readThread,
  writeCachedConversations,
  writeChatPreview,
  writePlainSync,
  writeThread,
} from "../lib/chat-local";
import { fetchConversationsList } from "../lib/conversations-fetch";
import { encryptGroupFanout } from "../lib/group-fanout";
import { humanizeStatus } from "../lib/status";
import { peerHasProductKeys } from "../lib/product-signal-chat";
import { hasLocalDeviceKeys, uploadDeviceKeyBundle } from "../lib/upload-device-keys";
import { SheetPortal } from "../components/SheetPortal";
import { EmojiPicker } from "../components/EmojiPicker";
import { ChatVerseText } from "../components/ChatVerseText";
import { useCall } from "./CallProvider";
import {
  IconCheck,
  IconCheckRead,
  IconChevronLeft,
  IconEmoji,
  IconMore,
  IconPaperclip,
  IconPhone,
  IconPlus,
  IconSearch,
  IconSend,
} from "../components/icons";
import {
  encodeChatPayload,
  formatCallDuration,
  parseChatPayload,
  payloadPreview,
  type ChatPayload,
} from "../lib/chat-payload";
import {
  labelFromPeer,
  loadPeerLabelCache,
  mergePeerLabels,
} from "../lib/peer-labels";

function readerTranslationId(): string {
  try {
    return localStorage.getItem("lh.bible.translation") ?? "cuvs";
  } catch {
    return "cuvs";
  }
}

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
  /** Server-enriched peer labels (avoids UID flash while friends load). */
  peers?: { userId: string; uid: string; nickname: string | null }[];
  unreadCount?: number;
  /** Latest non-tombstoned message time (falls back to createdAt). */
  lastMessageAt?: number;
  /** Latest peer lastReadAt when they share read receipts (WhatsApp-style ticks). */
  peerLastReadAt?: number | null;
  membership: { id: string; role: string; archived: boolean; lastReadAt?: number | null };
};

type ChatMessage = {
  id: string;
  senderDeviceId: string;
  senderUserId?: string | null;
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
  onBadgesMaybeChanged,
}: {
  initialPeer?: string | null;
  onPeerConsumed?: () => void;
  onThreadOpenChange?: (open: boolean) => void;
  onBadgesMaybeChanged?: () => void;
} = {}) {
  const { t } = useTranslation();
  const { startOutboundCall, shareScreen, endScreen, screenShareReady, callSessionActive } = useCall();
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>(() =>
    readCachedConversations<Conversation>(),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [plaintexts, setPlaintexts] = useState<Record<string, string>>({});
  const [kind, setKind] = useState<ConversationKind>("dm");
  const [title, setTitle] = useState("");
  const [groupPick, setGroupPick] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [favorites, setFavorites] = useState<
    { id: string; messageId: string; preview?: string; createdAt?: number }[]
  >([]);
  const [favoriteBusyId, setFavoriteBusyId] = useState<string | null>(null);
  const [selfUserId, setSelfUserId] = useState<string | null>(null);
  const [listTab, setListTab] = useState<"dm" | "group" | "archived">("dm");
  const [sheet, setSheet] = useState<"none" | "discover" | "compose">("none");
  const [discoverQ, setDiscoverQ] = useState("");
  const [discoverHits, setDiscoverHits] = useState<
    { id: string; uid: string; nickname: string | null }[]
  >([]);
  const [peerLabels, setPeerLabels] = useState<Record<string, string>>(() => loadPeerLabelCache());
  const [directory, setDirectory] = useState<
    { userId: string; uid: string | null; nickname: string | null }[]
  >([]);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [listQuery, setListQuery] = useState("");
  const [previews, setPreviews] = useState(readChatPreviews);
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set());
  /** False until /v1/friends resolves — don't lock the composer on an empty set. */
  const [friendsReady, setFriendsReady] = useState(false);
  const conversationsRef = useRef<Conversation[]>([]);
  const messageRowsRef = useRef<ChatMessage[]>([]);
  const selfUserIdRef = useRef<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const onBadgesRef = useRef(onBadgesMaybeChanged);
  onBadgesRef.current = onBadgesMaybeChanged;
  const loadedThreadRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  const prevMsgSigRef = useRef("");
  const mediaLoadedRef = useRef<Set<string>>(new Set());
  const selfDeviceId = useMemo(() => localStorage.getItem("lh.deviceId"), []);

  function scrollMessagesToBottom(force = false) {
    const el = messagesRef.current;
    if (!el) return;
    if (!force && !stickToBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }

  function onMessagesScroll() {
    const el = messagesRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = dist < 96;
  }

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  const [keyBusy, setKeyBusy] = useState(false);
  const [localKeysReady, setLocalKeysReady] = useState(false);
  const keysPromptedRef = useRef(false);

  async function refreshLocalKeysReady() {
    const has = await hasLocalDeviceKeys();
    setLocalKeysReady(has);
    return has;
  }

  async function noteAfterDegraded(_peerUserId?: string | null) {
    const hasLocal = await refreshLocalKeysReady();
    // Local missing → prompt upload. Local ready but still degraded → waiting on peer
    // (or incompatible backends); never re-prompt self to upload.
    setNote(hasLocal ? "chat_degraded_awaiting_peer" : "chat_degraded_soft");
  }

  async function confirmAndUploadKeys() {
    if (!getToken() || keyBusy) return;
    if (localKeysReady) {
      // Already uploaded — never nag again; explain waiting on peer if needed.
      const peer = selected?.peerUserIds?.[0] ?? null;
      await noteAfterDegraded(peer);
      return;
    }
    if (!window.confirm(t("security.uploadKeysConfirm"))) return;
    setKeyBusy(true);
    try {
      await uploadDeviceKeyBundle();
      setLocalKeysReady(true);
      const peer = selected?.peerUserIds?.[0] ?? null;
      if (peer && (await peerHasProductKeys(peer).catch(() => false))) {
        setNote("keys_uploaded");
      } else {
        setNote("chat_degraded_awaiting_peer");
      }
    } catch (e) {
      setNote(e instanceof Error ? e.message : "keys_failed");
    } finally {
      setKeyBusy(false);
    }
  }

  function renderNote(code: string) {
    const text = humanizeStatus(t, code);
    const showUpload =
      code === "chat_degraded_soft" && !localKeysReady && !keyBusy;
    if (!showUpload) {
      return (
        <p className="muted im-note" data-testid={code.startsWith("chat_degraded") ? "chat-keys-tip" : undefined}>
          {text}
        </p>
      );
    }
    return (
      <p className="muted im-note" data-testid="chat-keys-tip">
        {text}{" "}
        <button
          type="button"
          className="im-note-action"
          data-testid="chat-upload-keys-confirm"
          disabled={keyBusy}
          onClick={() => void confirmAndUploadKeys()}
        >
          {t("security.confirmUploadKeys")}
        </button>
      </p>
    );
  }

  useEffect(() => {
    void refreshLocalKeysReady();
  }, [selectedId]);

  // Opening a thread without local keys: soft banner only — never block with confirm().
  useEffect(() => {
    if (!selectedId || !getToken() || keysPromptedRef.current || keyBusy) return;
    let cancelled = false;
    void (async () => {
      const has = await hasLocalDeviceKeys();
      if (cancelled) return;
      setLocalKeysReady(has);
      if (has || keysPromptedRef.current) return;
      keysPromptedRef.current = true;
      setNote("chat_degraded_soft");
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId, keyBusy]);

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
    if (listTab === "group") {
      // Seminars are calendar items now; legacy seminar chats still appear under groups.
      return activeConversations.filter((c) => c.kind === "group" || c.kind === "seminar");
    }
    return activeConversations.filter((c) => c.kind === listTab);
  }, [activeConversations, listTab]);

  const refreshConversations = useCallback(async (opts?: { quiet?: boolean }) => {
    if (!getToken()) {
      if (!opts?.quiet) setNote("login_required");
      return;
    }
    // Share CallProvider's in-flight/fresh snapshot — don't force a second GET.
    const list = (await fetchConversationsList()) as Conversation[];
    conversationsRef.current = list;
    setConversations(list);
    writeCachedConversations(list);
    const fromPeers: Record<string, string> = {};
    for (const c of list) {
      for (const p of c.peers ?? []) {
        fromPeers[p.userId] = labelFromPeer(p, p.userId);
      }
    }
    if (Object.keys(fromPeers).length > 0) {
      setPeerLabels((prev) => mergePeerLabels(prev, fromPeers));
    }
    if (!opts?.quiet) setNote(null);
  }, []);

  useEffect(() => {
    if (!getToken()) return;
    void api<{ id?: string; userId?: string }>("/v1/me")
      .then((me) => setSelfUserId(me.id ?? me.userId ?? null))
      .catch(() => setSelfUserId(null));
  }, []);

  // Lightweight friends-only labels on chat mount — full directory is expensive
  // (org-tree decrypt) and only needed for compose/discover.
  useEffect(() => {
    if (!getToken()) return;
    void api<{
      friends: { user: { id: string; uid?: string | null; nickname?: string | null } }[];
    }>("/v1/friends")
      .then((fr) => {
        const map: Record<string, string> = {};
        const ids = new Set<string>();
        for (const f of fr.friends) {
          ids.add(f.user.id);
          map[f.user.id] = f.user.nickname || f.user.uid || f.user.id.slice(0, 10);
        }
        setPeerLabels((prev) => mergePeerLabels(prev, map));
        setFriendIds(ids);
        setFriendsReady(true);
      })
      .catch(() => {
        // Leave the composer usable; the server still enforces friends_required.
        setFriendsReady(false);
      });
  }, []);

  const loadDirectory = useCallback(async () => {
    if (!getToken()) return;
    try {
      const dir = await api<{
        contacts: {
          userId: string;
          uid: string | null;
          nickname: string | null;
          source: "directory" | "friend";
        }[];
      }>("/v1/friends/directory");
      const map: Record<string, string> = {};
      for (const c of dir.contacts) {
        map[c.userId] = c.nickname || c.uid || c.userId.slice(0, 10);
      }
      setPeerLabels((prev) => mergePeerLabels(prev, map));
      setDirectory(dir.contacts);
      setFriendIds((prev) => {
        const next = new Set(prev);
        for (const c of dir.contacts) {
          if (c.source === "friend") next.add(c.userId);
        }
        return next;
      });
    } catch {
      /* optional */
    }
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
            found.kind === "dm" ? "dm" : found.kind === "group" || found.kind === "seminar" ? "group" : "dm",
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

  const plaintextsRef = useRef<Record<string, string>>({});
  useEffect(() => {
    plaintextsRef.current = plaintexts;
  }, [plaintexts]);
  useEffect(() => {
    messageRowsRef.current = messages;
  }, [messages]);
  useEffect(() => {
    selfUserIdRef.current = selfUserId;
  }, [selfUserId]);

  const loadMessages = useCallback(
    async (conversationId: string, mode: "full" | "incremental" = "full") => {
      const hadUnread =
        (conversationsRef.current.find((c) => c.id === conversationId)?.unreadCount ?? 0) > 0;
      const known = mode === "incremental" ? messageRowsRef.current : [];
      const after =
        known.length > 0 ? known.reduce((max, m) => Math.max(max, m.createdAt), 0) : 0;
      // First open: recent page only. Incremental: after-cursor without re-pulling history.
      const qs =
        after > 0 ? `?after=${after}&limit=100` : mode === "full" ? "?limit=50" : "?limit=100";
      const res = await api<{
        messages: ChatMessage[];
        peerLastReadAt?: number | null;
      }>(`/v1/chat/conversations/${conversationId}/messages${qs}`);
      if (selectedIdRef.current !== conversationId) return;
      const now = Date.now();
      const incoming = res.messages.filter((m) => m.expiresAt == null || m.expiresAt > now);
      const knownIds = new Set(known.map((m) => m.id));
      const fresh = after > 0 ? incoming.filter((m) => !knownIds.has(m.id)) : incoming;
      if (after > 0 && fresh.length === 0) {
        if (res.peerLastReadAt !== undefined) {
          setConversations((prev) => {
            const cur = prev.find((c) => c.id === conversationId);
            if (cur && cur.peerLastReadAt === res.peerLastReadAt) return prev;
            const next = prev.map((c) =>
              c.id === conversationId ? { ...c, peerLastReadAt: res.peerLastReadAt } : c,
            );
            conversationsRef.current = next;
            return next;
          });
        }
        return;
      }
      const live =
        after > 0
          ? [...known.filter((m) => m.expiresAt == null || m.expiresAt > now), ...fresh].sort(
              (a, b) => a.createdAt - b.createdAt,
            )
          : incoming;
      setMessages((prev) => {
        if (
          prev.length === live.length &&
          prev.every((m, i) => m.id === live[i]?.id && m.ciphertext === live[i]?.ciphertext)
        ) {
          return prev;
        }
        return live;
      });
      // GET messages marks the thread read when something new arrived.
      setConversations((prev) => {
        const next = prev.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                unreadCount: 0,
                peerLastReadAt:
                  res.peerLastReadAt !== undefined ? res.peerLastReadAt : c.peerLastReadAt,
                membership: { ...c.membership, lastReadAt: now },
                lastMessageAt: live[live.length - 1]?.createdAt ?? c.lastMessageAt,
              }
            : c,
        );
        conversationsRef.current = next;
        return next;
      });
      if (hadUnread) onBadgesRef.current?.();
      const convo = conversationsRef.current.find((c) => c.id === conversationId);
      const peer = (convo?.peerUserIds ?? []).find(Boolean) ?? null;
      const me = selfUserIdRef.current;
      const prevPt = plaintextsRef.current;
      const toDecode = after > 0 ? fresh : live;
      const decoded: Record<string, string> = {};
      const pending: ChatMessage[] = [];
      for (const m of toDecode) {
        const cached = prevPt[m.id] && prevPt[m.id] !== "[ciphertext]" ? prevPt[m.id] : readPlainSync(m.id);
        if (cached) {
          decoded[m.id] = cached;
        } else {
          pending.push(m);
        }
      }
      // Warm ratchet/session once so the first decode doesn't serialize the whole page behind /v1/keys.
      if (pending.length > 0 && peer && me) {
        try {
          await ensureRatchet(conversationId, peer, me);
        } catch {
          /* keys missing — decode path surfaces degraded tip */
        }
      }
      // Decrypt in parallel — sequential ratchet opens made long threads feel stuck.
      const CONCURRENCY = 8;
      for (let i = 0; i < pending.length; i += CONCURRENCY) {
        const chunk = pending.slice(i, i + CONCURRENCY);
        const parts = await Promise.all(
          chunk.map(async (m) => {
            const text = await decodeStoredChatMessage({
              conversationId,
              messageId: m.id,
              ratchetHeader: m.ratchetHeader,
              ciphertext: m.ciphertext,
              peerUserId: peer,
              selfUserId: me,
            });
            return [m.id, text] as const;
          }),
        );
        for (const [id, text] of parts) decoded[id] = text;
        // Progressive paint so the thread isn't blank until the last message decrypts.
        if (i + CONCURRENCY < pending.length) {
          setPlaintexts((prev) => ({ ...prev, ...Object.fromEntries(parts) }));
        }
      }
      for (const [id, text] of Object.entries(decoded)) writePlainSync(id, text);
      void writeThread(conversationId, peer, live).catch(() => {});
      const last = live[live.length - 1];
      const lastText = last ? decoded[last.id] ?? readPlainSync(last.id) : null;
      if (last && lastText && lastText !== "[ciphertext]") {
        writeChatPreview(conversationId, payloadPreview(lastText, lastText), last.createdAt);
        window.dispatchEvent(new Event("lh:chat-previews"));
      }
      if (after > 0) {
        if (Object.keys(decoded).length === 0) return;
        setPlaintexts((prev) => ({ ...prev, ...decoded }));
      } else {
        loadedThreadRef.current = conversationId;
        setPlaintexts((prev) => {
          const prevKeys = Object.keys(prev);
          const nextKeys = Object.keys(decoded);
          if (
            prevKeys.length === nextKeys.length &&
            nextKeys.every((k) => prev[k] === decoded[k])
          ) {
            return prev;
          }
          return decoded;
        });
      }
    },
    [],
  );

  const loadFavorites = useCallback(async () => {
    if (!getToken()) return;
    try {
      const res = await api<{
        favorites: { id: string; messageId: string; ciphertext: string; iv: string; createdAt: number }[];
      }>("/v1/chat/favorites");
      const key = await sessionKeyFor("fav");
      const decoded = await Promise.all(
        res.favorites.map(async (f) => {
          let preview = "";
          try {
            preview = await decryptSessionPayload(key, f.iv, f.ciphertext, "fav");
          } catch {
            preview = "";
          }
          return {
            id: f.id,
            messageId: f.messageId,
            preview: preview || undefined,
            createdAt: f.createdAt,
          };
        }),
      );
      setFavorites(decoded);
    } catch {
      /* endpoint may be unavailable in older deploys */
    }
  }, []);

  useEffect(() => {
    void refreshConversations().catch((e) => setNote(e instanceof Error ? e.message : "error"));
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void refreshConversations({ quiet: true }).catch(() => {});
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [refreshConversations]);

  // Favorites decrypt is off the contact-list critical path.
  useEffect(() => {
    if (listTab === "archived") {
      void loadFavorites();
      return;
    }
    const ric = (
      window as Window & {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
        cancelIdleCallback?: (id: number) => void;
      }
    ).requestIdleCallback;
    if (typeof ric === "function") {
      const id = ric(() => void loadFavorites(), { timeout: 4_000 });
      return () => window.cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(() => void loadFavorites(), 2_500);
    return () => window.clearTimeout(t);
  }, [listTab, loadFavorites]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      void refreshConversations({ quiet: true }).catch(() => {});
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, [refreshConversations]);

  useEffect(() => {
    const onPreviews = () => setPreviews(readChatPreviews());
    window.addEventListener("lh:chat-previews", onPreviews);
    return () => window.removeEventListener("lh:chat-previews", onPreviews);
  }, []);

  useEffect(() => {
    selectedIdRef.current = selectedId;
    loadedThreadRef.current = null;
    setMessages([]);
    setPlaintexts({});
    prevMsgSigRef.current = "";
    if (!selectedId) return;
    stickToBottomRef.current = true;
    const id = selectedId;
    void readThread(id)
      .then((cached) => {
        if (!cached || selectedIdRef.current !== id || loadedThreadRef.current === id) return;
        const plains: Record<string, string> = {};
        for (const message of cached.messages) {
          const text = readPlainSync(message.id);
          if (text) plains[message.id] = text;
        }
        setMessages(cached.messages);
        if (Object.keys(plains).length > 0) setPlaintexts(plains);
      })
      .catch(() => {});
    void loadMessages(selectedId, "full").catch((e) => setNote(e instanceof Error ? e.message : "error"));
  }, [selectedId, loadMessages]);

  // Stick to bottom when the thread grows (send or receive), unless user scrolled up.
  useEffect(() => {
    if (!selectedId) return;
    const sig = `${messages.length}:${messages[messages.length - 1]?.id ?? ""}`;
    const changed = sig !== prevMsgSigRef.current;
    const wasEmpty = prevMsgSigRef.current === "" || prevMsgSigRef.current.startsWith("0:");
    prevMsgSigRef.current = sig;
    if (!changed) return;
    requestAnimationFrame(() => {
      scrollMessagesToBottom(wasEmpty || stickToBottomRef.current);
    });
  }, [messages, plaintexts, selectedId]);

  /** Soft realtime: incremental poll of the open thread (full resync every ~30s). */
  useEffect(() => {
    if (!selectedId) return;
    const POLL_MS = 5_000;
    let ticks = 0;
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      ticks += 1;
      const ready = loadedThreadRef.current === selectedId;
      const mode = ready && ticks % 6 !== 0 ? "incremental" : "full";
      void loadMessages(selectedId, mode).catch(() => {
        /* keep last good snapshot while offline */
      });
    };
    const timer = window.setInterval(tick, POLL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") tick();
    };
    const onControl = (ev: Event) => {
      const id = (ev as CustomEvent<{ conversationId?: string }>).detail?.conversationId;
      if (id && id === selectedId) tick();
    };
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("lh:chat-messages", onControl);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("lh:chat-messages", onControl);
    };
  }, [selectedId, loadMessages]);

  function callRecordLabel(payload: Extract<ChatPayload, { kind: "call" }>): string {
    const video = payload.video ? t("chat.callVideo") : t("chat.callAudio");
    const dur = formatCallDuration(payload.durationSec);
    if (payload.event === "ended") {
      return dur
        ? t("chat.callRecordEnded", { type: video, duration: dur })
        : t("chat.callRecordEndedShort", { type: video });
    }
    if (payload.event === "missed") return t("chat.callRecordMissed", { type: video });
    if (payload.event === "declined") return t("chat.callRecordDeclined", { type: video });
    return t("chat.callRecordCanceled", { type: video });
  }

  async function createConversation(explicitIds: string[], explicitKind: ConversationKind) {
    if (!getToken()) {
      setNote("login_required");
      return;
    }
    setBusy(true);
    try {
      const useKind = explicitKind;
      const ids = explicitIds.map((s) => s.trim()).filter(Boolean);
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
      setGroupPick([]);
      setTitle("");
      setSheet("none");
      await refreshConversations();
      setSelectedId(res.id);
      setListTab(useKind === "seminar" ? "group" : useKind === "group" ? "group" : "dm");
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

    const groupLike = selected?.kind === "group" || selected?.kind === "seminar";
    if (groupLike && peers.length >= 1 && selfUserId) {
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
    // Degraded still decrypts peer-to-peer after v2 seed fix; tip depends on who still needs keys.
    if (mode === "degraded") {
      await noteAfterDegraded(peers[0] ?? null);
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
    const text = draft.trim();
    setBusy(true);
    setDraft("");
    setEmojiOpen(false);
    try {
      stickToBottomRef.current = true;
      await sendEncryptedPayload({ v: 1, kind: "text", text });
      requestAnimationFrame(() => scrollMessagesToBottom(true));
    } catch (e) {
      setDraft((cur) => (cur.trim() ? cur : text));
      setNote(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }

  async function sendAttachment(file: File) {
    if (!selectedId || !getToken()) return;
    setBusy(true);
    let caption = "";
    let clearedDraft = false;
    try {
      const minted = await api<{ key: string; putUrl: string }>("/v1/media/upload-url", {
        method: "POST",
      });
      const raw = await file.arrayBuffer();
      const { encryptMediaBlob } = await import("../lib/media-crypto");
      const { ciphertext, contentKey } = await encryptMediaBlob(raw);
      const putRes = await fetch(apiUrl(minted.putUrl), {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${getToken()}`,
          "Content-Type": "application/octet-stream",
        },
        body: ciphertext,
      });
      if (!putRes.ok) throw new Error("media_upload_failed");
      caption = draft.trim();
      setDraft("");
      clearedDraft = true;
      setEmojiOpen(false);
      stickToBottomRef.current = true;
      await sendEncryptedPayload({
        v: 1,
        kind: "media",
        mediaKey: minted.key,
        mime: file.type || "application/octet-stream",
        name: file.name || "file",
        text: caption || undefined,
        enc: contentKey,
      });
      requestAnimationFrame(() => scrollMessagesToBottom(true));
    } catch (e) {
      if (clearedDraft) setDraft((cur) => (cur.trim() ? cur : caption));
      setNote(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function resizeComposer() {
    const el = composerRef.current;
    if (!el) return;
    const rootPx = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const minPx = Math.round(2.55 * rootPx);
    const maxPx = Math.round(7 * rootPx);
    el.style.height = "0px";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, minPx), maxPx)}px`;
  }

  useEffect(() => {
    resizeComposer();
  }, [draft]);

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
      resizeComposer();
    });
  }

  useEffect(() => {
    const mediaPayloads = Object.values(plaintexts)
      .map((raw) => parseChatPayload(raw))
      .filter((p): p is Extract<ChatPayload, { kind: "media" }> => p?.kind === "media");
    const byKey = new Map<string, Extract<ChatPayload, { kind: "media" }>>();
    for (const p of mediaPayloads) {
      if (!byKey.has(p.mediaKey)) byKey.set(p.mediaKey, p);
    }
    const keys = [...byKey.keys()].filter((k) => !mediaLoadedRef.current.has(k));
    if (keys.length === 0 || !getToken() || !selectedId) return;
    let cancelled = false;
    void (async () => {
      const { decryptMediaBlob } = await import("../lib/media-crypto");
      for (const key of keys) {
        mediaLoadedRef.current.add(key);
        const payload = byKey.get(key)!;
        try {
          const q = `?conversationId=${encodeURIComponent(selectedId)}`;
          const res = await fetch(apiUrl(`/v1/media/${encodeURIComponent(key)}${q}`), {
            headers: { Authorization: `Bearer ${getToken()}` },
          });
          if (!res.ok || cancelled) continue;
          const buf = await res.arrayBuffer();
          if (cancelled) return;
          let bytes = buf;
          if (payload.enc) {
            try {
              bytes = await decryptMediaBlob(buf, payload.enc);
            } catch {
              // Legacy plaintext uploads (no enc) still render as-is.
              bytes = buf;
            }
          }
          const blob = new Blob([bytes], { type: payload.mime || "application/octet-stream" });
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
  }, [plaintexts, selectedId]);

  async function favoriteMessage(m: ChatMessage) {
    if (favoriteBusyId === m.id) return;
    const text = payloadPreview(plaintexts[m.id], plaintexts[m.id] ?? "");
    if (!text.trim()) return;
    setFavoriteBusyId(m.id);
    try {
      // Stable user-scoped key so archived favorites decrypt without conversation id.
      const key = await sessionKeyFor("fav");
      const enc = await encryptSessionPayload(key, text, "fav");
      await api("/v1/chat/favorites", {
        method: "POST",
        body: JSON.stringify({
          messageId: m.id,
          ciphertext: enc.ciphertext,
          iv: enc.ratchetHeader,
        }),
      });
      setNote("message_favorited");
      await loadFavorites();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "error");
    } finally {
      setFavoriteBusyId(null);
    }
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
      const enriched = (c.peers ?? []).find((p) => p.userId === peer) ?? c.peers?.[0];
      if (enriched) return labelFromPeer(enriched, peer);
      if (peer) return peer.slice(0, 10);
    }
    return kindLabel(c.kind);
  }

  function formatConvoWhen(ts: number): string {
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString();
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
    friendsReady &&
    selected?.kind === "dm" &&
    Boolean(selected.peerUserIds?.[0]) &&
    !friendIds.has(selected.peerUserIds![0]!);

  return (
    <div className={`chat-home im-shell${selected ? " is-thread" : ""}`} data-testid="home-chat-panel">
      {note && !selected && renderNote(note)}

      {selected ? (
        <div className="im-thread" data-testid="im-thread">
          <header className="im-thread-bar">
            <button
              type="button"
              className="btn ghost im-back"
              data-testid="chat-back-list"
              aria-label={t("chat.back")}
              onClick={() => setSelectedId(null)}
            >
              <IconChevronLeft />
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
            {selected.kind === "dm" ? (
              <button
                type="button"
                className="btn ghost im-call-btn"
                data-testid="chat-call"
                disabled={busy || dmPeerBlocked}
                aria-label={t("chat.call")}
                title={t("chat.call")}
                onClick={() => {
                  if (!selectedId) return;
                  startOutboundCall(selectedId, {
                    peerLabel: selected ? convoLabel(selected) : undefined,
                  });
                }}
              >
                <IconPhone />
              </button>
            ) : (
              <button
                type="button"
                className="btn ghost im-call-btn"
                data-testid="chat-call-dm-only"
                disabled
                aria-label={t("chat.callDmOnly")}
                title={t("chat.callDmOnly")}
              >
                <IconPhone />
              </button>
            )}
            <details className="im-more">
              <summary className="btn ghost" aria-label={t("chat.more")}>
                <IconMore />
              </summary>
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
                {callSessionActive && (
                  <>
                    <button
                      type="button"
                      className="btn ghost"
                      disabled={busy || !screenShareReady}
                      onClick={() => void shareScreen(selectedId)}
                    >
                      {t("chat.screenShare")}
                    </button>
                    <button
                      type="button"
                      className="btn ghost"
                      disabled={busy}
                      onClick={() => void endScreen()}
                    >
                      {t("chat.stopShare")}
                    </button>
                  </>
                )}
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

          <div
            className="im-messages chat-thread"
            ref={messagesRef}
            data-testid="chat-messages"
            onScroll={onMessagesScroll}
          >
            {messages.length === 0 && <p className="muted im-empty">{t("chat.noMessages")}</p>}
            {messages.map((m, idx) => {
              const payload = parseChatPayload(plaintexts[m.id]);
              const loading = plaintexts[m.id] == null;
              // Dedupe call records both sides may post for the same callId.
              if (payload?.kind === "call" && payload.callId) {
                const seen = messages.slice(0, idx).some((prev) => {
                  const p = parseChatPayload(plaintexts[prev.id]);
                  return p?.kind === "call" && p.callId === payload.callId;
                });
                if (seen) return null;
              }
              if (!loading && payload?.kind === "call") {
                return (
                  <div
                    key={m.id}
                    className="chat-call-record"
                    data-testid="chat-call-record"
                    data-call-event={payload.event}
                  >
                    <IconPhone className="ui-icon-inline" />
                    <span>{callRecordLabel(payload)}</span>
                    <time dateTime={new Date(m.createdAt).toISOString()}>
                      {new Date(m.createdAt).toLocaleString()}
                    </time>
                  </div>
                );
              }
              const mine = Boolean(
                (selfUserId && m.senderUserId && m.senderUserId === selfUserId) ||
                  (selfDeviceId && m.senderDeviceId === selfDeviceId),
              );
              const isRead =
                mine && messageReceiptState(m.createdAt, selected?.peerLastReadAt) === "read";
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
                          <IconPaperclip className="ui-icon-inline" /> {payload.name}
                        </a>
                      )}
                      {payload.text ? (
                        <ChatVerseText text={payload.text} translationId={readerTranslationId()} />
                      ) : null}
                    </div>
                  )}
                  {!loading && payload?.kind === "text" && (
                    <ChatVerseText text={payload.text} translationId={readerTranslationId()} />
                  )}
                  {!loading && !payload && (
                    <ChatVerseText
                      text={plaintexts[m.id] ?? ""}
                      translationId={readerTranslationId()}
                      className="chat-bubble-text muted"
                    />
                  )}
                  <div className="muted im-bubble-meta">
                    <span className="im-bubble-time">
                      {new Date(m.createdAt).toLocaleString()}
                      {m.expiresAt
                        ? ` · ${t("chat.disappearing")} ${new Date(m.expiresAt).toLocaleString()}`
                        : ""}
                    </span>
                    {!loading && m.contentType !== "control" && (
                      <button
                        type="button"
                        className={`btn ghost im-fav-btn${
                          favorites.some((f) => f.messageId === m.id) ? " is-active" : ""
                        }`}
                        data-testid={`chat-favorite-${m.id}`}
                        disabled={favoriteBusyId === m.id || favorites.some((f) => f.messageId === m.id)}
                        aria-label={t("chat.favorite")}
                        title={t("chat.favorite")}
                        onClick={() => void favoriteMessage(m)}
                      >
                        ★
                      </button>
                    )}
                    {mine && m.contentType !== "control" && (
                      <span
                        className={`im-receipt${isRead ? " is-read" : ""}`}
                        data-testid={isRead ? "chat-receipt-read" : "chat-receipt-sent"}
                        title={isRead ? t("chat.receiptRead") : t("chat.receiptSent")}
                        aria-label={isRead ? t("chat.receiptRead") : t("chat.receiptSent")}
                      >
                        {isRead ? (
                          <IconCheckRead className="ui-icon-receipt" />
                        ) : (
                          <IconCheck className="ui-icon-receipt" />
                        )}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <footer className="im-composer">
            {note && renderNote(note)}
            <div className="im-composer-tools">
              <button
                type="button"
                className="btn ghost im-tool"
                data-testid="chat-attach-open"
                aria-label={t("chat.attach")}
                disabled={busy || dmPeerBlocked}
                onClick={() => fileInputRef.current?.click()}
              >
                <IconPlus />
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
                <IconEmoji />
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
                data-testid="chat-composer"
                onChange={(e) => setDraft(e.target.value)}
                onInput={resizeComposer}
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
                aria-label={t("chat.send")}
                onClick={() => void sendMessage()}
              >
                <IconSend />
                <span className="im-send-label">{t("chat.send")}</span>
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
            <IconSearch className="im-search-icon" />
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
              const unread = c.unreadCount ?? 0;
              const preview = previews[c.id]?.text;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    className={`convo-row convo-row-rich${unread > 0 ? " is-unread" : ""}`}
                    onClick={() => setSelectedId(c.id)}
                  >
                    <span className="im-avatar" aria-hidden>
                      {avatarLetter(label)}
                    </span>
                    <span className="convo-row-main">
                      <strong>{label}</strong>
                      <span className="muted convo-row-preview">
                        {preview
                          ? preview
                          : listTab === "archived"
                            ? t("chat.archived")
                            : c.kind !== "dm"
                              ? kindLabel(c.kind)
                              : t("chat.tapToOpen")}
                      </span>
                    </span>
                    <span className="convo-row-meta">
                      {unread > 0 ? (
                        <span className="nav-badge" data-testid="chat-convo-badge">
                          {unread > 99 ? "99+" : unread}
                        </span>
                      ) : null}
                      <span className="muted convo-row-time">
                        {formatConvoWhen(c.lastMessageAt ?? c.createdAt)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
            {listTab === "archived" && (
              <li className="chat-favorites-block" data-testid="chat-favorites-list">
                <strong className="chat-favorites-heading">{t("chat.favorites")}</strong>
                {favorites.length === 0 ? (
                  <p className="muted" style={{ margin: "0.35rem 0 0" }}>
                    {t("chat.favoritesEmpty")}
                  </p>
                ) : (
                  <ul className="chat-favorites-items">
                    {favorites.map((f) => (
                      <li key={f.id} data-testid={`chat-favorite-item-${f.id}`}>
                        <span className="chat-favorite-preview">
                          {f.preview?.trim() || t("chat.favoriteEncrypted")}
                        </span>
                        {f.createdAt ? (
                          <span className="muted convo-row-time">
                            {formatConvoWhen(f.createdAt)}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )}
          </ul>

          <button
            type="button"
            className="comms-fab"
            data-testid="chat-compose-open"
            aria-label={t("comms.newChat")}
            onClick={() => {
              setKind(listTab === "group" ? "group" : "dm");
              setSheet("compose");
              void loadDirectory();
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
                      <p className="muted" style={{ marginTop: 0 }}>
                        {t("chat.pickMembers")}
                      </p>
                      <ul className="list" data-testid="chat-compose-members">
                        {directory.length === 0 && (
                          <li className="muted">{t("chat.discoverEmpty")}</li>
                        )}
                        {directory.map((c) => {
                          const checked = groupPick.includes(c.userId);
                          return (
                            <li key={c.userId}>
                              <label className="check-row">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  data-testid={`chat-compose-member-${c.uid || c.userId}`}
                                  onChange={() =>
                                    setGroupPick((prev) =>
                                      checked
                                        ? prev.filter((id) => id !== c.userId)
                                        : [...prev, c.userId],
                                    )
                                  }
                                />
                                {c.nickname || c.uid || c.userId.slice(0, 10)}
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                    <button
                      type="button"
                      className="btn"
                      disabled={busy || groupPick.length === 0}
                      data-testid="chat-compose-create"
                      onClick={() => void createConversation(groupPick, "group")}
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
