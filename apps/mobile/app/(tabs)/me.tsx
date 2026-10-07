import { useEffect, useState } from "react";
import {
  Text,
  View,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
} from "react-native";
import { t, type LocaleCode } from "@logoshome/shared";
import { api, getApiBase, getToken, hydrateToken, setToken } from "../../src/api";
import { useLocale } from "../../src/locale";

const LOCALES: { id: LocaleCode; label: string }[] = [
  { id: "zh-CN", label: "中文" },
  { id: "en", label: "English" },
  { id: "ja", label: "日本語" },
];

export default function MeScreen() {
  const { locale, setLocale } = useLocale();
  const [handle, setHandle] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [profile, setProfile] = useState<{ uid?: string; signature?: string | null } | null>(
    null,
  );
  const [msg, setMsg] = useState<string | null>(null);

  async function refresh() {
    await hydrateToken();
    if (!getApiBase() || !getToken()) return;
    const me = await api<{ uid: string; signature: string | null; nickname: string | null }>(
      "/v1/me",
    );
    setProfile(me);
    if (me.nickname) setNickname(me.nickname);
  }

  useEffect(() => {
    void refresh().catch(() => undefined);
  }, []);

  async function register() {
    if (!getApiBase()) {
      setMsg("EXPO_PUBLIC_API_BASE not set");
      return;
    }
    try {
      const res = await api<{ token: string }>("/v1/auth/register", {
        method: "POST",
        body: JSON.stringify({
          handle,
          password,
          nickname: nickname || handle,
          locale,
        }),
      });
      await setToken(res.token);
      setMsg("registered");
      await refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "error");
    }
  }

  async function login() {
    if (!getApiBase()) {
      setMsg("EXPO_PUBLIC_API_BASE not set");
      return;
    }
    try {
      const res = await api<{ token: string }>("/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ handleOrEmail: handle, password, platform: "ios" }),
      });
      await setToken(res.token);
      setMsg("logged_in");
      await refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "error");
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t(locale, "nav.me")}</Text>

      <Text style={styles.label}>Handle / UID</Text>
      <TextInput style={styles.input} value={handle} onChangeText={setHandle} autoCapitalize="none" />
      <Text style={styles.label}>Password</Text>
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Text style={styles.label}>Nickname</Text>
      <TextInput style={styles.input} value={nickname} onChangeText={setNickname} />

      <View style={styles.row}>
        <Pressable style={styles.btn} onPress={() => void register()}>
          <Text style={styles.btnText}>{t(locale, "auth.register")}</Text>
        </Pressable>
        <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => void login()}>
          <Text style={[styles.btnText, styles.btnGhostText]}>{t(locale, "auth.login")}</Text>
        </Pressable>
      </View>

      {profile?.uid && (
        <Text style={styles.body}>
          UID: <Text style={styles.strong}>{profile.uid}</Text>
        </Text>
      )}
      {msg && <Text style={styles.muted}>{msg}</Text>}

      <Text style={[styles.section, { marginTop: 28 }]}>{t(locale, "me.privacy")}</Text>
      <Text style={styles.label}>Language</Text>
      <View style={styles.row}>
        {LOCALES.map((item) => {
          const active = item.id === locale;
          return (
            <Pressable
              key={item.id}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setLocale(item.id)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.muted}>
        {t(locale, "me.privacy")} · {t(locale, "security.wipe")}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f3efe6" },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: "700", color: "#1c2b2a" },
  section: { fontSize: 18, fontWeight: "600", color: "#1c2b2a" },
  label: { marginTop: 14, marginBottom: 6, fontSize: 13, fontWeight: "600", color: "#5a6a68" },
  input: {
    borderWidth: 1,
    borderColor: "#cfc6b4",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
    color: "#1c2b2a",
    fontSize: 16,
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 16 },
  btn: {
    backgroundColor: "#0f6b5c",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  btnGhost: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#0f6b5c" },
  btnText: { color: "#fff", fontWeight: "600" },
  btnGhostText: { color: "#0f6b5c" },
  body: { marginTop: 16, color: "#1c2b2a", fontSize: 16 },
  strong: { fontWeight: "700" },
  muted: { marginTop: 12, color: "#5a6a68", lineHeight: 22 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#e8e2d4",
  },
  chipActive: { backgroundColor: "#0f6b5c" },
  chipText: { color: "#1c2b2a", fontWeight: "600" },
  chipTextActive: { color: "#fff" },
});
