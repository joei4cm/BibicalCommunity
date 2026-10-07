import { useEffect, useState } from "react";
import {
  Text,
  View,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Switch,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { t, type LocaleCode, type PrivacySettings } from "@logoshome/shared";
import { api, getApiBase, getToken, hydrateToken, setToken } from "../../src/api";
import { normalizeApiLocale, useLocale } from "../../src/locale";
import { humanizeStatus } from "../../src/status";

const LOCALES: { id: LocaleCode; label: string }[] = [
  { id: "zh-CN", label: "中文" },
  { id: "en", label: "English" },
  { id: "ja", label: "日本語" },
];

const DEFAULT_PRIVACY: PrivacySettings = {
  discoverableByHandle: true,
  discoverableByUid: true,
  showInChurchDirectory: true,
  allowMessageRequests: "church-only",
  shareReadReceipts: true,
  shareTypingIndicators: true,
  shareLastActive: false,
};

type MeChurch = {
  churchId: string;
  role: string;
  verified: boolean;
  groups: string[];
};

type MeProfile = {
  id: string;
  uid: string;
  nickname: string | null;
  legalName: string | null;
  signature: string | null;
  privacy?: PrivacySettings;
  churches?: MeChurch[];
};

type SearchHit = { id: string; uid: string; nickname: string | null };

async function clearLocalStorage(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const lhKeys = keys.filter((k) => k.startsWith("lh."));
  await Promise.all(lhKeys.map((k) => AsyncStorage.removeItem(k)));
}

export default function MeScreen() {
  const { locale, setLocale } = useLocale();
  const [handle, setHandle] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [legalName, setLegalName] = useState("");
  const [signature, setSignature] = useState("");
  const [profile, setProfile] = useState<MeProfile | null>(null);
  const [privacy, setPrivacy] = useState<PrivacySettings>(DEFAULT_PRIVACY);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<SearchHit[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    await hydrateToken();
    if (!getApiBase() || !getToken()) return;
    const me = await api<MeProfile>("/v1/me");
    setProfile(me);
    if (me.nickname) setNickname(me.nickname);
    if (me.legalName) setLegalName(me.legalName);
    if (me.signature) setSignature(me.signature);
    if (me.privacy) setPrivacy({ ...DEFAULT_PRIVACY, ...me.privacy });
  }

  async function checkPendingWipe() {
    await hydrateToken();
    if (!getApiBase() || !getToken()) return;
    try {
      const res = await api<{ commands: { id: string }[] }>("/v1/admin/wipe/pending");
      if (!res.commands?.length) return;
      const token = getToken();
      await clearLocalStorage();
      await setToken(null);
      setProfile(null);
      setMsg("wiped");
      if (!token) return;
      const base = getApiBase();
      for (const cmd of res.commands) {
        try {
          await fetch(`${base}/v1/admin/wipe/${cmd.id}/ack`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          });
        } catch {
          /* best-effort ack */
        }
      }
    } catch {
      /* not logged in */
    }
  }

  useEffect(() => {
    void refresh().catch(() => undefined);
    void checkPendingWipe();
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
          locale: normalizeApiLocale(locale),
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
      await checkPendingWipe();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "error");
    }
  }

  async function saveProfile() {
    if (!getApiBase() || !getToken()) {
      setMsg("login_required");
      return;
    }
    setBusy(true);
    try {
      await api("/v1/me", {
        method: "PATCH",
        body: JSON.stringify({
          nickname: nickname || undefined,
          signature,
          legalName,
          privacy: {
            discoverableByHandle: privacy.discoverableByHandle,
            discoverableByUid: privacy.discoverableByUid,
            showInChurchDirectory: privacy.showInChurchDirectory,
            allowMessageRequests: privacy.allowMessageRequests,
          },
        }),
      });
      setMsg("saved");
      await refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }

  async function searchUsers() {
    if (!getApiBase() || !getToken()) {
      setMsg("login_required");
      return;
    }
    const q = searchQ.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await api<{ results: SearchHit[] }>(
        `/v1/me/search?q=${encodeURIComponent(q)}`,
      );
      setSearchResults(res.results);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "error");
    }
  }

  function confirmWipe() {
    Alert.alert(t(locale, "security.wipe"), t(locale, "security.wipeConfirm"), [
      { text: "Cancel", style: "cancel" },
      {
        text: t(locale, "security.wipe"),
        style: "destructive",
        onPress: () => void selfWipe(),
      },
    ]);
  }

  async function selfWipe() {
    if (!getApiBase() || !getToken() || !profile?.id) {
      setMsg("login_required");
      return;
    }
    setBusy(true);
    try {
      await api("/v1/admin/wipe", {
        method: "POST",
        body: JSON.stringify({ userId: profile.id, reasonCode: "self" }),
      });
      await clearLocalStorage();
      await setToken(null);
      setProfile(null);
      setMsg("wiped");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }

  const statusText = humanizeStatus(locale, msg);

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
      <Text style={styles.label}>{t(locale, "me.nickname")}</Text>
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
      {statusText && <Text style={styles.muted}>{statusText}</Text>}

      <Text style={[styles.section, { marginTop: 28 }]}>{t(locale, "me.profile")}</Text>
      <Text style={styles.label}>{t(locale, "me.nickname")}</Text>
      <TextInput style={styles.input} value={nickname} onChangeText={setNickname} />
      <Text style={styles.label}>{t(locale, "me.legalName")}</Text>
      <TextInput style={styles.input} value={legalName} onChangeText={setLegalName} />
      <Text style={styles.label}>{t(locale, "me.signature")}</Text>
      <TextInput
        style={[styles.input, styles.textarea]}
        value={signature}
        onChangeText={setSignature}
        multiline
        textAlignVertical="top"
      />
      <Pressable
        style={[styles.btn, { marginTop: 12 }, busy && styles.btnDisabled]}
        disabled={busy}
        onPress={() => void saveProfile()}
      >
        <Text style={styles.btnText}>{t(locale, "me.save")}</Text>
      </Pressable>

      <Text style={[styles.section, { marginTop: 28 }]}>{t(locale, "me.privacy")}</Text>
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>{t(locale, "me.discoverableByHandle")}</Text>
        <Switch
          value={privacy.discoverableByHandle}
          onValueChange={(v) => setPrivacy((p) => ({ ...p, discoverableByHandle: v }))}
          trackColor={{ true: "#0f6b5c" }}
        />
      </View>
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>{t(locale, "me.discoverableByUid")}</Text>
        <Switch
          value={privacy.discoverableByUid}
          onValueChange={(v) => setPrivacy((p) => ({ ...p, discoverableByUid: v }))}
          trackColor={{ true: "#0f6b5c" }}
        />
      </View>
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>{t(locale, "me.showInChurchDirectory")}</Text>
        <Switch
          value={privacy.showInChurchDirectory}
          onValueChange={(v) => setPrivacy((p) => ({ ...p, showInChurchDirectory: v }))}
          trackColor={{ true: "#0f6b5c" }}
        />
      </View>
      <Pressable
        style={[styles.btn, { marginTop: 12 }, busy && styles.btnDisabled]}
        disabled={busy}
        onPress={() => void saveProfile()}
      >
        <Text style={styles.btnText}>{t(locale, "me.save")}</Text>
      </Pressable>

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

      <Text style={[styles.section, { marginTop: 28 }]}>{t(locale, "me.churches")}</Text>
      {!profile?.churches?.length ? (
        <Text style={styles.muted}>—</Text>
      ) : (
        profile.churches.map((c) => (
          <View key={c.churchId} style={styles.listItem}>
            <Text style={styles.strong}>{c.churchId}</Text>
            <Text style={styles.muted}>
              {c.role}
              {c.verified ? ` · ${t(locale, "me.verified")}` : ""}
            </Text>
          </View>
        ))
      )}

      <Text style={[styles.section, { marginTop: 28 }]}>{t(locale, "me.search")}</Text>
      <Text style={styles.label}>{t(locale, "me.searchUid")}</Text>
      <TextInput
        style={styles.input}
        value={searchQ}
        onChangeText={setSearchQ}
        placeholder="UID"
        autoCapitalize="none"
      />
      <Pressable style={[styles.btn, { marginTop: 12 }]} onPress={() => void searchUsers()}>
        <Text style={styles.btnText}>{t(locale, "me.search")}</Text>
      </Pressable>
      {searchResults.map((r) => (
        <View key={r.id} style={styles.listItem}>
          <Text style={styles.strong}>{r.uid}</Text>
          {r.nickname ? <Text style={styles.muted}>{r.nickname}</Text> : null}
        </View>
      ))}

      <Text style={[styles.section, { marginTop: 28 }]}>{t(locale, "security.wipe")}</Text>
      <Text style={styles.muted}>{t(locale, "security.wipeHint")}</Text>
      <Pressable
        style={[styles.btn, styles.btnDanger, { marginTop: 12 }, busy && styles.btnDisabled]}
        disabled={busy}
        onPress={confirmWipe}
      >
        <Text style={styles.btnText}>{t(locale, "security.wipe")}</Text>
      </Pressable>
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
  textarea: { minHeight: 72 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 16 },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    gap: 12,
  },
  toggleLabel: { flex: 1, color: "#1c2b2a", fontSize: 15 },
  btn: {
    backgroundColor: "#0f6b5c",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnGhost: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#0f6b5c" },
  btnDanger: { backgroundColor: "#9b2c2c" },
  btnText: { color: "#fff", fontWeight: "600" },
  btnGhostText: { color: "#0f6b5c" },
  body: { marginTop: 16, color: "#1c2b2a", fontSize: 16 },
  strong: { fontWeight: "700", color: "#1c2b2a" },
  muted: { marginTop: 12, color: "#5a6a68", lineHeight: 22 },
  listItem: { marginTop: 10 },
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
