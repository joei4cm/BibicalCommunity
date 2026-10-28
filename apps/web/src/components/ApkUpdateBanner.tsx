import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  checkApkUpdateFromGithub,
  dismissApkUpdate,
  isApkUpdateDismissed,
  isCapacitorAndroid,
  markApkUpdateChecked,
  openApkDownload,
  shouldAutoCheckApkUpdate,
  type ApkUpdateInfo,
} from "../lib/github-release-update";

type Props = {
  /** When true, skip the 12h throttle (e.g. Me page “检查更新”). */
  force?: boolean;
  /** Compact inline block for Me settings instead of top banner. */
  variant?: "banner" | "panel";
  onIdle?: () => void;
};

export function ApkUpdateBanner({ force = false, variant = "banner", onIdle }: Props) {
  const { t } = useTranslation();
  const [info, setInfo] = useState<ApkUpdateInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const runCheck = useCallback(
    async (forced: boolean) => {
      if (!isCapacitorAndroid() && !forced) {
        onIdle?.();
        return;
      }
      // Manual check from Me also works on Android only (APK asset).
      if (!isCapacitorAndroid()) {
        setNote("apk_update_android_only");
        onIdle?.();
        return;
      }
      if (!forced && !shouldAutoCheckApkUpdate()) {
        onIdle?.();
        return;
      }
      setBusy(true);
      setNote(null);
      try {
        const next = await checkApkUpdateFromGithub();
        markApkUpdateChecked();
        if (!next) {
          setInfo(null);
          setNote(forced ? "apk_update_latest" : null);
          onIdle?.();
          return;
        }
        if (!forced && isApkUpdateDismissed(next.tag)) {
          setInfo(null);
          onIdle?.();
          return;
        }
        setInfo(next);
      } catch {
        setNote(forced ? "apk_update_failed" : null);
        onIdle?.();
      } finally {
        setBusy(false);
      }
    },
    [onIdle],
  );

  useEffect(() => {
    if (variant === "banner") void runCheck(false);
  }, [runCheck, variant]);

  if (variant === "panel") {
    return (
      <div className="me-apk-update" data-testid="me-apk-update">
        <h3>{t("me.apkUpdate")}</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          {t("me.apkUpdateHint")}
        </p>
        <button
          type="button"
          className="btn"
          disabled={busy}
          data-testid="me-apk-check"
          onClick={() => void runCheck(true)}
        >
          {busy ? t("common.loading") : t("me.apkCheckUpdate")}
        </button>
        {note === "apk_update_latest" && (
          <p className="muted" data-testid="me-apk-latest">
            {t("me.apkUpToDate")}
          </p>
        )}
        {note === "apk_update_failed" && (
          <p className="muted" data-testid="me-apk-failed">
            {t("me.apkUpdateFailed")}
          </p>
        )}
        {note === "apk_update_android_only" && (
          <p className="muted">{t("me.apkAndroidOnly")}</p>
        )}
        {info && (
          <div className="me-apk-update-card" data-testid="me-apk-available">
            <p>
              {t("me.apkUpdateAvailable", {
                latest: info.version,
                current: info.currentVersion,
              })}
            </p>
            <div className="toolbar">
              <button type="button" className="btn" onClick={() => openApkDownload(info)}>
                {t("me.apkDownload")}
              </button>
              <a className="btn ghost" href={info.releaseUrl} target="_blank" rel="noreferrer">
                {t("me.apkReleaseNotes")}
              </a>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!info) return null;

  return (
    <div className="apk-update-banner" data-testid="apk-update-banner" role="status">
      <p>
        {t("me.apkUpdateAvailable", {
          latest: info.version,
          current: info.currentVersion,
        })}
      </p>
      <div className="apk-update-banner-actions">
        <button type="button" className="btn" onClick={() => openApkDownload(info)}>
          {t("me.apkDownload")}
        </button>
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            dismissApkUpdate(info.tag);
            setInfo(null);
          }}
        >
          {t("me.apkDismiss")}
        </button>
      </div>
    </div>
  );
}
