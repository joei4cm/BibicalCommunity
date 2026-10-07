import { useCallback, useEffect, useState } from "react";
import { Text, View, StyleSheet, Pressable, ScrollView } from "react-native";
import { t } from "@logoshome/shared";
import { api, getApiBase, getToken, hydrateToken } from "../../src/api";
import { useLocale } from "../../src/locale";

type Church = {
  id: string;
  name: string;
  slug?: string;
  role: string;
  verified: boolean;
};

export default function HomeChurchScreen() {
  const { locale } = useLocale();
  const [churches, setChurches] = useState<Church[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

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
  }, []);

  useEffect(() => {
    void refresh()
      .catch((e) => setNote(e instanceof Error ? e.message : "error"))
      .finally(() => setReady(true));
  }, [refresh]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t(locale, "nav.home")}</Text>
      <Text style={styles.section}>{t(locale, "home.forum")}</Text>
      {note && <Text style={styles.muted}>{note}</Text>}
      {!ready && <Text style={styles.muted}>…</Text>}
      <View style={styles.list}>
        {ready && churches.length === 0 && !note?.startsWith("login") && (
          <Text style={styles.muted}>{t(locale, "home.noChurches")}</Text>
        )}
        {churches.map((c) => (
          <View key={c.id} style={styles.item}>
            <Text style={styles.itemTitle}>{c.name}</Text>
            <Text style={styles.muted}>
              {c.role}
              {c.slug ? ` · ${c.slug}` : ""}
              {c.verified ? ` · ${t(locale, "me.verified")}` : ""}
            </Text>
          </View>
        ))}
      </View>
      <Pressable style={styles.btn} onPress={() => void refresh().catch((e) => setNote(e instanceof Error ? e.message : "error"))}>
        <Text style={styles.btnText}>Refresh</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f3efe6" },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: "700", color: "#1c2b2a" },
  section: { marginTop: 16, fontSize: 18, fontWeight: "600", color: "#1c2b2a" },
  muted: { marginTop: 8, color: "#5a6a68", lineHeight: 22 },
  list: { marginTop: 12, gap: 12 },
  item: { paddingVertical: 4 },
  itemTitle: { fontSize: 16, fontWeight: "700", color: "#1c2b2a" },
  btn: {
    marginTop: 20,
    backgroundColor: "#0f6b5c",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  btnText: { color: "#fff", fontWeight: "600" },
});
