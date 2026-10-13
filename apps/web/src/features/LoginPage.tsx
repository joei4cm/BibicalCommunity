import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { normalizeLocale } from "@logoshome/shared";
import {
  DEFAULT_PROD_API_BASE,
  api,
  getApiBase,
  getToken,
  isPackagedShell,
  setApiBase,
  setToken,
} from "../lib/api";
import { buildDeviceName, detectDevicePlatform } from "../lib/device-label";
import { humanizeStatus } from "../lib/status";
import { BrandMark } from "../components/BrandMark";

function authDevicePayload() {
  const detected = detectDevicePlatform();
  const platform = detected === "ios" || detected === "android" ? detected : "web";
  return { platform, deviceName: buildDeviceName(detected) };
}

type Mode = "login" | "register";

const DEFAULT_APP_PATH = "/app/bible/cuvs/john/1";

/** Return path after login — only allow in-app routes (keeps ?verse= deep links). */
function safeReturnPath(from: unknown): string {
  if (typeof from !== "string" || !from.startsWith("/app/")) return DEFAULT_APP_PATH;
  if (from.startsWith("/app/login")) return DEFAULT_APP_PATH;
  return from;
}

/**
 * Dedicated web auth screen. App shell routes redirect here when there is no session.
 * Registration stays available while the product allows open signup.
 */
export function LoginPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = safeReturnPath((location.state as { from?: string } | null)?.from);
  const [mode, setMode] = useState<Mode>("login");
  const [handle, setHandle] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [serverUrl, setServerUrl] = useState(() => getApiBase() || DEFAULT_PROD_API_BASE);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const showServerField = isPackagedShell();

  if (getToken()) {
    return <Navigate to={returnTo} replace />;
  }

  function readForm(): { handle: string; password: string; nickname: string } {
    const form = document.getElementById("lh-login-form") as HTMLFormElement | null;
    const fd = form ? new FormData(form) : null;
    return {
      handle: String(fd?.get("handle") ?? handle).trim(),
      password: String(fd?.get("password") ?? password),
      nickname: String(fd?.get("nickname") ?? nickname).trim(),
    };
  }

  function persistSession(
    res: { token: string; deviceId: string; uid: string; userId: string },
    nickname?: string | null,
  ) {
    setToken(res.token);
    localStorage.setItem("lh.deviceId", res.deviceId);
    localStorage.setItem("lh.uid", res.uid);
    localStorage.setItem("lh.userId", res.userId);
    if (nickname) {
      try {
        localStorage.setItem("lh.nickname", nickname);
      } catch {
        /* ignore */
      }
    }
  }

  function applyServerUrl() {
    const next = serverUrl.trim() || DEFAULT_PROD_API_BASE;
    setApiBase(next);
    setServerUrl(next.replace(/\/$/, ""));
  }

  async function onLogin() {
    setMsg(null);
    setBusy(true);
    try {
      if (showServerField) applyServerUrl();
      const fields = readForm();
      if (!fields.handle || !fields.password) {
        setMsg("auth.invalidCredentials");
        return;
      }
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
      persistSession(res);
      // Warm nickname cache so Me/home do not flash UID while /v1/me loads.
      void api<{ nickname?: string | null }>("/v1/me")
        .then((me) => {
          if (me.nickname) {
            try {
              localStorage.setItem("lh.nickname", me.nickname);
            } catch {
              /* ignore */
            }
          }
        })
        .catch(() => undefined);
      navigate(returnTo, { replace: true });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }

  async function onRegister() {
    setMsg(null);
    setBusy(true);
    try {
      if (showServerField) applyServerUrl();
      const fields = readForm();
      if (!fields.handle || fields.password.length < 10) {
        setMsg("auth.invalidCredentials");
        return;
      }
      const nick = (fields.nickname || fields.handle).trim();
      const res = await api<{
        token: string;
        deviceId: string;
        uid: string;
        userId: string;
      }>("/v1/auth/register", {
        method: "POST",
        body: JSON.stringify({
          handle: fields.handle,
          password: fields.password,
          nickname: nick,
          locale: normalizeLocale(i18n.language || "zh-CN"),
          ...authDevicePayload(),
        }),
      });
      persistSession(res, nick);
      navigate(returnTo, { replace: true });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="fade-up login-page" data-testid="login-page">
      <div className="login-atmosphere" aria-hidden="true" />
      <div className="login-card" data-testid="login-card">
        <p className="login-brand">
          <BrandMark className="login-brand-mark" />
          <span>{t("app.name")}</span>
        </p>
        <h1 className="login-title">
          {mode === "login" ? t("auth.login") : t("auth.register")}
        </h1>
        <p className="login-support">
          {mode === "login" ? t("auth.loginHint") : t("auth.registerHint")}
        </p>
        {msg ? (
          <p className="auth-status" role="status" data-testid="login-status">
            {humanizeStatus(t, msg)}
          </p>
        ) : null}
        <form
          id="lh-login-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (mode === "login") void onLogin();
            else void onRegister();
          }}
        >
          {showServerField && (
            <div className="field">
              <label htmlFor="lh-login-server">{t("me.serverUrl")}</label>
              <input
                id="lh-login-server"
                name="serverUrl"
                inputMode="url"
                autoComplete="url"
                data-testid="login-server-url"
                placeholder={DEFAULT_PROD_API_BASE}
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
              />
              <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.85em" }}>
                {t("me.serverUrlHint")}
              </p>
            </div>
          )}
          <div className="field">
            <label htmlFor="lh-login-handle">{t("auth.handle")}</label>
            <input
              id="lh-login-handle"
              name="handle"
              autoComplete="username"
              data-testid="login-handle"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="lh-login-password">{t("auth.password")}</label>
            <input
              id="lh-login-password"
              name="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              data-testid="login-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {mode === "register" && (
            <div className="field">
              <label htmlFor="lh-login-nickname">{t("me.nickname")}</label>
              <input
                id="lh-login-nickname"
                name="nickname"
                autoComplete="nickname"
                data-testid="login-nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />
            </div>
          )}
          <div className="toolbar">
            <button type="submit" className="btn" data-testid="login-submit" disabled={busy}>
              {busy ? t("me.working") : mode === "login" ? t("auth.login") : t("auth.register")}
            </button>
            <button
              type="button"
              className="btn ghost"
              data-testid="login-switch-mode"
              disabled={busy}
              onClick={() => {
                setMode((m) => (m === "login" ? "register" : "login"));
                setMsg(null);
              }}
            >
              {mode === "login" ? t("auth.goRegister") : t("auth.goLogin")}
            </button>
          </div>
        </form>
        <p className="muted" style={{ marginBottom: 0 }}>
          <Link to="/">{t("auth.backLanding")}</Link>
        </p>
      </div>
    </section>
  );
}
