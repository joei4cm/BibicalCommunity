import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { listDevotionMaterials, listStudyMaterials, parsePlanCsv } from "@logoshome/bible";
import { api, apiOptional, getToken } from "../lib/api";
import { humanizeStatus } from "../lib/status";
import {
  DEVOTION_STEPS,
  devotionProgress,
  nextStep,
  type DevotionStep,
} from "./devotion";

type Plan = {
  id: string;
  title: string;
  description?: string | null;
  visibility: string;
  days: unknown[];
};

type PublicPlan = { id: string; title: string; description?: string | null };
type Subscription = {
  id?: string;
  subscriptionId?: string;
  planId: string;
  title?: string;
  progressDay: number;
  days?: unknown[];
};

type PlanVisibility = "private" | "church" | "public";

export function PlansPage() {
  const { t, i18n } = useTranslation();
  const [csv, setCsv] = useState("day,ref,title,note\n1,John.1,Word,Begin\n2,John.2,Wedding,");
  const [createTitle, setCreateTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createVisibility, setCreateVisibility] = useState<PlanVisibility>("private");
  const [createDaysText, setCreateDaysText] = useState("1,John.1,Begin\n2,John.2,Wedding");
  const [message, setMessage] = useState<string | null>(null);
  const [step, setStep] = useState<DevotionStep>("pause");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [daysJson, setDaysJson] = useState("[]");
  const [subscribeId, setSubscribeId] = useState("");
  const [publicPlans, setPublicPlans] = useState<PublicPlan[] | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[] | null>(null);
  const progress = devotionProgress(step);

  const lang = i18n.language.startsWith("zh") ? "zh" : i18n.language.startsWith("ja") ? "ja" : "en";
  const studyMaterials = useMemo(() => listStudyMaterials({ language: lang }), [lang]);
  const devotionMaterials = useMemo(() => listDevotionMaterials(), []);
  const localeKey = (i18n.language || "zh-CN") as "zh-CN" | "en" | "ja";

  const selected = plans.find((p) => p.id === selectedId) ?? null;

  const refreshPlans = useCallback(async () => {
    if (!getToken()) {
      setMessage("login_required");
      return;
    }
    const res = await api<{ plans: Plan[] }>("/v1/plans");
    setPlans(res.plans);
    setMessage(null);
    setSelectedId((prev) => {
      if (prev) return prev;
      const first = res.plans[0];
      if (!first) return prev;
      setDaysJson(JSON.stringify(first.days, null, 2));
      return first.id;
    });
  }, []);

  useEffect(() => {
    void refreshPlans().catch((e) => setMessage(e instanceof Error ? e.message : "error"));
  }, [refreshPlans]);

  useEffect(() => {
    if (!getToken()) return;
    void (async () => {
      const pub = await apiOptional<{ plans: PublicPlan[] }>("/v1/plans/public");
      setPublicPlans(pub?.plans ?? null);
      const subs = await apiOptional<{ subscriptions: Subscription[] }>("/v1/plans/subscriptions");
      setSubscriptions(subs?.subscriptions ?? null);
    })();
  }, []);

  function selectPlan(id: string) {
    setSelectedId(id);
    const plan = plans.find((p) => p.id === id);
    if (plan) setDaysJson(JSON.stringify(plan.days, null, 2));
  }

  async function createPlan() {
    if (!getToken()) {
      setMessage("login_required");
      return;
    }
    const title = createTitle.trim();
    if (!title) {
      setMessage("title_required");
      return;
    }
    let days: ReturnType<typeof parsePlanCsv>;
    try {
      days = parsePlanCsv(`day,ref,title,note\n${createDaysText}`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "invalid_days");
      return;
    }
    if (days.length === 0) {
      setMessage("days_required");
      return;
    }
    const res = await api<{ id: string }>("/v1/plans", {
      method: "POST",
      body: JSON.stringify({
        title,
        description: createDescription.trim() || undefined,
        visibility: createVisibility,
        days,
      }),
    });
    setMessage(`created:${res.id} (${days.length} days)`);
    setCreateTitle("");
    setCreateDescription("");
    await refreshPlans();
    setSelectedId(res.id);
  }

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
    await refreshPlans();
  }

  async function saveDays() {
    if (!getToken() || !selectedId) {
      setMessage("login_required");
      return;
    }
    let days: unknown[];
    try {
      days = JSON.parse(daysJson) as unknown[];
      if (!Array.isArray(days)) throw new Error("invalid");
    } catch {
      setMessage("invalid_json");
      return;
    }
    await api(`/v1/plans/${encodeURIComponent(selectedId)}`, {
      method: "PATCH",
      body: JSON.stringify({ days }),
    });
    setMessage("saved");
    await refreshPlans();
  }

  async function subscribe() {
    if (!getToken()) {
      setMessage("login_required");
      return;
    }
    const id = subscribeId.trim();
    if (!id) return;
    const res = await api<{ id: string }>(`/v1/plans/${encodeURIComponent(id)}/subscribe`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    setMessage(`subscribed:${res.id}`);
    setSubscribeId("");
    const subs = await apiOptional<{ subscriptions: Subscription[] }>("/v1/plans/subscriptions");
    setSubscriptions(subs?.subscriptions ?? null);
  }

  async function advancePlanDay(planId: string, currentDay: number) {
    if (!getToken()) {
      setMessage("login_required");
      return;
    }
    const next = currentDay + 1;
    await api(`/v1/plans/${encodeURIComponent(planId)}/progress`, {
      method: "POST",
      body: JSON.stringify({ day: next }),
    });
    setMessage(`progress:${planId}:day ${next}`);
    const subs = await apiOptional<{ subscriptions: Subscription[] }>("/v1/plans/subscriptions");
    setSubscriptions(subs?.subscriptions ?? null);
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

      <div className="panel" data-testid="plans-create-panel">
        <h2 style={{ marginTop: 0 }}>{t("plans.create")}</h2>
        {message && <p className="muted">{humanizeStatus(t, message)}</p>}
        <div className="field">
          <label htmlFor="plan-title">{t("plans.title")}</label>
          <input
            id="plan-title"
            data-testid="plans-create-title"
            value={createTitle}
            onChange={(e) => setCreateTitle(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="plan-description">{t("plans.description")}</label>
          <input
            id="plan-description"
            value={createDescription}
            onChange={(e) => setCreateDescription(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="plan-visibility">{t("plans.visibility")}</label>
          <select
            id="plan-visibility"
            value={createVisibility}
            onChange={(e) => setCreateVisibility(e.target.value as PlanVisibility)}
          >
            <option value="private">{t("plans.visibilityPrivate")}</option>
            <option value="church">{t("plans.visibilityChurch")}</option>
            <option value="public">{t("plans.visibilityPublic")}</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="plan-days">{t("plans.daysHint")}</label>
          <textarea
            id="plan-days"
            rows={4}
            value={createDaysText}
            onChange={(e) => setCreateDaysText(e.target.value)}
          />
        </div>
        <button type="button" className="btn" data-testid="plans-create-submit" onClick={() => void createPlan()}>
          {t("plans.create")}
        </button>
      </div>

      <div className="panel">
        <h2 style={{ marginTop: 0 }}>{t("plans.owned")}</h2>
        <ul className="list">
          {plans.length === 0 && <li className="muted">—</li>}
          {plans.map((p) => (
            <li key={p.id}>
              <button type="button" className="linkish" onClick={() => selectPlan(p.id)}>
                <strong>{p.title}</strong>
              </button>
              <div className="muted">
                {p.visibility} · {p.days.length} days
                {selectedId === p.id ? ` · ${t("plans.selected")}` : ""}
              </div>
            </li>
          ))}
        </ul>
        {selected && (
          <>
            <div className="field" style={{ marginTop: "1rem" }}>
              <label>{t("plans.editDays")}</label>
              <textarea rows={8} value={daysJson} onChange={(e) => setDaysJson(e.target.value)} />
            </div>
            <button type="button" className="btn" onClick={() => void saveDays()}>
              {t("plans.save")}
            </button>
          </>
        )}
      </div>

      <div className="panel">
        <h2 style={{ marginTop: 0 }}>{t("plans.subscribe")}</h2>
        <div className="field">
          <label>{t("plans.subscribeId")}</label>
          <input
            value={subscribeId}
            onChange={(e) => setSubscribeId(e.target.value)}
            placeholder="plan_…"
          />
        </div>
        <button type="button" className="btn" onClick={() => void subscribe()}>
          {t("plans.subscribe")}
        </button>
      </div>

      {publicPlans && (
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>{t("plans.public")}</h2>
          <ul className="list">
            {publicPlans.length === 0 && <li className="muted">—</li>}
            {publicPlans.map((p) => (
              <li key={p.id}>
                <strong>{p.title}</strong>
                <div className="muted">{p.id}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {subscriptions && (
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>{t("plans.subscriptions")}</h2>
          <ul className="list">
            {subscriptions.length === 0 && <li className="muted">—</li>}
            {subscriptions.map((s) => (
              <li key={s.subscriptionId ?? s.id ?? s.planId}>
                <strong>{s.title ?? s.planId}</strong>
                <div className="muted">
                  {s.planId} · day {s.progressDay}
                </div>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => void advancePlanDay(s.planId, s.progressDay)}
                >
                  {t("plans.advanceDay")}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="panel">
        <h2 style={{ marginTop: 0 }}>{t("plans.importCsv")}</h2>
        <div className="field">
          <textarea rows={6} value={csv} onChange={(e) => setCsv(e.target.value)} />
        </div>
        <button type="button" className="btn" onClick={() => void importCsv()}>
          {t("plans.importCsv")}
        </button>
      </div>

      <div className="panel">
        <h2 style={{ marginTop: 0 }}>{t("plans.devotion")}</h2>
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

      <div className="panel">
        <h2 style={{ marginTop: 0 }}>{t("plans.materials")}</h2>
        <ul className="list">
          {devotionMaterials.map((m) => (
            <li key={m.id}>
              <strong>{m.title[localeKey] ?? m.title.en}</strong>
              <div className="muted">{m.body[localeKey] ?? m.body.en}</div>
              <div className="muted">{m.license}</div>
            </li>
          ))}
          {studyMaterials.map((m) => (
            <li key={m.id}>
              <a href={m.url} target="_blank" rel="noreferrer">
                {m.title}
              </a>
              <div className="muted">{m.license}</div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
