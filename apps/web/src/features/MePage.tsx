import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  THEME_IDS,
  normalizeLocale,
  type PrivacySettings,
  type ThemeId,
} from "@logoshome/shared";
import { applyTheme } from "@logoshome/ui";
import { api, getToken, setToken } from "../lib/api";
import { wipeLocalClientState } from "../lib/local-wipe";
import {
  hasProductIdentity,
  mintProductIdentityForUpload,
  PRODUCT_PRIV_KEY,
} from "../lib/product-signal-chat";
import {
  loadProductSignalPrefer,
  saveProductSignalPrefer,
  type ProductSignalPrefer,
} from "../lib/product-signal-prefer";
import { secureGet, secureSet } from "../lib/secure-kv";
import { humanizeStatus } from "../lib/status";

type MeSection = "account" | "profile" | "privacy" | "devices";

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

type SearchHit = { id: string; uid: string; nickname: string | null };

type PendingWipe = {
  id: string;
  deviceId: string | null;
  reasonCode: string;
  expiresAt: number;
};

/** Legacy P-256 X3DH private blob (kept for wipe/detect of older installs). */
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

export function MePage() {
  const { t, i18n } = useTranslation();
  const [meSection, setMeSection] = useState<MeSection>("account");
  const [handle, setHandle] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [signature, setSignature] = useState("");
  const [legalName, setLegalName] = useState("");
  const [privacy, setPrivacy] = useState<PrivacySettings>(DEFAULT_PRIVACY);
  const [profile, setProfile] = useState<MeProfile | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<SearchHit[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [pendingWipes, setPendingWipes] = useState<PendingWipe[]>([]);
  const [keyBusy, setKeyBusy] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [wipeUserId, setWipeUserId] = useState("");
  const [wipeDeviceId, setWipeDeviceId] = useState("");
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
    void Promise.all([secureGet(DEVICE_PRIV_KEY), hasProductIdentity()]).then(
      ([legacy, product]) => setHasDeviceKey(Boolean(legacy) || product),
    );
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

  const isChurchAdmin = profile?.churches?.some(
    (c) => c.role === "admin" || c.role === "security_officer",
  );

  async function refresh() {
    if (!getToken()) return;
    const me = await api<MeProfile>("/v1/me");
    setProfile(me);
    if (me.nickname) setNickname(me.nickname);
    if (me.legalName) setLegalName(me.legalName);
    if (me.signature) setSignature(me.signature);
    if (me.privacy) setPrivacy({ ...DEFAULT_PRIVACY, ...me.privacy });
  }

  async function checkPendingWipe() {
    if (!getToken()) return;
    try {
      const res = await api<{ commands: PendingWipe[] }>("/v1/admin/wipe/pending");
      setPendingWipes(res.commands);
      if (res.commands.length > 0) {
        await applyRemoteWipe(res.commands);
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
    const base = import.meta.env.VITE_API_BASE ?? "";
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
          }),
        },
      );
      setToken(res.token);
      localStorage.setItem("lh.deviceId", res.deviceId);
      localStorage.setItem("lh.uid", res.uid);
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
      const res = await api<{ token: string; deviceId: string }>("/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({
          handleOrEmail: fields.handle,
          password: fields.password,
          platform: "web",
        }),
      });
      setToken(res.token);
      localStorage.setItem("lh.deviceId", res.deviceId);
      setMsg("logged_in");
      await refresh();
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
        },
      }),
    });
    setMsg("saved");
    await refresh();
  }

  async function searchUsers() {
    if (!getToken()) {
      setMsg("login_required");
      return;
    }
    const q = searchQ.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }
    const res = await api<{ results: SearchHit[] }>(
      `/v1/me/search?q=${encodeURIComponent(q)}`,
    );
    setSearchResults(res.results);
  }

  async function registerDeviceKeys() {
    if (!getToken()) {
      setMsg("login_required");
      return;
    }
    setKeyBusy(true);
    try {
      // Product path: createProductSignalClient (default x25519; opt-in OpenE2EE).
      saveProductSignalPrefer(signalPrefer);
      const bundle = await mintProductIdentityForUpload();

      await api("/v1/keys/bundle", {
        method: "PUT",
        body: JSON.stringify({
          identityKeyPub: bundle.identityKeyPub,
          signedPrekeyPub: bundle.signedPrekeyPub,
          signedPrekeySig: bundle.signedPrekeySig,
          signedPrekeyId: bundle.signedPrekeyId,
          registrationId: bundle.registrationId,
        }),
      });

      const prekeys: { id: number; pub: string }[] = [];
      if (bundle.oneTimePrekeyPub != null && bundle.oneTimePrekeyId != null) {
        prekeys.push({ id: bundle.oneTimePrekeyId, pub: bundle.oneTimePrekeyPub });
      }
      // Courier-store Kyber last-resort pub as an OPK slot when OpenE2EE is selected.
      if (bundle.kyberPrekeyPub != null && bundle.kyberPrekeyId != null) {
        prekeys.push({ id: bundle.kyberPrekeyId, pub: bundle.kyberPrekeyPub });
      }
      if (prekeys.length) {
        await api("/v1/keys/prekeys", {
          method: "PUT",
          body: JSON.stringify({ prekeys }),
        });
      }

      // Mark legacy slot so older wipe/detect paths still see a device key present.
      await secureSet(DEVICE_PRIV_KEY, `product:${PRODUCT_PRIV_KEY}`);

      setHasDeviceKey(true);
      setMsg("keys_uploaded");
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

  async function adminWipe() {
    if (!getToken() || !wipeUserId.trim()) {
      setMsg("login_required");
      return;
    }
    if (!window.confirm(t("security.adminWipeConfirm"))) return;
    const payload: Record<string, string> = {
      userId: wipeUserId.trim(),
      reasonCode: "admin",
    };
    if (wipeDeviceId.trim()) payload.deviceId = wipeDeviceId.trim();
    await api("/v1/admin/wipe", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setWipeUserId("");
    setWipeDeviceId("");
    setMsg("admin_wipe_issued");
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
      sepia: t("me.themeSepia"),
      night: t("me.themeNight"),
      highContrast: t("me.themeHighContrast"),
    };
    return mapped[id] ?? key;
  };

  const signedIn = Boolean(profile?.uid);

  return (
    <section className="fade-up me-page app-folio" data-testid="me-page">
      <h1 className="page-title">{t("nav.me")}</h1>

      {pendingWipes.length > 0 && (
        <div className="panel" role="alert">
          <p>{t("security.wipePending")}</p>
        </div>
      )}

      {signedIn ? (
        <div className="folio-hero" data-testid="me-auth-status">
          <p className="folio-hero-name">{nickname || profile?.nickname || profile?.uid}</p>
          <p className="folio-hero-meta">
            {t("me.signedIn")} · UID <strong data-testid="me-uid">{profile?.uid}</strong>
            {msg ? ` · ${humanizeStatus(t, msg)}` : null}
          </p>
        </div>
      ) : (
        <div className="panel folio-gate" data-testid="me-welcome-gate">
          <p className="muted" style={{ marginTop: 0 }}>
            {t("me.gateWelcome")}
          </p>
          {msg ? (
            <p className="auth-status" role="status" data-testid="me-auth-status">
              {humanizeStatus(t, msg)}
            </p>
          ) : null}
        </div>
      )}

      {signedIn && (
        <div className="plans-tabs" role="tablist" data-testid="me-section-tabs">
          {(
            [
              ["account", "me.tabAccount"],
              ["profile", "me.tabProfile"],
              ["privacy", "me.tabPrivacy"],
              ["devices", "me.tabDevices"],
            ] as const
          ).map(([id, key]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={meSection === id}
              className={`plans-tab${meSection === id ? " is-active" : ""}`}
              data-testid={`me-tab-${id}`}
              onClick={() => setMeSection(id)}
            >
              {t(key)}
            </button>
          ))}
        </div>
      )}

      {(!signedIn || meSection === "account") && (
      <div className="panel" data-testid="me-auth-panel">
        <h2>{t("me.account")}</h2>
        {signedIn ? <p className="muted">{t("me.signOutHint")}</p> : null}
        <form
          id="lh-auth-form"
          onSubmit={(e) => {
            e.preventDefault();
            void login();
          }}
        >
          <div className="field">
            <label htmlFor="lh-handle">{t("auth.handle")}</label>
            <input
              id="lh-handle"
              name="handle"
              autoComplete="username"
              data-testid="me-handle"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              onInput={(e) => setHandle((e.target as HTMLInputElement).value)}
            />
          </div>
          <div className="field">
            <label htmlFor="lh-password">{t("auth.password")}</label>
            <input
              id="lh-password"
              name="password"
              type="password"
              autoComplete="current-password"
              data-testid="me-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
            />
          </div>
          <div className="field">
            <label htmlFor="lh-nickname-auth">{t("me.nickname")}</label>
            <input
              id="lh-nickname-auth"
              name="nickname"
              autoComplete="nickname"
              data-testid="me-nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onInput={(e) => setNickname((e.target as HTMLInputElement).value)}
            />
          </div>
          <div className="toolbar">
            <button
              type="button"
              className="btn"
              data-testid="me-register"
              disabled={authBusy}
              onClick={() => void register()}
            >
              {authBusy ? t("me.working") : t("auth.register")}
            </button>
            <button type="submit" className="btn ghost" data-testid="me-login" disabled={authBusy}>
              {authBusy ? t("me.working") : t("auth.login")}
            </button>
          </div>
        </form>
      </div>
      )}

      {signedIn && meSection === "profile" && (
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
      )}

      {signedIn && meSection === "privacy" && (
      <div className="panel" data-testid="me-settings-panel">
        <h2>{t("me.settings")}</h2>
        <h3>{t("me.privacy")}</h3>
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

        <div className="field" style={{ marginTop: "1rem" }}>
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
              <dd data-testid="me-version-build">0.1.0</dd>
            </div>
          </dl>
        </div>
      </div>
      )}

      {signedIn && meSection === "profile" && (
      <div className="panel" data-testid="me-churches-panel">
        <h2>{t("me.churches")}</h2>
        <ul className="list">
          {!profile?.churches?.length && <li className="muted">—</li>}
          {(profile?.churches ?? []).map((c) => (
            <li key={c.churchId}>
              <strong>{c.name ?? c.churchId}</strong>
              <div className="muted">
                {c.role}
                {c.slug ? ` · ${c.slug}` : ""}
                {c.verified ? (
                  <span className="badge-verified"> · {t("me.verified")}</span>
                ) : (
                  <span> · {t("me.pendingVerify")}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
        <h3>{t("me.search")}</h3>
        <div className="field">
          <label>{t("me.searchUid")}</label>
          <input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="UID"
          />
        </div>
        <button type="button" className="btn" onClick={() => void searchUsers()}>
          {t("me.search")}
        </button>
        <ul className="list" style={{ marginTop: "0.75rem" }}>
          {searchResults.map((r) => (
            <li key={r.id}>
              <strong>{r.uid}</strong>
              {r.nickname ? <div className="muted">{r.nickname}</div> : null}
            </li>
          ))}
        </ul>
      </div>
      )}

      {signedIn && meSection === "devices" && (
      <div className="panel" data-testid="me-devices-panel">
        <details className="plans-advanced" open>
          <summary>{t("me.devices")}</summary>
          <p className="muted">{t("me.devicesHint")}</p>
          <ul className="list">
            {devices.length === 0 && <li className="muted">—</li>}
            {devices.map((d) => (
              <li key={d.id}>
                <strong>{d.name || d.platform}</strong>
                <div className="muted">
                  {d.id}
                  {d.isCurrent || d.id === currentDeviceId ? ` · ${t("me.deviceCurrent")}` : ""}
                  {d.revoked ? ` · ${t("me.deviceRevoked")}` : ""}
                  {d.hasIdentityKey ? ` · ${t("me.deviceKeysFlag")}` : ""}
                </div>
                {!d.revoked && !d.isCurrent && (
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
            ))}
          </ul>
        </details>

        <details className="plans-advanced" style={{ marginTop: "0.85rem" }}>
          <summary>{t("security.deviceKeys")}</summary>
          <p className="muted">{t("security.deviceKeysHint")}</p>
          <p className="muted">
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
          <button
            type="button"
            className="btn"
            disabled={keyBusy}
            data-testid="me-upload-keys"
            onClick={() => void registerDeviceKeys()}
          >
            {t("security.uploadKeys")}
          </button>
        </details>

        <details className="plans-advanced" style={{ marginTop: "0.85rem" }}>
          <summary>{t("security.wipe")}</summary>
          <p className="muted">{t("security.wipeHint")}</p>
          <button type="button" className="btn danger" onClick={() => void selfWipe()}>
            {t("security.wipe")}
          </button>
        </details>

        {(profile?.canAccessAdminConsole || isChurchAdmin) && (
          <details className="plans-advanced" style={{ marginTop: "0.85rem" }} data-testid="me-admin-console-link">
            <summary>{t("admin.title")}</summary>
            <p className="muted">{t("admin.openHint")}</p>
            <Link className="btn" to="/app/admin" data-testid="me-open-admin">
              {t("admin.open")}
            </Link>
          </details>
        )}

        {isChurchAdmin && (
          <details className="plans-advanced" style={{ marginTop: "0.85rem" }}>
            <summary>{t("security.adminWipe")}</summary>
            <p className="muted">{t("security.adminWipeHint")}</p>
            <div className="field">
              <label>{t("security.adminWipeUserId")}</label>
              <input
                value={wipeUserId}
                onChange={(e) => setWipeUserId(e.target.value)}
                placeholder="usr_…"
              />
            </div>
            <div className="field">
              <label>{t("security.adminWipeDeviceId")}</label>
              <input
                value={wipeDeviceId}
                onChange={(e) => setWipeDeviceId(e.target.value)}
                placeholder="dev_… (optional)"
              />
            </div>
            <button type="button" className="btn danger" onClick={() => void adminWipe()}>
              {t("security.adminWipe")}
            </button>
          </details>
        )}
      </div>
      )}
    </section>
  );
}
