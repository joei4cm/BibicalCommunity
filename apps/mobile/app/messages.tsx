import { useCallback, useEffect, useState } from "react";
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
import { t } from "@logoshome/shared";
import { api, getApiBase, getToken, hydrateToken } from "../src/api";
import { useLocale } from "../src/locale";
import { humanizeStatus } from "../src/status";

type Conversation = {
  id: string;
  kind: string;
  title: string | null;
  disappearingTtlSec: number | null;
  archived?: boolean;
};

type ChatMessage = {
  id: string;
  ratchetHeader: string;
  ciphertext: string;
  createdAt: number;
  expiresAt: number | null;
};

/**
 * Mobile chat: lists conversations and posts ciphertext payloads.
 * Full Double Ratchet UX remains richest on web ChatPanel; mobile stores
 * plaintext locally keyed by message id for display after send.
 */
export default function MessagesScreen() {
  const { locale } = useLocale();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [plaintexts, setPlaintexts] = useState<Record<string, string>>({});
  const [memberIds, setMemberIds] = useState("");
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    await hydrateToken();
    if (!getApiBase()) {
      setNote("EXPO_PUBLIC_API_BASE not set");
      return;
    }
    if (!getToken()) {
      setNote("login_required");
      return;
    }
    const res = await api<{ conversations: Conversation[] }>("/v1/chat/conversations");
    setConversations(res.conversations.filter((c) => !c.archived));
    setNote(null);
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    const res = await api<{ messages: ChatMessage[] }>(
      `/v1/chat/conversations/${conversationId}/messages`,
    );
    const now = Date.now();
    const live = res.messages.filter((m) => m.expiresAt == null || m.expiresAt > now);
    setMessages(live);
    const decoded: Record<string, string> = {};
    for (const m of live) {
      decoded[m.id] = plaintexts[m.id] ?? "[ciphertext]";
    }
    setPlaintexts((prev) => ({ ...prev, ...decoded }));
  }, [plaintexts]);

  useEffect(() => {
    void refresh().catch((e) => setNote(e instanceof Error ? e.message : "error"));
  }, [refresh]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    void loadMessages(selectedId).catch((e) => setNote(e instanceof Error ? e.message : "error"));
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps -- avoid load loop on plaintexts

  async function createDm() {
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
        body: JSON.stringify({ kind: "dm", memberIds: ids }),
      });
      setMemberIds("");
      await refresh();
      setSelectedId(res.id);
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
      // Mobile posts opaque ciphertext; ratchet UX is denser on web.
      const text = draft.trim();
      const payload = {
        ratchetHeader: btoa(`mobile:${selectedId}`),
        ciphertext: btoa(unescape(encodeURIComponent(text))),
        contentType: "msg" as const,
      };
      const res = await api<{ id: string }>(`/v1/chat/conversations/${selectedId}/messages`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setPlaintexts((p) => ({ ...p, [res.id]: text }));
      setDraft("");
      await loadMessages(selectedId);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backText}>← {t(locale, "nav.home")}</Text>
      </Pressable>
      <Text style={styles.title}>{t(locale, "home.messages")}</Text>
      {note && <Text style={styles.muted}>{humanizeStatus(locale, note)}</Text>}

      <Text style={styles.section}>{t(locale, "chat.newConversation")}</Text>
      <TextInput
        style={styles.input}
        value={memberIds}
        onChangeText={setMemberIds}
        placeholder="usr_…"
        autoCapitalize="none"
      />
      <Pressable
        style={[styles.btn, busy && styles.btnDisabled]}
        disabled={busy}
        onPress={() => void createDm()}
      >
        <Text style={styles.btnText}>
          {t(locale, "chat.dm")} / {t(locale, "chat.group")}
        </Text>
      </Pressable>

      <Text style={styles.section}>{t(locale, "home.messages")}</Text>
      {conversations.length === 0 && <Text style={styles.muted}>{t(locale, "chat.empty")}</Text>}
      {conversations.map((c) => (
        <Pressable
          key={c.id}
          style={[styles.item, selectedId === c.id && styles.itemActive]}
          onPress={() => setSelectedId(c.id)}
        >
          <Text style={styles.itemTitle}>{c.title ?? c.kind}</Text>
          <Text style={styles.muted}>{c.id}</Text>
        </Pressable>
      ))}

      {selectedId && (
        <View style={styles.thread}>
          {busy && <ActivityIndicator color="#0f6b5c" />}
          {messages.map((m) => (
            <View key={m.id} style={styles.bubble}>
              <Text style={styles.body}>{plaintexts[m.id] ?? "[ciphertext]"}</Text>
              <Text style={styles.muted}>{new Date(m.createdAt).toLocaleString()}</Text>
            </View>
          ))}
          <TextInput
            style={[styles.input, { minHeight: 72 }]}
            value={draft}
            onChangeText={setDraft}
            multiline
            placeholder={t(locale, "chat.send")}
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
  muted: { marginTop: 8, color: "#5a6a68", lineHeight: 22 },
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
  },
  body: { color: "#1c2b2a", fontSize: 16, lineHeight: 24 },
});
