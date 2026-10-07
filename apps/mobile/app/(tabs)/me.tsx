import { useEffect, useMemo, useState } from "react";
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
import {
  generateIdentityKeyPair,
  generateOneTimePrekeys,
  generateSignedPrekey,
} from "@logoshome/crypto";
import { api, getApiBase, getToken, hydrateToken, setToken } from "../../src/api";
import { ensureBase64Globals, hasWebCrypto } from "../../src/crypto-polyfill";
import { normalizeApiLocale, useLocale } from "../../src/locale";
import { NOTE_KEY_STORAGE } from "../../src/note-crypto";
import { humanizeStatus } from "../../src/status";
import { KNOWN_SECRET_KEYS, kvGet, kvSet, wipeSecureSecrets } from "../../src/secure-kv";
import {
  loadTheme,
  saveTheme,
  themePalette,
  THEME_IDS,
  type ThemeId,
  type ThemePalette,
} from "../../src/theme";

ensureBase64Globals();

const LOCALES: { id: LocaleCode; label: string }[] = [
  { id: "zh-CN", label: "中文" },
  { id: "en", label: "English" },
  { id: "ja", label: "日本語" },
];

const DEVICE_PRIV_KEY = "lh.device.priv";

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
  name?: string | null;
  slug?: string | null;
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
  await wipeSecureSecrets([...KNOWN_SECRET_KEYS, NOTE_KEY_STORAGE]);
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
  const [keyBusy, setKeyBusy] = useState(false);
  const [hasDeviceKey, setHasDeviceKey] = useState(false);
  const [theme, setThemeState] = useState<ThemeId>("day");
  const palette = useMemo(() => themePalette(theme), [theme]);
  const styles = useMemo(() => makeStyles(palette), [palette]);

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
      setHasDeviceKey(false);
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
    void (async () => {
      const stored = await loadTheme();
      setThemeState(stored);
      const { value: priv } = await kvGet(DEVICE_PRIV_KEY);
      setHasDeviceKey(Boolean(priv));
      await refresh().catch(() => undefined);
      await checkPendingWipe();
    })();
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
          theme,
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

  async function changeTheme(next: ThemeId) {
    setThemeState(next);
    await saveTheme(next);
    if (getToken()) {
      try {
        await api("/v1/me", {
          method: "PATCH",
          body: JSON.stringify({ theme: next }),
        });
      } catch {
        /* local theme still applied */
      }
    }
  }

  async function uploadDeviceKeys() {
    if (!getApiBase() || !getToken()) {
      setMsg("login_required");
      return;
    }
    if (!hasWebCrypto()) {
      setMsg("webcrypto_unavailable");
      return;
    }
    setKeyBusy(true);
    try {
      const identity = await generateIdentityKeyPair();
      const signedPrekey = await generateSignedPrekey(identity, 1);
      const oneTimePrekeys = await generateOneTimePrekeys(5, 1);
      const registrationId = Math.floor(Math.random() * 16380) + 1;

      await kvSet(
        DEVICE_PRIV_KEY,
        JSON.stringify({
          identity,
          signedPrekey,
          oneTimePrekeys,
          registrationId,
          createdAt: Date.now(),
        }),
      );

      await api("/v1/keys/bundle", {
        method: "PUT",
        body: JSON.stringify({
          identityKeyPub: JSON.stringify({
            ecdh: identity.publicKey,
            signing: identity.signingPublicKey,
          }),
          signedPrekeyPub: JSON.stringify(signedPrekey.publicKey),
          signedPrekeySig: signedPrekey.signature,
          signedPrekeyId: signedPrekey.id,
          registrationId,
        }),
      });

      await api("/v1/keys/prekeys", {
        method: "PUT",
        body: JSON.stringify({
          prekeys: oneTimePrekeys.map((pk) => ({
            id: pk.id,
            pub: JSON.stringify(pk.publicKey),
          })),
        }),
      });

      setHasDeviceKey(true);
      setMsg("keys_uploaded");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "keys_failed");
    } finally {
      setKeyBusy(false);
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
      const wipeRes = await api<{ id: string; wipeToken: string }>("/v1/admin/wipe", {
        method: "POST",
        body: JSON.stringify({ userId: profile.id, reasonCode: "self" }),
      });
      try {
        await fetch(`${getApiBase()}/v1/admin/wipe/${wipeRes.id}/ack`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wipeToken: wipeRes.wipeToken }),
        });
      } catch {
        /* best-effort ack after session revoke */
      }
      await clearLocalStorage();
      await setToken(null);
      setProfile(null);
      setHasDeviceKey(false);
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
          trackColor={{ true: palette.accent }}
        />
      </View>
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>{t(locale, "me.discoverableByUid")}</Text>
        <Switch
          value={privacy.discoverableByUid}
          onValueChange={(v) => setPrivacy((p) => ({ ...p, discoverableByUid: v }))}
          trackColor={{ true: palette.accent }}
        />
      </View>
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>{t(locale, "me.showInChurchDirectory")}</Text>
        <Switch
          value={privacy.showInChurchDirectory}
          onValueChange={(v) => setPrivacy((p) => ({ ...p, showInChurchDirectory: v }))}
          trackColor={{ true: palette.accent }}
        />
      </View>
      <Pressable
        style={[styles.btn, { marginTop: 12 }, busy && styles.btnDisabled]}
        disabled={busy}
        onPress={() => void saveProfile()}
      >
        <Text style={styles.btnText}>{t(locale, "me.save")}</Text>
      </Pressable>

      <Text style={styles.label}>{t(locale, "landing.theme")}</Text>
      <View style={styles.row}>
        {THEME_IDS.map((id) => {
          const active = id === theme;
          return (
            <Pressable
              key={id}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => void changeTheme(id)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{id}</Text>
            </Pressable>
          );
        })}
      </View>

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

      <Text style={[styles.section, { marginTop: 28 }]}>{t(locale, "security.deviceKeys")}</Text>
      <Text style={styles.muted}>{t(locale, "security.deviceKeysHint")}</Text>
      <Text style={styles.muted}>
        {hasDeviceKey ? t(locale, "security.deviceKeysPresent") : t(locale, "security.deviceKeysMissing")}
      </Text>
      <Pressable
        style={[styles.btn, { marginTop: 12 }, keyBusy && styles.btnDisabled]}
        disabled={keyBusy}
        onPress={() => void uploadDeviceKeys()}
      >
        <Text style={styles.btnText}>{t(locale, "security.uploadKeys")}</Text>
      </Pressable>

      <Text style={[styles.section, { marginTop: 28 }]}>{t(locale, "me.churches")}</Text>
      {!profile?.churches?.length ? (
        <Text style={styles.muted}>—</Text>
      ) : (
        profile.churches.map((c) => (
          <View key={c.churchId} style={styles.listItem}>
            <Text style={styles.strong}>{c.name ?? c.churchId}</Text>
            <Text style={styles.muted}>
              {c.role}
              {c.slug ? ` · ${c.slug}` : ""}
              {c.verified
                ? ` · ${t(locale, "me.verified")}`
                : ` · ${t(locale, "me.pendingVerify")}`}
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

function makeStyles(p: ThemePalette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: p.bg },
    content: { padding: 20, paddingBottom: 40 },
    title: { fontSize: 28, fontWeight: "700", color: p.text },
    section: { fontSize: 18, fontWeight: "600", color: p.text },
    label: { marginTop: 14, marginBottom: 6, fontSize: 13, fontWeight: "600", color: p.muted },
    input: {
      borderWidth: 1,
      borderColor: p.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: p.surface,
      color: p.text,
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
    toggleLabel: { flex: 1, color: p.text, fontSize: 15 },
    btn: {
      backgroundColor: p.accent,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
    },
    btnDisabled: { opacity: 0.6 },
    btnGhost: { backgroundColor: "transparent", borderWidth: 1, borderColor: p.accent },
    btnDanger: { backgroundColor: p.danger },
    btnText: { color: p.id === "highContrast" ? "#000" : "#fff", fontWeight: "600" },
    btnGhostText: { color: p.accent },
    body: { marginTop: 16, color: p.text, fontSize: 16 },
    strong: { fontWeight: "700", color: p.text },
    muted: { marginTop: 12, color: p.muted, lineHeight: 22 },
    listItem: { marginTop: 10 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: p.chip,
    },
    chipActive: { backgroundColor: p.accent },
    chipText: { color: p.text, fontWeight: "600" },
    chipTextActive: { color: p.id === "highContrast" ? "#000" : "#fff" },
  });
}
