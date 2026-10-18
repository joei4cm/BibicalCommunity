import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  THEME_IDS,
  normalizeLocale,
  type PrivacySettings,
  type ThemeId,
} from "@logoshome/shared";
import { applyTheme } from "@logoshome/ui";
import { api, getApiBase, getToken, setToken } from "../lib/api";
import { wipeLocalClientState } from "../lib/local-wipe";
import {
  loadProductSignalPrefer,
  saveProductSignalPrefer,
  type ProductSignalPrefer,
} from "../lib/product-signal-prefer";
import { hasLocalDeviceKeys, uploadDeviceKeyBundle } from "../lib/upload-device-keys";
import { humanizeStatus } from "../lib/status";
import { APP_VERSION } from "../lib/app-version";
import { buildDeviceName, detectDevicePlatform, platformLabel } from "../lib/device-label";
import {
  requestNotificationPermission,
  saveNotifyPrefs,
} from "../lib/notify";
import { cachedSelfNickname, clearSelfNickname, persistSelfNickname } from "../lib/peer-labels";

function authDevicePayload() {
  const detected = detectDevicePlatform();
  const platform = detected === "ios" || detected === "android" ? detected : "web";
  return { platform, deviceName: buildDeviceName(detected) };
}

function friendlyDeviceTitle(d: { name: string | null; platform: string }): string {
  const raw = (d.name || "").trim();
  if (!raw || /^primary$/i.test(raw) || raw === d.platform) {
    return platformLabel(d.platform);
  }
  return raw;
}

type MeSection = "personal" | "devices" | "system";

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
  privacy: PrivacySettings;
  churches: MeChurch[];
  canAccessAdminConsole?: boolean;
  platformAdmin?: boolean;
};

type PendingWipe = {
  id: string;
  deviceId: string | null;
  reasonCode: string;
  expiresAt: number;
};

const DEFAULT_PRIVACY: PrivacySettings = {
  discoverableByHandle: true,
  discoverableByUid: true,
  showInChurchDirectory: true,
  allowMessageRequests: "church-only",
  shareReadReceipts: true,
  shareTypingIndicators: true,
  shareLastActive: false,
  notifyMessages: true,
  notifyCalls: true,
};

