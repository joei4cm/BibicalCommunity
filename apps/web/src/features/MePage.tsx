import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { THEME_IDS, type PrivacySettings, type ThemeId } from "@logoshome/shared";
import { applyTheme } from "@logoshome/ui";
import { api, getToken, setToken } from "../lib/api";

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
  privacy: PrivacySettings;
  churches: MeChurch[];
};

type SearchHit = { id: string; uid: string; nickname: string | null };

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

  async function refresh() {
    if (!getToken()) return;
    const me = await api<MeProfile>("/v1/me");
    setProfile(me);
    if (me.nickname) setNickname(me.nickname);
    if (me.legalName) setLegalName(me.legalName);
    if (me.signature) setSignature(me.signature);
    if (me.privacy) setPrivacy({ ...DEFAULT_PRIVACY, ...me.privacy });
  }

  useEffect(() => {
    void refresh().catch(() => undefined);
  }, []);

  async function register() {
    const res = await api<{ token: string }>("/v1/auth/register", {
      method: "POST",
      body: JSON.stringify({
        handle,
        password,
        nickname: nickname || handle,
        locale: i18n.language,
      }),
    });
    setToken(res.token);
    setMsg("registered");
    await refresh();
  }

  async function login() {
    const res = await api<{ token: string }>("/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ handleOrEmail: handle, password, platform: "web" }),
    });
    setToken(res.token);
    setMsg("logged_in");
    await refresh();
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

  async function selfWipe() {
    if (!getToken() || !profile?.id) {
      setMsg("login_required");
      return;
    }
    if (!window.confirm(t("security.wipeConfirm"))) return;
    await api("/v1/admin/wipe", {
      method: "POST",
      body: JSON.stringify({ userId: profile.id, reasonCode: "self" }),
    });
    setToken(null);
    setProfile(null);
    setMsg("wiped");
  }

  function setLocale(lng: string) {
    localStorage.setItem("lh.locale", lng);
    void i18n.changeLanguage(lng);
  }

  function setTheme(theme: ThemeId) {
    localStorage.setItem("lh.theme", theme);
    applyTheme(theme);
  }

  return (
    <section className="fade-up">
      <h1 className="brand">{t("nav.me")}</h1>
      <div className="panel">
        <div className="field">
          <label>Handle / UID login</label>
          <input value={handle} onChange={(e) => setHandle(e.target.value)} />
        </div>
        <div className="field">
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div className="toolbar">
          <button type="button" className="btn" onClick={() => void register()}>
            {t("auth.register")}
          </button>
          <button type="button" className="btn ghost" onClick={() => void login()}>
            {t("auth.login")}
          </button>
        </div>
        {profile?.uid && (
          <p>
            UID: <strong>{profile.uid}</strong>
          </p>
        )}
        {msg && <p className="muted">{msg}</p>}
      </div>

      <div className="panel">
        <h2 style={{ marginTop: 0 }}>{t("me.profile")}</h2>
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

      <div className="panel">
        <h2 style={{ marginTop: 0 }}>{t("me.privacy")}</h2>
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
          <select
            value={privacy.allowMessageRequests}
            onChange={(e) =>
              setPrivacy((p) => ({
                ...p,
                allowMessageRequests: e.target.value as PrivacySettings["allowMessageRequests"],
              }))
            }
          >
            <option value="everyone">everyone</option>
            <option value="church-only">church-only</option>
            <option value="admin-approved">admin-approved</option>
            <option value="off">off</option>
          </select>
        </div>
        <button type="button" className="btn" onClick={() => void saveProfile()}>
          {t("me.save")}
        </button>

        <div className="field" style={{ marginTop: "1rem" }}>
          <label>Language</label>
          <select value={i18n.language} onChange={(e) => setLocale(e.target.value)}>
            <option value="zh-CN">中文</option>
            <option value="en">English</option>
            <option value="ja">日本語</option>
          </select>
        </div>
        <div className="field">
          <label>Theme</label>
          <select
            defaultValue={(localStorage.getItem("lh.theme") as ThemeId) ?? "day"}
            onChange={(e) => setTheme(e.target.value as ThemeId)}
          >
            {THEME_IDS.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="panel">
        <h2 style={{ marginTop: 0 }}>{t("me.churches")}</h2>
        <ul className="list">
          {!profile?.churches?.length && <li className="muted">—</li>}
          {profile?.churches.map((c) => (
            <li key={c.churchId}>
              <strong>{c.churchId}</strong>
              <div className="muted">
                {c.role}
                {c.verified ? (
                  <span className="badge-verified"> · {t("me.verified")}</span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="panel">
        <h2 style={{ marginTop: 0 }}>{t("me.search")}</h2>
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

      <div className="panel">
        <h2 style={{ marginTop: 0 }}>{t("security.wipe")}</h2>
        <p className="muted">{t("security.wipeHint")}</p>
        <button type="button" className="btn danger" onClick={() => void selfWipe()}>
          {t("security.wipe")}
        </button>
      </div>
    </section>
  );
}
