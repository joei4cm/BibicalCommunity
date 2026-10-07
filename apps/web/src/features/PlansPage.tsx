import { useState } from "react";
import { useTranslation } from "react-i18next";
import { parsePlanCsv } from "@logoshome/bible";
import { api, getToken } from "../lib/api";
import {
  DEVOTION_STEPS,
  devotionProgress,
  nextStep,
  type DevotionStep,
} from "./devotion";

export function PlansPage() {
  const { t } = useTranslation();
  const [csv, setCsv] = useState("day,ref,title,note\n1,John.1,Word,Begin\n2,John.2,Wedding,");
  const [message, setMessage] = useState<string | null>(null);
  const [step, setStep] = useState<DevotionStep>("pause");
  const progress = devotionProgress(step);

  async function importCsv() {
    if (!getToken()) {
      setMessage("login_required");
      return;
    }
    const days = parsePlanCsv(csv);
    const res = await api<{ id: string }>("/v1/plans", {
      method: "POST",
      body: JSON.stringify({
        title: "CSV Plan",
        visibility: "private",
        days,
      }),
    });
    setMessage(`created:${res.id} (${days.length} days)`);
  }

  function advance() {
    const next = nextStep(step);
    if (next) setStep(next);
  }

  function resetSteps() {
    setStep("pause");
  }

  return (
    <section className="fade-up">
      <h1 className="brand">{t("nav.plans")}</h1>
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>{t("plans.importCsv")}</h2>
        <div className="field">
          <textarea rows={6} value={csv} onChange={(e) => setCsv(e.target.value)} />
        </div>
        <button type="button" className="btn" onClick={() => void importCsv()}>
          {t("plans.importCsv")}
        </button>
        {message && <p className="muted">{message}</p>}
      </div>
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>Devotion</h2>
        <p className="muted">
          {progress.index + 1} / {progress.total}
          {progress.done ? " · done" : ""}
        </p>
        <div className="step-track" role="list">
          {DEVOTION_STEPS.map((s, i) => {
            const state = i < progress.index ? "done" : i === progress.index ? "current" : "todo";
            return (
              <button
                key={s}
                type="button"
                role="listitem"
                className={`step-chip step-${state}`}
                onClick={() => setStep(s)}
              >
                <span className="step-index">{i + 1}</span>
                {t(`devotion.${s}`)}
              </button>
            );
          })}
        </div>
        <div className="toolbar">
          <button type="button" className="btn" onClick={advance} disabled={progress.done}>
            {progress.done ? "✓" : "→"}
          </button>
          <button type="button" className="btn ghost" onClick={resetSteps}>
            Reset
          </button>
        </div>
      </div>
    </section>
  );
}
