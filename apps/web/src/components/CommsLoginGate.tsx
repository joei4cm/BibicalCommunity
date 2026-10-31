import { useTranslation } from "react-i18next";
import { getToken } from "../lib/api";

export const AUTH_NOTE_CODES = new Set(["login_required", "unauthorized", "401"]);

/** True when there is no session, or API/auth notes mean the user must sign in again. */
export function isAuthBlocked(note?: string | null): boolean {
  if (!getToken()) return true;
  return note != null && AUTH_NOTE_CODES.has(note);
}

/** Shared in-panel login gate when session is missing or rejected (AuthGate may still have passed with a stale token). */
export function CommsLoginGate({
  titleKey,
  testIdPrefix,
}: {
  titleKey: string;
  testIdPrefix: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="comms-stage" data-testid={`${testIdPrefix}-login-gate`}>
      <div className="comms-gate">
        <p className="comms-gate-title">{t(titleKey)}</p>
        <a className="btn" href="/app/login" data-testid={`${testIdPrefix}-login-cta`}>
          {t("comms.loginGateCta")}
        </a>
      </div>
    </div>
  );
}
