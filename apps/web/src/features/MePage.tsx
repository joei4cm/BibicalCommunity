import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { THEME_IDS, type ThemeId } from "@logoshome/shared";
import { applyTheme } from "@logoshome/ui";
import { api, getToken, setToken } from "../lib/api";

export function MePage() {
  const { t, i18n } = useTranslation();
  const [handle, setHandle] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [profile, setProfile] = useState<{ uid?: string; signature?: string | null } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function refresh() {
    if (!getToken()) return;
    const me = await api<{ uid: string; signature: string | null; nickname: string | null }>("/v1/me");
    setProfile(me);
    if (me.nickname) setNickname(me.nickname);
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
        <div className="field">
          <label>Nickname</label>
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} />
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
        <h2 style={{ marginTop: 0 }}>{t("me.privacy")}</h2>
        <div className="field">
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
    </section>
  );
}
