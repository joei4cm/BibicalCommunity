import { Text, View, StyleSheet, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { t } from "@logoshome/shared";
import { useLocale } from "../src/locale";

/** Lightweight chat stub — full E2EE chat lives on web ChatPanel for now. */
export default function MessagesScreen() {
  const { locale } = useLocale();
  const router = useRouter();

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backText}>← {t(locale, "nav.home")}</Text>
      </Pressable>
      <Text style={styles.title}>{t(locale, "home.messages")}</Text>
      <Text style={styles.muted}>{t(locale, "chat.empty")}</Text>
      <View style={styles.stub}>
        <Text style={styles.stubTitle}>{t(locale, "chat.newConversation")}</Text>
        <Text style={styles.muted}>
          {t(locale, "chat.dm")} · {t(locale, "chat.group")}
        </Text>
        <Text style={[styles.muted, { marginTop: 12 }]}>
          Secure messaging stub — open the web app for full Double Ratchet chat.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f3efe6" },
  content: { padding: 20, paddingBottom: 40, paddingTop: 56 },
  back: { marginBottom: 12 },
  backText: { color: "#0f6b5c", fontWeight: "600", fontSize: 15 },
  title: { fontSize: 28, fontWeight: "700", color: "#1c2b2a" },
  muted: { marginTop: 8, color: "#5a6a68", lineHeight: 22 },
  stub: {
    marginTop: 20,
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cfc6b4",
    backgroundColor: "#fffdf8",
  },
  stubTitle: { fontSize: 16, fontWeight: "700", color: "#1c2b2a" },
});
