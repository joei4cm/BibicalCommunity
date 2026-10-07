import { useState } from "react";
import { useTranslation } from "react-i18next";
import { parsePlanCsv } from "@logoshome/bible";
import { api, getToken } from "../lib/api";

export function PlansPage() {
  const { t } = useTranslation();
  const [csv, setCsv] = useState("day,ref,title,note\n1,John.1,Word,Begin\n2,John.2,Wedding,");
  const [message, setMessage] = useState<string | null>(null);
  const devotionSteps = ["pause", "read", "reflect", "pray", "act"] as const;

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
        <ol className="list">
          {devotionSteps.map((step) => (
            <li key={step}>{t(`devotion.${step}`)}</li>
          ))}
        </ol>
      </div>
    </section>
  );
}
