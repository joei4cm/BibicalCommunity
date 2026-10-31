import { useTranslation } from "react-i18next";

/** Inline load failure: honest error + retry, not a fake empty list. */
export function CommsLoadError({
  onRetry,
  testId = "comms-load-error",
  busy = false,
}: {
  onRetry: () => void;
  testId?: string;
  busy?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="comms-empty comms-load-error" data-testid={testId}>
      <strong>{t("comms.networkError")}</strong>
      <p className="muted">{t("comms.loadErrorHint")}</p>
      <button
        type="button"
        className="btn"
        disabled={busy}
        data-testid={`${testId}-retry`}
        onClick={onRetry}
      >
        {t("comms.retry")}
      </button>
    </div>
  );
}