export function MePage() {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const keysPanelRef = useRef<HTMLDivElement | null>(null);
  const [meSection, setMeSection] = useState<MeSection>("personal");
  const [keysPanelOpen, setKeysPanelOpen] = useState(true);
  const [handle, setHandle] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [signature, setSignature] = useState("");
  const [legalName, setLegalName] = useState("");
  const [privacy, setPrivacy] = useState<PrivacySettings>(DEFAULT_PRIVACY);
  const [profile, setProfile] = useState<MeProfile | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pendingWipes, setPendingWipes] = useState<PendingWipe[]>([]);
  const [keyBusy, setKeyBusy] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [hasDeviceKey, setHasDeviceKey] = useState(false);
  const [signalPrefer, setSignalPrefer] = useState<ProductSignalPrefer>(() =>
    loadProductSignalPrefer(),
  );
  const [devices, setDevices] = useState<
    {
      id: string;
      platform: string;
      name: string | null;
      revoked: boolean;
      createdAt: number;
      hasIdentityKey: boolean;
      isCurrent: boolean;
    }[]
  >([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
  const [themeId, setThemeId] = useState<ThemeId>(
    () => (localStorage.getItem("lh.theme") as ThemeId) ?? "day",
  );

  useEffect(() => {
    void hasLocalDeviceKeys().then(setHasDeviceKey);
  }, []);

  async function refreshDevices() {
    if (!getToken()) {
      setDevices([]);
      setCurrentDeviceId(null);
      return;
    }
    const res = await api<{
      currentDeviceId: string;
      devices: typeof devices;
    }>("/v1/me/devices");
    setCurrentDeviceId(res.currentDeviceId);
    setDevices(res.devices);
  }

  async function revokeDevice(deviceId: string) {
    setAuthBusy(true);
    try {
      await api(`/v1/me/devices/${encodeURIComponent(deviceId)}/revoke`, { method: "POST" });
      await refreshDevices();
      setMsg("device_revoked");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "error");
    } finally {
      setAuthBusy(false);
    }
  }

  const isChurchAdmin = profile?.churches?.some((c) => {
    const roles = (c as { roles?: string[] }).roles ?? [c.role];
    return roles.includes("security_officer") || roles.includes("admin");
  });

  async function refresh() {
    if (!getToken()) return;
    const me = await api<MeProfile>("/v1/me");
    setProfile(me);
    if (me.nickname) setNickname(me.nickname);
    if (me.legalName) setLegalName(me.legalName);
    if (me.signature) setSignature(me.signature);
    if (me.nickname) persistSelfNickname(me.nickname);
    if (me.privacy) {
      const next = { ...DEFAULT_PRIVACY, ...me.privacy };
      setPrivacy(next);
      saveNotifyPrefs({
        notifyMessages: next.notifyMessages,
        notifyCalls: next.notifyCalls,
      });
    }
  }

  async function checkPendingWipe() {
    if (!getToken()) return;
    try {
      const res = await api<{ commands?: PendingWipe[] }>("/v1/admin/wipe/pending");
      const commands = Array.isArray(res.commands) ? res.commands : [];
      setPendingWipes(commands);
      if (commands.length > 0) {
        await applyRemoteWipe(commands);
      }
    } catch {
      /* not logged in or network */
    }
  }

  async function applyRemoteWipe(commands: PendingWipe[]) {
    // Capture token before local wipe clears `lh.*` so we can still ack.
    const token = getToken();
    await wipeLocalClientState();
    setProfile(null);
    setHasDeviceKey(false);
    setPendingWipes([]);
    setMsg("wiped");
    if (!token) return;
    const base = getApiBase();
    for (const cmd of commands) {
      try {
        await fetch(`${base}/v1/admin/wipe/${cmd.id}/ack`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        });
      } catch {
        /* ack best-effort after local wipe */
      }
    }
  }

  useEffect(() => {
    // Restore a minimal session shell from localStorage if /v1/me is slow/unavailable.
    if (getToken()) {
      const cachedUid = localStorage.getItem("lh.uid");
      if (cachedUid) {
        const nick = cachedSelfNickname();
        setProfile((prev) =>
          prev ?? {
            id: localStorage.getItem("lh.userId") ?? "",
            uid: cachedUid,
            nickname: nick,
            legalName: null,
            signature: null,
            privacy: DEFAULT_PRIVACY,
            churches: [],
          },
        );
        if (nick) setNickname(nick);
      }
    }
    void refresh().catch(() => undefined);
    void refreshDevices().catch(() => undefined);
    void checkPendingWipe();
  }, []);

  function apiLocale(): "zh-CN" | "en" | "ja" {
    return normalizeLocale(i18n.language || "zh-CN");
  }

  /** Prefer live DOM FormData so automation/autofill works even if React state lags. */
  function readAuthForm(): { handle: string; password: string; nickname: string } {
    const form = document.getElementById("lh-auth-form") as HTMLFormElement | null;
    const fd = form ? new FormData(form) : null;
    const h = String(fd?.get("handle") ?? handle).trim();
    const p = String(fd?.get("password") ?? password);
    const n = String(fd?.get("nickname") ?? nickname).trim();
    return { handle: h, password: p, nickname: n };
  }

  async function register() {
    setMsg(null);
    setAuthBusy(true);
    try {
      const fields = readAuthForm();
      setHandle(fields.handle);
      setPassword(fields.password);
      if (fields.nickname) setNickname(fields.nickname);
      if (!fields.handle || fields.password.length < 10) {
        setMsg("auth.invalidCredentials");
        return;
      }
      const nick = (fields.nickname || fields.handle).trim();
      const res = await api<{ token: string; deviceId: string; uid: string; userId: string }>(
        "/v1/auth/register",
        {
          method: "POST",
          body: JSON.stringify({
            handle: fields.handle,
            password: fields.password,
            nickname: nick,
            locale: apiLocale(),
            ...authDevicePayload(),
          }),
        },
      );
      setToken(res.token);
      localStorage.setItem("lh.deviceId", res.deviceId);
      localStorage.setItem("lh.uid", res.uid);
      localStorage.setItem("lh.userId", res.userId);
      persistSelfNickname(nick);
      // Full optimistic profile — partial objects crash render on profile.churches.map.
      setProfile({
        id: res.userId,
        uid: res.uid,
        nickname: nick,
        legalName: null,
        signature: null,
        privacy: DEFAULT_PRIVACY,
        churches: [],
      });
      setNickname(nick);
      setMsg("registered");
      try {
        await refresh();
      } catch (refreshErr) {
        setMsg(refreshErr instanceof Error ? refreshErr.message : "registered");
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "error");
    } finally {
      setAuthBusy(false);
    }
  }

  async function login() {
    setMsg(null);
    setAuthBusy(true);
    try {
      const fields = readAuthForm();
      setHandle(fields.handle);
      setPassword(fields.password);
      const res = await api<{
        token: string;
        deviceId: string;
        uid: string;
        userId: string;
      }>("/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({
          handleOrEmail: fields.handle,
          password: fields.password,
          ...authDevicePayload(),
        }),
      });
      setToken(res.token);
      localStorage.setItem("lh.deviceId", res.deviceId);
      localStorage.setItem("lh.uid", res.uid);
      localStorage.setItem("lh.userId", res.userId);
      // Optimistic profile so the login form hides even if /v1/me flakes (503).
      setProfile({
        id: res.userId,
        uid: res.uid,
        nickname: fields.handle,
        legalName: null,
        signature: null,
        privacy: DEFAULT_PRIVACY,
        churches: [],
      });
      setMsg("logged_in");
      try {
        await refresh();
      } catch (refreshErr) {
        setMsg(refreshErr instanceof Error ? refreshErr.message : "logged_in");
      }
      await checkPendingWipe();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "error");
    } finally {
      setAuthBusy(false);
    }
  }

  async function saveProfile() {
    if (!getToken()) {
      setMsg("login_required");
      return;
    }
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
          shareReadReceipts: privacy.shareReadReceipts,
          shareTypingIndicators: privacy.shareTypingIndicators,
          shareLastActive: privacy.shareLastActive,
          notifyMessages: privacy.notifyMessages,
          notifyCalls: privacy.notifyCalls,
        },
      }),
    });
    setMsg("saved");
    await refresh();
  }

  useEffect(() => {
    const section = searchParams.get("section");
    if (section === "personal" || section === "devices" || section === "system") {
      setMeSection(section);
    } else if (section === "account" || section === "profile" || section === "privacy") {
      setMeSection("personal");
    }
    if (searchParams.get("keys") === "1") {
      setMeSection("devices");
      setKeysPanelOpen(true);
      window.setTimeout(() => {
        keysPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    }
  }, [searchParams]);

  async function registerDeviceKeys() {
    if (!getToken()) {
      setMsg("login_required");
      return;
    }
    if (!window.confirm(t("security.uploadKeysConfirm"))) return;
    setKeyBusy(true);
    try {
      saveProductSignalPrefer(signalPrefer);
      await uploadDeviceKeyBundle();
      setHasDeviceKey(true);
      setMsg("keys_uploaded");
      if (searchParams.get("keys") === "1") {
        const next = new URLSearchParams(searchParams);
        next.delete("keys");
        next.set("section", "devices");
        setSearchParams(next, { replace: true });
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "keys_failed");
    } finally {
      setKeyBusy(false);
    }
  }

  async function selfWipe() {
    if (!getToken() || !profile?.id) {
      setMsg("login_required");
      return;
    }
    if (!window.confirm(t("security.wipeConfirm"))) return;
    const wipeRes = await api<{ id: string; wipeToken: string }>("/v1/admin/wipe", {
      method: "POST",
      body: JSON.stringify({ userId: profile.id, reasonCode: "self" }),
    });
    // Session is revoked server-side; ack with one-time wipeToken (no Bearer).
    try {
      await fetch(`/v1/admin/wipe/${wipeRes.id}/ack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wipeToken: wipeRes.wipeToken }),
      });
    } catch {
      /* best-effort ack */
    }
    await wipeLocalClientState();
    setToken(null);
    setProfile(null);
    setHasDeviceKey(false);
    setMsg("wiped");
  }

  function setLocale(lng: string) {
    localStorage.setItem("lh.locale", lng);
    void i18n.changeLanguage(lng);
  }

  function setTheme(theme: ThemeId) {
    localStorage.setItem("lh.theme", theme);
    applyTheme(theme);
    setThemeId(theme);
  }

  const themeLabel = (id: ThemeId) => {
    const key = `me.theme${id[0]!.toUpperCase()}${id.slice(1)}` as const;
    const mapped: Record<ThemeId, string> = {
      day: t("me.themeDay"),
      blush: t("me.themeBlush"),
      sepia: t("me.themeSepia"),
      night: t("me.themeNight"),
      highContrast: t("me.themeHighContrast"),
    };
    return mapped[id] ?? key;
  };

  function signOut() {
    setToken(null);
    localStorage.removeItem("lh.uid");
    localStorage.removeItem("lh.userId");
    clearSelfNickname();
    setProfile(null);
    setDevices([]);
    setCurrentDeviceId(null);
    setPassword("");
    setMsg(null);
    setMeSection("personal");
    window.location.assign("/app/login");
  }

  return (
    <section className="fade-up me-page app-folio" data-testid="me-page">
      <h1 className="page-title">{t("nav.me")}</h1>

      {pendingWipes.length > 0 && (
        <div className="panel" role="alert">
          <p>{t("security.wipePending")}</p>
        </div>
      )}

      <div className="folio-hero" data-testid="me-auth-status">
        <p className="folio-hero-name">{nickname || profile?.nickname || profile?.uid}</p>
        <p className="folio-hero-meta">
          {t("me.signedIn")} · UID <strong data-testid="me-uid">{profile?.uid}</strong>
          {msg ? ` · ${humanizeStatus(t, msg)}` : null}
        </p>
      </div>

      <div className="plans-tabs me-tabs" role="tablist" data-testid="me-section-tabs">
        {(
          [
            ["personal", "me.tabPersonal"],
            ["devices", "me.tabDevices"],
            ["system", "me.tabSystem"],
          ] as const
        ).map(([id, key]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={meSection === id}
            className={`plans-tab${meSection === id ? " is-active" : ""}`}
            data-testid={`me-tab-${id}`}
            onClick={() => {
              setMeSection(id);
              const next = new URLSearchParams(searchParams);
              next.set("section", id);
              if (id !== "devices") next.delete("keys");
              setSearchParams(next, { replace: true });
            }}
          >
            {t(key)}
          </button>
        ))}
      </div>

      {meSection === "personal" && (
        <div className="plans-tab-panel" data-testid="me-personal-panel">
          <div className="panel" data-testid="me-account-panel">
            <h2>{t("me.account")}</h2>
            <p className="muted" style={{ marginTop: 0 }}>
              {t("me.signedInAs", { uid: profile?.uid ?? "" })}
            </p>

            <div className="toolbar">
              <button type="button" className="btn ghost" data-testid="me-sign-out" onClick={signOut}>
                {t("me.signOut")}
              </button>
            </div>
            {(profile?.canAccessAdminConsole || isChurchAdmin) && (
              <div className="me-admin-entry" data-testid="me-admin-console-link">
                <h3 style={{ marginBottom: "0.35rem" }}>{t("admin.title")}</h3>
                <p className="muted" style={{ marginTop: 0 }}>
                  {t("admin.openHint")}
                </p>
                <Link className="btn" to="/app/admin" data-testid="me-open-admin">
                  {t("admin.open")}
                </Link>
                <p className="muted" style={{ marginTop: "0.65rem", fontSize: "0.85rem" }}>
                  {t("admin.desktopHint")}
                </p>
              </div>
            )}
          </div>

          <div className="panel" data-testid="me-profile-panel">
            <h2>{t("me.profile")}</h2>
            <div className="field">
              <label>{t("me.nickname")}</label>
              <input value={nickname} onChange={(e) => setNickname(e.target.value)} />
            </div>
            <div className="field">
              <label>{t("me.legalName")}</label>
              <input value={legalName} onChange={(e) => setLegalName(e.target.value)} />
            </div>
            <div className="field">
              <label>{t("me.signature")}</label>
              <textarea rows={3} value={signature} onChange={(e) => setSignature(e.target.value)} />
            </div>
            <button type="button" className="btn" onClick={() => void saveProfile()}>
              {t("me.save")}
            </button>
          </div>

          <div className="panel" data-testid="me-settings-panel">
            <h2>{t("me.privacy")}</h2>
            <label className="check-row">
              <input
                type="checkbox"
                checked={privacy.discoverableByHandle}
                onChange={(e) => setPrivacy((p) => ({ ...p, discoverableByHandle: e.target.checked }))}
              />
              {t("me.discoverableByHandle")}
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={privacy.discoverableByUid}
                onChange={(e) => setPrivacy((p) => ({ ...p, discoverableByUid: e.target.checked }))}
              />
              {t("me.discoverableByUid")}
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={privacy.showInChurchDirectory}
                onChange={(e) => setPrivacy((p) => ({ ...p, showInChurchDirectory: e.target.checked }))}
              />
              {t("me.showInChurchDirectory")}
            </label>
            <div className="field">
              <label>{t("me.allowMessageRequests")}</label>
              <div className="bible-more-actions" role="group">
                {(
                  [
                    ["everyone", "me.privacyEveryone"],
                    ["church-only", "me.privacyChurchOnly"],
                    ["admin-approved", "me.privacyAdminApproved"],
                    ["off", "me.privacyOff"],
                  ] as const
                ).map(([value, key]) => (
                  <button
                    key={value}
                    type="button"
                    className={`bible-text-btn${privacy.allowMessageRequests === value ? " is-on" : ""}`}
                    onClick={() =>
                      setPrivacy((p) => ({
                        ...p,
                        allowMessageRequests: value,
                      }))
                    }
                  >
                    {t(key)}
                  </button>
                ))}
              </div>
            </div>
            <button type="button" className="btn" onClick={() => void saveProfile()}>
              {t("me.save")}
            </button>
          </div>

        </div>
      )}

      {meSection === "system" && (
        <div className="plans-tab-panel" data-testid="me-system-panel">
          <div className="panel" data-testid="me-system-settings-panel">
            <h2>{t("me.settings")}</h2>
            <div className="field">
              <label>{t("me.language")}</label>
              <div className="bible-more-actions" role="group">
                {(
                  [
                    ["zh-CN", "中文"],
                    ["en", "English"],
                    ["ja", "日本語"],
                  ] as const
                ).map(([lng, label]) => (
                  <button
                    key={lng}
                    type="button"
                    className={`bible-text-btn${i18n.language === lng ? " is-on" : ""}`}
                    onClick={() => setLocale(lng)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label>{t("me.theme")}</label>
              <div className="bible-more-actions" role="group">
                {THEME_IDS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className={`bible-text-btn${themeId === id ? " is-on" : ""}`}
                    onClick={() => setTheme(id)}
                  >
                    {themeLabel(id)}
                  </button>
                ))}
              </div>
            </div>

            <h3 style={{ marginTop: "1.1rem" }}>{t("me.notifications")}</h3>
            <p className="muted" style={{ marginTop: 0 }}>
              {t("me.notifyHint")}
            </p>
            <label className="check-row">
              <input
                type="checkbox"
                checked={privacy.notifyMessages}
                onChange={(e) => {
                  const notifyMessages = e.target.checked;
                  setPrivacy((p) => ({ ...p, notifyMessages }));
                  saveNotifyPrefs({ notifyMessages });
                }}
              />
              {t("me.notifyMessages")}
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={privacy.notifyCalls}
                onChange={(e) => {
                  const notifyCalls = e.target.checked;
                  setPrivacy((p) => ({ ...p, notifyCalls }));
                  saveNotifyPrefs({ notifyCalls });
                }}
              />
              {t("me.notifyCalls")}
            </label>
            <button
              type="button"
              className="btn ghost"
              data-testid="me-enable-notifications"
              onClick={() => {
                void requestNotificationPermission().then((perm) => {
                  setMsg(
                    perm === "granted"
                      ? t("me.notifyEnabled")
                      : perm === "denied"
                        ? t("me.notifyDenied")
                        : t("me.notifyUnsupported"),
                  );
                });
              }}
            >
              {t("me.enableNotifications")}
            </button>
            <label className="check-row">
              <input
                type="checkbox"
                checked={privacy.shareReadReceipts}
                onChange={(e) => setPrivacy((p) => ({ ...p, shareReadReceipts: e.target.checked }))}
              />
              {t("me.shareReadReceipts")}
            </label>
            <button type="button" className="btn" onClick={() => void saveProfile()}>
              {t("me.save")}
            </button>

            <div className="me-version-block" data-testid="me-version-info">
              <h3>{t("me.versionInfo")}</h3>
              <dl className="me-version-dl">
                <div>
                  <dt>{t("me.versionName")}</dt>
                  <dd>
                    <span className="me-version-brand-zh">{t("app.name")}</span>
                    <span className="me-version-brand-en">LogosHome</span>
                  </dd>
                </div>
                <div>
                  <dt>{t("me.versionApp")}</dt>
                  <dd>@logoshome/web</dd>
                </div>
                <div>
                  <dt>{t("me.versionBuild")}</dt>
                  <dd data-testid="me-version-build">{APP_VERSION}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      )}

      {meSection === "devices" && (
        <div className="plans-tab-panel" data-testid="me-devices-section">
          <div className="panel" data-testid="me-devices-panel">
            <h2>{t("me.devices")}</h2>
            <p className="muted" style={{ marginTop: 0 }}>
              {t("me.devicesHint")}
            </p>
            <ul className="list me-device-list">
              {devices.length === 0 && <li className="muted">—</li>}
              {devices.map((d) => {
                const isThis = d.isCurrent || d.id === currentDeviceId;
                const title = friendlyDeviceTitle(d);
                return (
                  <li key={d.id} className={`me-device-row${isThis ? " is-current" : ""}`}>
                    <div className="me-device-main">
                      <strong>{title}</strong>
                      <div className="muted">
                        {platformLabel(d.platform)}
                        {isThis ? ` · ${t("me.deviceThisDevice")}` : ""}
                        {d.revoked ? ` · ${t("me.deviceRevoked")}` : ""}
                        {d.hasIdentityKey ? ` · ${t("me.deviceKeysFlag")}` : ""}
                      </div>
                      <div className="muted me-device-meta">
                        {t("me.deviceSignedIn", {
                          time: new Date(d.createdAt).toLocaleString(),
                        })}
                      </div>
                    </div>
                    {!d.revoked && !isThis && (
                      <button
                        type="button"
                        className="btn ghost"
                        disabled={authBusy}
                        onClick={() => void revokeDevice(d.id)}
                      >
                        {t("me.deviceRevoke")}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          <div
            className="panel me-keys-card"
            ref={keysPanelRef}
            data-testid="me-keys-panel"
          >
            <h2>{t("security.deviceKeys")}</h2>
            <p className="muted" style={{ marginTop: 0 }}>
              {t("security.deviceKeysHintShort")}
            </p>
            <p className="muted" data-testid="me-keys-status">
              {hasDeviceKey ? t("security.deviceKeysPresent") : t("security.deviceKeysMissing")}
            </p>
            <div className="field">
              <label htmlFor="signal-backend">{t("security.signalBackend")}</label>
              <select
                id="signal-backend"
                data-testid="me-signal-backend"
                value={signalPrefer}
                onChange={(e) => {
                  const next = e.target.value === "opene2ee" ? "opene2ee" : "x25519";
                  setSignalPrefer(next);
                  saveProductSignalPrefer(next);
                }}
              >
                <option value="x25519">{t("security.signalBackend.x25519")}</option>
                <option value="opene2ee">{t("security.signalBackend.opene2ee")}</option>
              </select>
              <p className="muted">{t("security.signalBackendHint")}</p>
            </div>
            <details
              className="plans-advanced"
              open={keysPanelOpen}
              onToggle={(e) => setKeysPanelOpen((e.target as HTMLDetailsElement).open)}
            >
              <summary>{t("security.openKeysPanel")}</summary>
              <p className="muted">{t("security.deviceKeysHint")}</p>
            </details>
            <div className="toolbar" style={{ marginTop: "0.65rem" }}>
              <button
                type="button"
                className="btn"
                disabled={keyBusy}
                data-testid="me-upload-keys"
                onClick={() => void registerDeviceKeys()}
              >
                {hasDeviceKey ? t("security.reuploadKeys") : t("security.uploadKeys")}
              </button>
            </div>
          </div>

          <div className="panel" data-testid="me-wipe-panel">
            <details className="plans-advanced">
              <summary>{t("security.wipe")}</summary>
              <p className="muted">{t("security.wipeHint")}</p>
              <button type="button" className="btn danger" onClick={() => void selfWipe()}>
                {t("security.wipe")}
              </button>
            </details>
          </div>
        </div>
      )}
    </section>
  );
}
