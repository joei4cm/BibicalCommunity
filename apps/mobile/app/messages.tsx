import { useCallback, useEffect, useRef, useState } from "react";
import {
  Text,
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { messageReceiptState, t } from "@logoshome/shared";
import { api, getApiBase, getToken, hydrateToken } from "../src/api";
import { startCallSession, type CallSession } from "../src/call-session";
import { ensureBase64Globals } from "../src/crypto-polyfill";
import {
  decryptGroupFanout,
  encryptGroupFanout,
  isGroupFanoutHeader,
} from "../src/group-fanout";
import { useLocale } from "../src/locale";
import { decryptMobileMessage, encryptMobileMessage } from "../src/session-crypto";
import { humanizeStatus } from "../src/status";
import { buildIceServersFromTurnResponse, turnResponseHasRelay } from "../src/turn-ice";
import { RTCView, signalingWsUrl, type RnMediaStream } from "../src/webrtc";

ensureBase64Globals();

type Conversation = {
  id: string;
  kind: string;
  title: string | null;
  disappearingTtlSec: number | null;
  peerUserIds?: string[];
  peerLastReadAt?: number | null;
  membership: { id: string; role: string; archived: boolean };
};

type ChatMessage = {
  id: string;
  senderDeviceId?: string;
  senderUserId?: string | null;
  ratchetHeader: string;
  ciphertext: string;
  createdAt: number;
  expiresAt: number | null;
};

const TTL_OPTIONS = [
  { labelKey: "chat.ttlOff" as const, value: null as number | null },
  { labelKey: "chat.ttl1h" as const, value: 3600 },
  { labelKey: "chat.ttl1d" as const, value: 86400 },
  { labelKey: "chat.ttl7d" as const, value: 604800 },
];

/**
 * Mobile chat parity with web ChatPanel:
 * product x25519 (peer-scoped) → degraded bootstrap; group fan-out:v1; WebRTC + TURN.
 */
export default function MessagesScreen() {
  const { locale } = useLocale();
  const router = useRouter();
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
  const [showArchived, setShowArchived] = useState(false);
  const [selfUserId, setSelfUserId] = useState<string | null>(null);
  const [selfDeviceId, setSelfDeviceId] = useState<string | null>(null);
  const [remoteStreamUrl, setRemoteStreamUrl] = useState<string | null>(null);
  const callRef = useRef<CallSession | null>(null);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  const peersFor = useCallback(
    (conversationId: string | null) => {
      if (!conversationId) return [] as string[];
      const c = conversations.find((x) => x.id === conversationId);
      return (c?.peerUserIds ?? []).filter(Boolean);
    },
    [conversations],
  );

  const refresh = useCallback(async () => {
    await hydrateToken();
    if (!getApiBase()) {
      setNote("api_base_required");
      return;
    }
    if (!getToken()) {
      setNote("login_required");
      return;
    }
    const res = await api<{ conversations: Conversation[] }>("/v1/chat/conversations");
    setConversations(
      res.conversations.filter((c) =>
        showArchived ? c.membership.archived : !c.membership.archived,
      ),
    );
    setNote(null);
  }, [showArchived]);

  const loadMessages = useCallback(
    async (conversationId: string) => {
      const res = await api<{
        messages: ChatMessage[];
        peerLastReadAt?: number | null;
      }>(`/v1/chat/conversations/${conversationId}/messages`);
      const now = Date.now();
      const live = res.messages.filter((m) => m.expiresAt == null || m.expiresAt > now);
      setMessages(live);
      if (res.peerLastReadAt !== undefined) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === conversationId ? { ...c, peerLastReadAt: res.peerLastReadAt } : c,
          ),
        );
      }
      const peer = peersFor(conversationId)[0] ?? null;
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
            const pt = await decryptMobileMessage(
              conversationId,
              m.ratchetHeader,
              m.ciphertext,
              peer,
            );
            decoded[m.id] = pt ?? "[ciphertext]";
          }
        } catch {
          decoded[m.id] = "[ciphertext]";
        }
      }
      setPlaintexts((prev) => ({ ...prev, ...decoded }));
    },
    [peersFor, selfUserId],
  );

  useEffect(() => {
    void (async () => {
      await hydrateToken();
      if (!getToken()) return;
      try {
        const me = await api<{ id?: string; userId?: string }>("/v1/me");
        setSelfUserId(me.id ?? me.userId ?? null);
      } catch {
        setSelfUserId(null);
      }
      try {
        const stored = await AsyncStorage.getItem("lh.deviceId");
        setSelfDeviceId(stored);
      } catch {
        setSelfDeviceId(null);
      }
    })();
  }, []);

  useEffect(() => {
    void refresh().catch((e) => setNote(e instanceof Error ? e.message : "error"));
  }, [refresh]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    void loadMessages(selectedId).catch((e) => setNote(e instanceof Error ? e.message : "error"));
  }, [selectedId, loadMessages]);

  /** Soft realtime: poll open thread for new messages + peer read receipts. */
  useEffect(() => {
    if (!selectedId) return;
    const timer = setInterval(() => {
      void loadMessages(selectedId).catch(() => {});
    }, 2500);
    return () => clearInterval(timer);
  }, [selectedId, loadMessages]);

  useEffect(() => {
    return () => {
      callRef.current?.close();
      callRef.current = null;
    };
  }, []);

  async function createConversation() {
    setBusy(true);
    try {
      await hydrateToken();
      if (!getToken()) {
        setNote("login_required");
        return;
      }
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
      await refresh();
      setSelectedId(res.id);
      setNote(null);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
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
      await refresh();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }

  async function archiveConversation(archived: boolean) {
    if (!selectedId) return;
    setBusy(true);
    try {
      await api(`/v1/chat/conversations/${selectedId}`, {
        method: "PATCH",
        body: JSON.stringify({ archived }),
      });
      if (archived) setSelectedId(null);
      await refresh();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }

  async function send() {
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
        });
        ratchetHeader = fanout.ratchetHeader;
        ciphertext = fanout.ciphertext;
        mode = fanout.degradedPeers.length > 0 ? "degraded" : "group-fanout";
      } else {
        const enc = await encryptMobileMessage(selectedId, text, peers[0] ?? null);
        ratchetHeader = enc.ratchetHeader;
        ciphertext = enc.ciphertext;
        mode = enc.mode;
      }

      const res = await api<{ id: string }>(`/v1/chat/conversations/${selectedId}/messages`, {
        method: "POST",
        body: JSON.stringify({ ratchetHeader, ciphertext, contentType: "msg", expiresAt }),
      });
      setPlaintexts((p) => ({ ...p, [res.id]: text }));
      setDraft("");
      if (mode === "degraded") {
        setNote("chat_degraded_no_peer_keys");
      } else {
        setNote(null);
      }
      await loadMessages(selectedId);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }

  async function startCall() {
    if (!selectedId) return;
    setBusy(true);
    setCallNote(null);
    try {
      callRef.current?.close();
      callRef.current = null;
      setRemoteStreamUrl(null);

      const res = await api<{ callId: string; signalingPath: string; note?: string }>(
        "/v1/chat/calls",
        {
          method: "POST",
          body: JSON.stringify({ conversationId: selectedId }),
        },
      );

      let iceServers = buildIceServersFromTurnResponse({ uris: [] });
      try {
        const turn = await api<{
          username?: string;
          credential?: string;
          uris: string[];
          ttl: number;
          iceServers?: { urls: string | string[]; username?: string; credential?: string }[];
          hasRelay?: boolean;
        }>("/v1/calls/turn-credentials", { method: "POST", body: "{}" });
        iceServers = buildIceServersFromTurnResponse(turn);
        setCallNote(
          turnResponseHasRelay(turn)
            ? t(locale, "chat.callRelayOn")
            : t(locale, "chat.turnRelayMissing"),
        );
      } catch {
        setCallNote(t(locale, "chat.turnRelayMissing"));
      }

      const token = getToken();
      const base = getApiBase();
      const wsUrl =
        token && base
          ? signalingWsUrl(base, res.signalingPath, token, selectedId)
          : null;

      const session = await startCallSession({
        wsUrl,
        iceServers,
        onRemoteStream: (stream: RnMediaStream) => {
          setRemoteStreamUrl(stream.toURL());
        },
        onNote: (m) => setCallNote((prev) => `${prev ?? ""} · ${m}`),
      });
      callRef.current = session;
      setCallNote(
        (prev) =>
          `${prev ? `${prev} · ` : ""}${t(locale, "chat.callStarted")}: ${res.callId}` +
          (res.note ? ` · ${res.note}` : "") +
          ` · signaling=${session.channel.kind}`,
      );
    } catch (e) {
      setCallNote(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }

  function hangup() {
    callRef.current?.close();
    callRef.current = null;
    setRemoteStreamUrl(null);
    setCallNote((prev) => `${prev ?? ""} · hung-up`);
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backText}>← {t(locale, "nav.home")}</Text>
      </Pressable>
      <Text style={styles.title}>{t(locale, "home.messages")}</Text>
      <Text style={styles.muted}>{t(locale, "chat.cryptoHint")}</Text>
      {note && <Text style={styles.muted}>{humanizeStatus(locale, note)}</Text>}

      <Text style={styles.section}>{t(locale, "chat.newConversation")}</Text>
      <View style={styles.ttlRow}>
        <Pressable
          style={[styles.ttlChip, kind === "dm" && styles.ttlChipActive]}
          onPress={() => setKind("dm")}
        >
          <Text style={[styles.ttlChipText, kind === "dm" && styles.ttlChipTextActive]}>
            {t(locale, "chat.dm")}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.ttlChip, kind === "group" && styles.ttlChipActive]}
          onPress={() => setKind("group")}
        >
          <Text style={[styles.ttlChipText, kind === "group" && styles.ttlChipTextActive]}>
            {t(locale, "chat.group")}
          </Text>
        </Pressable>
      </View>
      {kind === "group" && (
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder={t(locale, "chat.title")}
        />
      )}
      <TextInput
        style={styles.input}
        value={memberIds}
        onChangeText={setMemberIds}
        placeholder={t(locale, "chat.selfNote")}
        autoCapitalize="none"
      />
      <Pressable
        style={[styles.btn, busy && styles.btnDisabled]}
        disabled={busy}
        onPress={() => void createConversation()}
      >
        <Text style={styles.btnText}>{t(locale, "chat.create")}</Text>
      </Pressable>

      <Text style={styles.section}>{t(locale, "home.messages")}</Text>
      <Pressable
        style={[styles.ttlChip, showArchived && styles.ttlChipActive, { marginBottom: 10 }]}
        onPress={() => setShowArchived((v) => !v)}
      >
        <Text style={[styles.ttlChipText, showArchived && styles.ttlChipTextActive]}>
          {t(locale, "chat.archive")}
          {showArchived ? " ✓" : ""}
        </Text>
      </Pressable>
      {conversations.length === 0 && <Text style={styles.muted}>{t(locale, "chat.empty")}</Text>}
      {conversations.map((c) => (
        <Pressable
          key={c.id}
          style={[styles.item, selectedId === c.id && styles.itemActive]}
          onPress={() => setSelectedId(c.id)}
        >
          <Text style={styles.itemTitle}>
            {c.title ?? (c.kind === "group" ? t(locale, "chat.group") : t(locale, "chat.dm"))}
          </Text>
          <Text style={styles.muted}>
            {c.kind}
            {c.disappearingTtlSec ? ` · TTL ${c.disappearingTtlSec}s` : ""}
            {c.membership.archived ? ` · ${t(locale, "chat.archived")}` : ""}
            {selectedId === c.id ? ` · ${t(locale, "chat.selected")}` : ""}
          </Text>
        </Pressable>
      ))}

      {selectedId && (
        <View style={styles.thread}>
          <View style={styles.ttlRow}>
            <Pressable
              style={[styles.btn, styles.btnGhost, busy && styles.btnDisabled]}
              disabled={busy}
              onPress={() => void startCall()}
            >
              <Text style={styles.btnGhostText}>{t(locale, "chat.call")}</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.btnGhost]} onPress={hangup}>
              <Text style={styles.btnGhostText}>{t(locale, "chat.hangup")}</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.btnGhost, busy && styles.btnDisabled]}
              disabled={busy}
              onPress={() => void archiveConversation(!selected?.membership.archived)}
            >
              <Text style={styles.btnGhostText}>
                {selected?.membership.archived
                  ? t(locale, "chat.unarchive")
                  : t(locale, "chat.archive")}
              </Text>
            </Pressable>
          </View>
          {callNote && <Text style={styles.muted}>{callNote}</Text>}
          {remoteStreamUrl ? (
            <RTCView streamURL={remoteStreamUrl} style={styles.remoteVideo} objectFit="cover" />
          ) : null}

          <Text style={styles.label}>{t(locale, "chat.disappearing")}</Text>
          <View style={styles.ttlRow}>
            {TTL_OPTIONS.map((opt) => {
              const active = (selected?.disappearingTtlSec ?? null) === opt.value;
              return (
                <Pressable
                  key={String(opt.value)}
                  style={[styles.ttlChip, active && styles.ttlChipActive, busy && styles.btnDisabled]}
                  disabled={busy}
                  onPress={() => void patchTtl(opt.value)}
                >
                  <Text style={[styles.ttlChipText, active && styles.ttlChipTextActive]}>
                    {t(locale, opt.labelKey)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {busy && <ActivityIndicator color="#0f6b5c" />}
          {messages.length === 0 && (
            <Text style={styles.muted}>{t(locale, "chat.noMessages")}</Text>
          )}
          {messages.map((m) => {
            const mine = Boolean(
              (selfUserId && m.senderUserId && m.senderUserId === selfUserId) ||
                (selfDeviceId && m.senderDeviceId && m.senderDeviceId === selfDeviceId),
            );
            const isRead =
              mine && messageReceiptState(m.createdAt, selected?.peerLastReadAt) === "read";
            return (
              <View key={m.id} style={[styles.bubble, mine ? styles.bubbleMine : styles.bubblePeer]}>
                <Text style={styles.body}>{plaintexts[m.id] ?? "[ciphertext]"}</Text>
                <View style={styles.metaRow}>
                  <Text style={styles.muted}>
                    {new Date(m.createdAt).toLocaleString()}
                    {m.expiresAt ? ` · exp ${new Date(m.expiresAt).toLocaleString()}` : ""}
                  </Text>
                  {mine ? (
                    <Text
                      style={[styles.receipt, isRead && styles.receiptRead]}
                      accessibilityLabel={
                        isRead ? t(locale, "chat.receiptRead") : t(locale, "chat.receiptSent")
                      }
                    >
                      {isRead ? "✓✓" : "✓"}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })}
          <TextInput
            style={[styles.input, { minHeight: 72 }]}
            value={draft}
            onChangeText={setDraft}
            multiline
            placeholder={t(locale, "chat.message")}
          />
          <Pressable
            style={[styles.btn, busy && styles.btnDisabled]}
            disabled={busy}
            onPress={() => void send()}
          >
            <Text style={styles.btnText}>{t(locale, "chat.send")}</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f3efe6" },
  content: { padding: 20, paddingBottom: 40, paddingTop: 56 },
  back: { marginBottom: 12 },
  backText: { color: "#0f6b5c", fontWeight: "600", fontSize: 15 },
  title: { fontSize: 28, fontWeight: "700", color: "#1c2b2a" },
  section: { marginTop: 20, marginBottom: 8, fontSize: 16, fontWeight: "600", color: "#1c2b2a" },
  label: { fontSize: 13, fontWeight: "600", color: "#5a6a68", marginBottom: 8 },
  muted: { marginTop: 8, color: "#5a6a68", lineHeight: 22 },
  ttlRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 12, gap: 8 },
  ttlChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#e8e2d4",
  },
  ttlChipActive: { backgroundColor: "#0f6b5c" },
  ttlChipText: { color: "#1c2b2a", fontWeight: "600", fontSize: 13 },
  ttlChipTextActive: { color: "#fff" },
  input: {
    borderWidth: 1,
    borderColor: "#cfc6b4",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
    color: "#1c2b2a",
    fontSize: 16,
    marginBottom: 10,
  },
  btn: {
    backgroundColor: "#0f6b5c",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  btnGhost: {
    backgroundColor: "#e8e2d4",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  btnGhostText: { color: "#1c2b2a", fontWeight: "600" },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontWeight: "600" },
  item: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cfc6b4",
    backgroundColor: "#fffdf8",
    marginBottom: 8,
  },
  itemActive: { borderColor: "#0f6b5c" },
  itemTitle: { fontWeight: "700", color: "#1c2b2a" },
  thread: { marginTop: 16 },
  bubble: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#e8e2d4",
    marginBottom: 8,
    maxWidth: "88%",
  },
  bubbleMine: {
    alignSelf: "flex-end",
    backgroundColor: "#d5ebe6",
  },
  bubblePeer: {
    alignSelf: "flex-start",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
    marginTop: 4,
  },
  receipt: {
    color: "#5a6a68",
    fontSize: 13,
    fontWeight: "600",
  },
  receiptRead: {
    color: "#0f6b5c",
  },
  body: { color: "#1c2b2a", fontSize: 16, lineHeight: 24 },
  remoteVideo: {
    width: "100%",
    height: 220,
    backgroundColor: "#18232b",
    marginBottom: 12,
    borderRadius: 8,
  },
});
