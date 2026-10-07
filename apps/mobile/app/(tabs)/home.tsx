import { useCallback, useEffect, useState } from "react";
import {
  Text,
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { t } from "@logoshome/shared";
import { api, getApiBase, getToken, hydrateToken } from "../../src/api";
import { useLocale } from "../../src/locale";
import { humanizeStatus } from "../../src/status";

type Church = {
  id: string;
  name: string;
  slug?: string;
  role: string;
  verified: boolean;
};

type ForumPost = {
  id: string;
  board: string;
  title: string;
  body: string;
  externalMediaUrl?: string | null;
  createdAt: number;
};

export default function HomeChurchScreen() {
  const { locale } = useLocale();
  const router = useRouter();
  const [churches, setChurches] = useState<Church[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    await hydrateToken();
    if (!getApiBase()) {
      setNote("EXPO_PUBLIC_API_BASE not set");
      setChurches([]);
      return;
    }
    if (!getToken()) {
      setNote("login_required");
      setChurches([]);
      return;
    }
    const r = await api<{ churches: Church[] }>("/v1/home/churches");
    setChurches(r.churches);
    setNote(null);
    if (!selectedId && r.churches[0]) setSelectedId(r.churches[0].id);
  }, [selectedId]);

  const loadPosts = useCallback(async (churchId: string) => {
    const r = await api<{ posts: ForumPost[] }>(
      `/v1/home/${encodeURIComponent(churchId)}/posts?board=general`,
    );
    setPosts(r.posts ?? []);
  }, []);

  useEffect(() => {
    void refresh()
      .catch((e) => setNote(e instanceof Error ? e.message : "error"))
      .finally(() => setReady(true));
  }, [refresh]);

  useEffect(() => {
    if (!selectedId || !getToken()) {
      setPosts([]);
      return;
    }
    void loadPosts(selectedId).catch((e) => setNote(e instanceof Error ? e.message : "error"));
  }, [selectedId, loadPosts]);

  async function createPost() {
    if (!selectedId || !title.trim() || !body.trim()) return;
    setBusy(true);
    try {
      await hydrateToken();
      if (!getToken()) {
        setNote("login_required");
        return;
      }
      await api("/v1/home/posts", {
        method: "POST",
        body: JSON.stringify({
          churchId: selectedId,
          board: "general",
          title: title.trim(),
          body: body.trim(),
        }),
      });
      setTitle("");
      setBody("");
      setNote("saved");
      await loadPosts(selectedId);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t(locale, "nav.home")}</Text>
      <Pressable style={styles.msgLink} onPress={() => router.push("/messages")}>
        <Text style={styles.msgLinkText}>{t(locale, "home.messages")} →</Text>
      </Pressable>
      {note && <Text style={styles.muted}>{humanizeStatus(locale, note)}</Text>}
      {!ready && <Text style={styles.muted}>…</Text>}

      <Text style={styles.section}>{t(locale, "me.churches")}</Text>
      <View style={styles.list}>
        {ready && churches.length === 0 && !note?.startsWith("login") && (
          <Text style={styles.muted}>{t(locale, "home.noChurches")}</Text>
        )}
        {churches.map((c) => (
          <Pressable
            key={c.id}
            style={[styles.item, selectedId === c.id && styles.itemActive]}
            onPress={() => setSelectedId(c.id)}
          >
            <Text style={styles.itemTitle}>{c.name}</Text>
            <Text style={styles.muted}>
              {c.role}
              {c.slug ? ` · ${c.slug}` : ""}
              {c.verified ? ` · ${t(locale, "me.verified")}` : ""}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.section}>{t(locale, "home.forum")}</Text>
      {posts.length === 0 && <Text style={styles.muted}>—</Text>}
      {posts.map((p) => (
        <View key={p.id} style={styles.item}>
          <Text style={styles.itemTitle}>{p.title}</Text>
          <Text style={styles.muted}>{p.body}</Text>
          {p.externalMediaUrl ? <Text style={styles.muted}>{p.externalMediaUrl}</Text> : null}
        </View>
      ))}

      {selectedId && (
        <View style={{ marginTop: 16 }}>
          <Text style={styles.section}>{t(locale, "home.newPost")}</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder={t(locale, "home.postTitle")}
          />
          <TextInput
            style={[styles.input, { minHeight: 80 }]}
            value={body}
            onChangeText={setBody}
            multiline
            placeholder={t(locale, "home.postBody")}
            textAlignVertical="top"
          />
          <Pressable
            style={[styles.btn, busy && styles.btnDisabled]}
            disabled={busy}
            onPress={() => void createPost()}
          >
            <Text style={styles.btnText}>{t(locale, "home.post")}</Text>
          </Pressable>
        </View>
      )}

      <Pressable
        style={[styles.btn, { marginTop: 16 }]}
        onPress={() => void refresh().catch((e) => setNote(e instanceof Error ? e.message : "error"))}
      >
        <Text style={styles.btnText}>Refresh</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f3efe6" },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: "700", color: "#1c2b2a" },
  section: { marginTop: 20, fontSize: 18, fontWeight: "600", color: "#1c2b2a" },
  muted: { marginTop: 8, color: "#5a6a68", lineHeight: 22 },
  msgLink: { marginTop: 8, marginBottom: 4 },
  msgLinkText: { color: "#0f6b5c", fontWeight: "600", fontSize: 16 },
  list: { marginTop: 8, gap: 8 },
  item: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cfc6b4",
    backgroundColor: "#fffdf8",
    marginTop: 8,
  },
  itemActive: { borderColor: "#0f6b5c" },
  itemTitle: { fontWeight: "700", color: "#1c2b2a" },
  input: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#cfc6b4",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#fff",
    color: "#1c2b2a",
    fontSize: 15,
  },
  btn: {
    marginTop: 12,
    backgroundColor: "#0f6b5c",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontWeight: "600" },
});
